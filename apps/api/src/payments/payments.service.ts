import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { PaymentProvider, TerminalPayment } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { decryptSecret, encryptSecret, maskSecret } from '../common/crypto/secrets'
import { CONNECTORS, ConnectorError, type ConnectorContext, type Http } from './connectors'

// Au-delà, une demande restée sans réponse est abandonnée (le client est parti,
// le lecteur s'est éteint...) pour libérer le TPE
const PAYMENT_TIMEOUT_MS = 3 * 60_000
// Paiement par QR : le client a le temps de sortir son téléphone. Stripe
// impose au moins 30 minutes de validité à une session de paiement.
const QR_VALIDITY_MS = 31 * 60_000

type PaymentView = Pick<
  TerminalPayment,
  'id' | 'deviceId' | 'provider' | 'amount' | 'status' | 'failureReason' | 'providerRef' | 'createdAt' | 'checkoutUrl' | 'expiresAt'
>

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  // Remplaçable dans les tests
  http: Http = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Comptes prestataires ────────────────────────────────────

  async listAccounts(organizationId: string) {
    const accounts = await this.prisma.paymentAccount.findMany({ where: { organizationId } })
    return accounts.map((a) => {
      const creds = this.read(a.credentials)
      const secret = creds.secretKey ?? creds.apiKey ?? ''
      return { provider: a.provider, testMode: a.testMode, key: maskSecret(secret), merchantCode: creds.merchantCode, updatedAt: a.updatedAt }
    })
  }

  async saveAccount(organizationId: string, provider: PaymentProvider, credentials: Record<string, string>) {
    if (provider === 'SIMULATOR') throw new BadRequestException('Le TPE virtuel ne demande aucun compte')
    const clean = Object.fromEntries(Object.entries(credentials).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim()]))
    const existing = await this.prisma.paymentAccount.findUnique({ where: { organizationId_provider: { organizationId, provider } } })
    // Conserve le lieu Stripe déjà créé si la clé ne change que de valeur
    if (existing) {
      const old = this.read(existing.credentials)
      if (old.locationId && !clean.locationId && old.secretKey?.slice(0, 8) === clean.secretKey?.slice(0, 8)) clean.locationId = old.locationId
    }
    const { testMode } = await this.connector(provider).verify({ credentials: clean, http: this.http }).catch(this.toHttp)
    const sealed = encryptSecret(JSON.stringify(clean))
    await this.prisma.paymentAccount.upsert({
      where: { organizationId_provider: { organizationId, provider } },
      create: { organizationId, provider, credentials: sealed, testMode },
      update: { credentials: sealed, testMode },
    })
    return (await this.listAccounts(organizationId)).find((a) => a.provider === provider)
  }

  async removeAccount(organizationId: string, provider: PaymentProvider) {
    await this.prisma.paymentAccount.deleteMany({ where: { organizationId, provider } })
    await this.prisma.paymentDevice.updateMany({ where: { provider, site: { organizationId } }, data: { isActive: false } })
    return { success: true }
  }

  // ── TPE ─────────────────────────────────────────────────────

  listDevices(siteId: string) {
    return this.prisma.paymentDevice.findMany({
      where: { siteId, isActive: true },
      select: { id: true, provider: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async pairDevice(
    siteId: string,
    input: { provider: PaymentProvider; name: string; code?: string; address?: { line1: string; city: string; postalCode: string; country: string } },
  ) {
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
    const ctx = await this.context(site.organizationId, input.provider)
    if (input.provider !== 'SIMULATOR' && !input.code) throw new BadRequestException('Saisissez le code affiché sur le TPE')
    const paired = await this.connector(input.provider)
      .pair(ctx, { code: input.code ?? '', name: input.name, address: input.address })
      .catch(this.toHttp)
    if (paired.credentials) {
      await this.prisma.paymentAccount.update({
        where: { organizationId_provider: { organizationId: site.organizationId, provider: input.provider } },
        data: { credentials: encryptSecret(JSON.stringify(paired.credentials)) },
      })
    }
    return this.prisma.paymentDevice.create({
      data: { siteId, provider: input.provider, name: input.name, externalId: paired.externalId },
      select: { id: true, provider: true, name: true, createdAt: true },
    })
  }

  async removeDevice(siteId: string, id: string) {
    const d = await this.prisma.paymentDevice.updateMany({ where: { id, siteId }, data: { isActive: false } })
    if (!d.count) throw new NotFoundException('TPE introuvable')
    return { success: true }
  }

  // ── Paiements ───────────────────────────────────────────────

  async start(
    siteId: string,
    input: { deviceId: string; amount: number; clientSaleId?: string; description?: string; force?: boolean },
    userId?: string,
  ): Promise<PaymentView> {
    const device = await this.prisma.paymentDevice.findFirst({ where: { id: input.deviceId, siteId, isActive: true } })
    if (!device) throw new NotFoundException('TPE introuvable')

    // Demande restée en plan (caisse rechargée en plein paiement...) : la caisse
    // peut la libérer explicitement avant d'envoyer la nouvelle
    if (input.force) {
      const stale = await this.prisma.terminalPayment.findFirst({
        where: {
          deviceId: device.id,
          status: 'PENDING',
          ...(input.clientSaleId ? { OR: [{ clientSaleId: null }, { NOT: { clientSaleId: input.clientSaleId } }] } : {}),
        },
      })
      if (stale) await this.cancel(siteId, stale.id)
    }

    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true, name: true } })

    // Un TPE ne traite qu'un paiement à la fois. Verrou par TPE : deux envois
    // simultanés (double appui, deux caisses) ne créent jamais deux débits.
    const claim = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'tpe:' + device.id}))`
      const pending = await tx.terminalPayment.findFirst({ where: { deviceId: device.id, status: 'PENDING' } })
      if (pending) {
        // Même vente renvoyée : on reprend la demande déjà en cours
        if (input.clientSaleId && pending.clientSaleId === input.clientSaleId) return { existing: pending }
        return { busy: pending }
      }
      const created = await tx.terminalPayment.create({
        data: {
          siteId,
          deviceId: device.id,
          provider: device.provider,
          amount: input.amount,
          clientSaleId: input.clientSaleId,
          createdBy: userId,
        },
      })
      return { created }
    })

    if ('existing' in claim && claim.existing) return this.view(claim.existing)
    if ('busy' in claim && claim.busy) {
      const refreshed = await this.refreshOne(claim.busy)
      if (refreshed.status === 'PENDING') throw new ConflictException('Le TPE attend déjà un autre paiement.')
      return this.start(siteId, { ...input, force: false }, userId)
    }
    const payment = claim.created!

    try {
      const ctx = await this.context(site.organizationId, device.provider)
      const { providerRef } = await this.connector(device.provider).start(ctx, {
        readerId: device.externalId,
        amount: input.amount,
        currency: payment.currency,
        reference: payment.id,
        description: input.description ?? `Vente ${site.name}`,
      })
      return this.view(await this.prisma.terminalPayment.update({ where: { id: payment.id }, data: { providerRef } }))
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Le TPE ne répond pas'
      await this.prisma.terminalPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: reason } })
      throw this.toHttp(e)
    }
  }

  // ── Paiement par QR ─────────────────────────────────────────

  // Prestataire du paiement par QR : Stripe s'il est relié, sinon le TPE
  // virtuel s'il existe sur la boutique (essai sans compte)
  async qrProvider(siteId: string): Promise<PaymentProvider | null> {
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
    const stripe = await this.prisma.paymentAccount.findUnique({ where: { organizationId_provider: { organizationId: site.organizationId, provider: 'STRIPE' } } })
    if (stripe) return 'STRIPE'
    const sim = await this.prisma.paymentDevice.findFirst({ where: { siteId, provider: 'SIMULATOR', isActive: true }, select: { id: true } })
    return sim ? 'SIMULATOR' : null
  }

  async startQr(siteId: string, input: { amount: number; clientSaleId?: string; description?: string }, userId?: string): Promise<PaymentView> {
    const provider = await this.qrProvider(siteId)
    if (!provider) throw new BadRequestException('Paiement par QR indisponible : reliez votre compte Stripe dans Paramètres > Paiement')
    const connector = this.connector(provider)
    if (!connector.createLink) throw new BadRequestException('Ce prestataire ne propose pas le paiement par QR')
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true, name: true } })
    const expiresAt = new Date(Date.now() + QR_VALIDITY_MS)
    // Même vente, même montant : on reprend le QR déjà affiché. Verrou par
    // vente : deux appuis simultanés ne créent jamais deux paiements
    const claim = await this.prisma.$transaction(async (tx) => {
      if (input.clientSaleId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'qr:' + input.clientSaleId}))`
        const existing = await tx.terminalPayment.findFirst({
          where: { siteId, deviceId: null, clientSaleId: input.clientSaleId, amount: input.amount, status: 'PENDING', expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        })
        if (existing) return { existing }
      }
      return { created: await tx.terminalPayment.create({ data: { siteId, provider, amount: input.amount, clientSaleId: input.clientSaleId, createdBy: userId, expiresAt } }) }
    })
    if ('existing' in claim && claim.existing) {
      // L'autre demande est peut-être encore en train d'obtenir la page du prestataire
      for (let i = 0; i < 20 && !claim.existing.checkoutUrl; i++) {
        await new Promise((r) => setTimeout(r, 250))
        claim.existing = (await this.prisma.terminalPayment.findUnique({ where: { id: claim.existing.id } })) ?? claim.existing
      }
      return this.view(claim.existing)
    }
    const payment = claim.created!
    const front = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    try {
      const link = await connector.createLink(await this.context(site.organizationId, provider), {
        amount: input.amount,
        currency: payment.currency,
        reference: payment.id,
        description: input.description ?? `Achat chez ${site.name}`,
        doneUrl: `${front}/paiement/merci`,
        testUrl: `${front}/paiement/test`,
        expiresAt,
      })
      return this.view(await this.prisma.terminalPayment.update({ where: { id: payment.id }, data: { providerRef: link.providerRef, checkoutUrl: link.url } }))
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Prestataire injoignable'
      await this.prisma.terminalPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: reason } })
      throw this.toHttp(e)
    }
  }

  async get(siteId: string, id: string) {
    const payment = await this.prisma.terminalPayment.findFirst({ where: { id, siteId } })
    if (!payment) throw new NotFoundException('Paiement introuvable')
    return this.view(await this.refreshOne(payment))
  }

  async cancel(siteId: string, id: string) {
    const payment = await this.prisma.terminalPayment.findFirst({ where: { id, siteId }, include: { device: true } })
    if (!payment) throw new NotFoundException('Paiement introuvable')
    if (payment.status !== 'PENDING') return this.view(payment)
    // Un paiement accepté entre-temps ne doit pas être annulé par erreur
    const latest = await this.refreshOne(payment)
    if (latest.status !== 'PENDING') return this.view(latest)
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
    if (payment.providerRef) {
      const ctx = await this.context(site.organizationId, payment.provider)
      const connector = this.connector(payment.provider)
      if (payment.device) await connector.cancel(ctx, { readerId: payment.device.externalId, providerRef: payment.providerRef }).catch(() => {})
      else await connector.cancelLink?.(ctx, { providerRef: payment.providerRef }).catch(() => {})
    }
    return this.view(await this.settle(payment.id, 'CANCELED', 'Annulé depuis la caisse'))
  }

  // TPE virtuel, ou lecteur simulé Stripe en mode test
  async simulate(siteId: string, id: string, approve: boolean) {
    const payment = await this.prisma.terminalPayment.findFirst({ where: { id, siteId, status: 'PENDING' }, include: { device: true } })
    if (!payment) throw new NotFoundException('Aucun paiement en attente')
    if (payment.provider === 'SIMULATOR') {
      return this.view(await this.settle(id, approve ? 'SUCCEEDED' : 'FAILED', approve ? undefined : 'Carte refusée'))
    }
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
    const account = await this.prisma.paymentAccount.findUnique({
      where: { organizationId_provider: { organizationId: site.organizationId, provider: payment.provider } },
    })
    const simulate = this.connector(payment.provider).simulate
    if (!account?.testMode || !simulate || !payment.providerRef || !payment.device) throw new BadRequestException('Simulation possible uniquement en mode test')
    await simulate(await this.context(site.organizationId, payment.provider), {
      readerId: payment.device.externalId,
      providerRef: payment.providerRef,
      approve,
    }).catch(this.toHttp)
    return this.get(siteId, id)
  }

  // Ce qu'affiche l'écran du TPE virtuel
  async pendingForDevice(siteId: string, deviceId: string) {
    const payment = await this.prisma.terminalPayment.findFirst({
      where: { siteId, deviceId, status: 'PENDING', createdAt: { gt: new Date(Date.now() - PAYMENT_TIMEOUT_MS) } },
      orderBy: { createdAt: 'desc' },
    })
    return payment ? this.view(payment) : null
  }

  // Rembourse sur la carte d'origine un paiement encaissé par un TPE connecté
  async refundByReference(organizationId: string, providerRef: string, amountCents: number) {
    const found = await this.prisma.terminalPayment.findFirst({ where: { OR: [{ providerRef }, { id: providerRef }], status: 'SUCCEEDED' } })
    const owner = found ? await this.prisma.site.findUnique({ where: { id: found.siteId }, select: { organizationId: true } }) : null
    const payment = owner?.organizationId === organizationId ? found : null
    if (!payment) return null // pas un paiement par TPE connecté ni par QR
    const ctx = await this.context(organizationId, payment.provider)
    return this.connector(payment.provider)
      .refund(ctx, { providerRef: payment.providerRef ?? payment.id, amount: amountCents })
      .catch(this.toHttp)
  }

  // Rattache le paiement TPE à la vente synchronisée (référence prestataire)
  async referencesForSale(clientSaleId: string) {
    const payments = await this.prisma.terminalPayment.findMany({
      where: { clientSaleId, status: 'SUCCEEDED' },
      select: { amount: true, providerRef: true, id: true },
    })
    return payments.map((p) => ({ amount: p.amount / 100, reference: p.providerRef ?? p.id }))
  }

  // ── Interne ─────────────────────────────────────────────────

  private async refreshOne(payment: TerminalPayment): Promise<TerminalPayment> {
    if (payment.status !== 'PENDING') return payment
    if (!payment.deviceId) return this.refreshQr(payment)
    const expired = Date.now() - payment.createdAt.getTime() > PAYMENT_TIMEOUT_MS
    if (payment.provider === 'SIMULATOR' || !payment.providerRef) {
      return expired ? this.settle(payment.id, 'FAILED', 'Pas de réponse du TPE') : payment
    }
    try {
      const device = await this.prisma.paymentDevice.findUniqueOrThrow({ where: { id: payment.deviceId! } })
      const site = await this.prisma.site.findUniqueOrThrow({ where: { id: payment.siteId }, select: { organizationId: true } })
      const ctx = await this.context(site.organizationId, payment.provider)
      const connector = this.connector(payment.provider)
      const remote = await connector.status(ctx, { readerId: device.externalId, providerRef: payment.providerRef })
      if (remote.status !== 'PENDING') return this.settle(payment.id, remote.status, remote.failureReason)
      if (expired) {
        await connector.cancel(ctx, { readerId: device.externalId, providerRef: payment.providerRef }).catch(() => {})
        return this.settle(payment.id, 'FAILED', 'Pas de réponse du TPE')
      }
    } catch (e) {
      // Prestataire injoignable un instant : on garde l'état, la caisse réessaie
      this.logger.warn(`Statut du paiement ${payment.id} indisponible : ${(e as Error).message}`)
    }
    return payment
  }

  // Paiement par QR : la session du prestataire fait foi ; payée, sa
  // référence de paiement remplace celle de la session (remboursement)
  private async refreshQr(payment: TerminalPayment): Promise<TerminalPayment> {
    const expired = !payment.expiresAt || payment.expiresAt < new Date()
    if (payment.provider === 'SIMULATOR' || !payment.providerRef) {
      return expired ? this.settle(payment.id, 'FAILED', 'QR code expiré') : payment
    }
    try {
      const site = await this.prisma.site.findUniqueOrThrow({ where: { id: payment.siteId }, select: { organizationId: true } })
      const connector = this.connector(payment.provider)
      const remote = await connector.linkStatus!(await this.context(site.organizationId, payment.provider), { providerRef: payment.providerRef })
      if (remote.status === 'SUCCEEDED' && remote.paymentRef) {
        await this.prisma.terminalPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { providerRef: remote.paymentRef } })
      }
      if (remote.status !== 'PENDING') return this.settle(payment.id, remote.status, remote.failureReason)
      if (expired) return this.settle(payment.id, 'FAILED', 'QR code expiré')
    } catch (e) {
      this.logger.warn(`Statut du paiement par QR ${payment.id} indisponible : ${(e as Error).message}`)
    }
    return payment
  }

  // Passage à un état final, une seule fois (deux lectures simultanées ne
  // peuvent pas écraser un résultat déjà connu)
  private async settle(id: string, status: TerminalPayment['status'], failureReason?: string) {
    await this.prisma.terminalPayment.updateMany({ where: { id, status: 'PENDING' }, data: { status, failureReason } })
    return this.prisma.terminalPayment.findUniqueOrThrow({ where: { id } })
  }

  private view(p: TerminalPayment): PaymentView {
    return {
      id: p.id,
      deviceId: p.deviceId,
      provider: p.provider,
      amount: p.amount,
      status: p.status,
      failureReason: p.failureReason,
      providerRef: p.providerRef,
      createdAt: p.createdAt,
      checkoutUrl: p.checkoutUrl,
      expiresAt: p.expiresAt,
    }
  }

  private connector(provider: PaymentProvider) {
    return CONNECTORS[provider]
  }

  private async context(organizationId: string, provider: PaymentProvider): Promise<ConnectorContext> {
    if (provider === 'SIMULATOR') return { credentials: {}, http: this.http }
    const account = await this.prisma.paymentAccount.findUnique({ where: { organizationId_provider: { organizationId, provider } } })
    if (!account) throw new BadRequestException('Reliez d\'abord votre compte de paiement dans Paramètres > Paiement')
    return { credentials: this.read(account.credentials), http: this.http }
  }

  private read(sealed: string): Record<string, string> {
    return JSON.parse(decryptSecret(sealed))
  }

  private toHttp = (e: unknown): never => {
    if (e instanceof ConnectorError) throw new BadRequestException(e.message)
    throw e
  }
}
