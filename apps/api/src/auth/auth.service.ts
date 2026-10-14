import { TRIAL_DAYS, metierByKey } from '@erp/types'
import { StarterService } from '../products/starter.service'
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../common/prisma/prisma.service'
import { randomBytes } from 'node:crypto'
import { PlatformService } from '../platform/platform.service'
import { AuditService } from '../audit/audit.service'
import type { Prisma } from '@prisma/client'
import { BADGE_QR_PREFIX, PIN_RE, PinAttempts, badgeLookup, newBadgeToken, normalizeBadge, pinChallenge, pinLookup, randomPin, verifyTerminalSignature } from './pin'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'

const BCRYPT_ROUNDS = 12

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private platform: PlatformService,
    private audit: AuditService,
    private starter: StarterService,
  ) {}

  // Inscription d'un commerce : organisation, première boutique et compte
  // propriétaire, avec les réglages du secteur choisi (TVA, paiements, champs)
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim()
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail')
    }
    const passwordHash = await this.hashPassword(dto.password)
    const base = slugify(dto.businessName) || 'commerce'
    const slug = (await this.prisma.organization.findUnique({ where: { slug: base } }))
      ? `${base}-${randomBytes(3).toString('hex')}`
      : base

    const { org, site, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.businessName.trim(), slug, trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) },
      })
      const site = await tx.site.create({ data: { organizationId: org.id, name: (dto.siteName || dto.businessName).trim() } })
      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          firstName: dto.firstName?.trim() ?? '',
          lastName: dto.lastName?.trim() ?? '',
          role: 'OWNER',
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
      })
      return { org, site, user }
    })
    const metier = metierByKey(dto.metier)
    await this.platform.applySector(org.id, metier?.sector ?? dto.sector)
    // Restauration : 10 % par défaut plutôt que le 5,5 % de l'alimentaire
    if (metier?.defaultTaxRate) {
      await this.prisma.$transaction([
        this.prisma.taxRate.updateMany({ where: { organizationId: org.id }, data: { isDefault: false } }),
        this.prisma.taxRate.updateMany({ where: { organizationId: org.id, rate: metier.defaultTaxRate }, data: { isDefault: true } }),
      ])
    }
    if (metier) await this.starter.load(site.id, metier.key)

    return { ...this.issue(user), user, siteId: site.id }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        tokenVersion: true,
      },
    })

    if (!user) throw new UnauthorizedException('Identifiants invalides')

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      await this.audit.log({ organizationId: user.organizationId, userId: user.id, action: 'auth.login_failed' })
      throw new UnauthorizedException('Identifiants invalides')
    }
    await this.audit.log({ organizationId: user.organizationId, userId: user.id, action: 'auth.login' })

    const { passwordHash: _, tokenVersion, ...safeUser } = user
    return { ...this.issue({ ...safeUser, tokenVersion }), user: safeUser }
  }

  private issue(user: { id: string; email: string; role: string; organizationId: string; tokenVersion?: number }) {
    const payload = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId, tv: user.tokenVersion ?? 0 }
    const accessToken = this.jwt.sign(payload)
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    })
    return { accessToken, refreshToken }
  }

  // Le jeton d'accès renouvelé reprend le rôle actuel ; un jeton révoqué
  // (version dépassée) ou d'un compte supprimé est refusé
  async refresh(userId: string, tokenVersion: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, organizationId: true, tokenVersion: true },
    })
    if (!user || user.tokenVersion !== tokenVersion) throw new UnauthorizedException('Session expirée')
    const payload = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId, tv: user.tokenVersion }
    return { accessToken: this.jwt.sign(payload) }
  }

  async sessionFor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, role: true, organizationId: true, tokenVersion: true },
    })
    return this.issue(user)
  }

  // Déconnecte tous les appareils de ce compte
  async logoutEverywhere(userId: string, organizationId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })
    await this.audit.log({ organizationId, userId, action: 'auth.logout_everywhere' })
    return { success: true }
  }

  private pinAttempts = new PinAttempts()
  // Par organisation aussi : multiplier les caisses ne donne pas plus d'essais
  private orgAttempts = new PinAttempts(30, 15 * 60_000)

  private get pinSecret() {
    return this.config.get<string>('PIN_SECRET') ?? this.config.getOrThrow<string>('JWT_SECRET')
  }

  // La caisse signe « pin-login:<caisse>:<heure> » : le code ou le badge n'est
  // accepté que sur une caisse enregistrée, une seule fois par signature
  private async verifiedTerminal(dto: { terminalId: string; signedAt: string; signature: string }) {
    const locked = this.pinAttempts.lockedFor(dto.terminalId)
    if (locked) throw new UnauthorizedException(`Trop d'essais : caisse bloquée ${locked} min`)
    const terminal = await this.prisma.terminal.findUnique({
      where: { id: dto.terminalId },
      select: { id: true, siteId: true, publicKey: true, isActive: true, site: { select: { organizationId: true } } },
    })
    const age = Math.abs(Date.now() - new Date(dto.signedAt).getTime())
    if (
      !terminal ||
      !terminal.isActive ||
      !(age < 2 * 60_000) ||
      !(await verifyTerminalSignature(JSON.parse(terminal.publicKey), pinChallenge(terminal.id, dto.signedAt), dto.signature)) ||
      !this.pinAttempts.firstUse(dto.signature)
    ) {
      throw new UnauthorizedException("Cette caisse n'est pas reconnue : connectez-vous avec un e-mail")
    }
    const orgLocked = this.orgAttempts.lockedFor(terminal.site.organizationId)
    if (orgLocked) throw new UnauthorizedException(`Trop d'essais sur vos caisses : réessayez dans ${orgLocked} min ou connectez-vous avec un e-mail`)
    return terminal
  }

  private async openTillSession(
    terminal: { id: string; siteId: string; siteOrg: string },
    where: Prisma.UserWhereUniqueInput | null,
    unknown: string,
  ) {
    const user = where
      ? await this.prisma.user.findUnique({
          where,
          select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, tokenVersion: true, sites: { where: { siteId: terminal.siteId }, select: { siteId: true } } },
        })
      : null
    const allowed = user && (user.role === 'OWNER' || user.role === 'MANAGER' || user.sites.length > 0)
    if (!user || !allowed) {
      this.pinAttempts.fail(terminal.id)
      this.orgAttempts.fail(terminal.siteOrg)
      await this.audit.log({ organizationId: user?.organizationId ?? null, userId: user?.id, action: 'auth.till_refused', detail: unknown, terminalId: terminal.id })
      throw new UnauthorizedException(user ? "Ce compte n'a pas accès à cette boutique" : unknown)
    }
    this.pinAttempts.succeed(terminal.id)
    const { sites: _, tokenVersion, ...safeUser } = user
    await this.audit.log({ organizationId: user.organizationId, userId: user.id, action: 'auth.till_login', terminalId: terminal.id })
    return { ...this.issue({ ...safeUser, tokenVersion }), user: safeUser, siteId: terminal.siteId }
  }

  // Connexion par code vendeur à 4 chiffres
  async pinLogin(dto: { terminalId: string; signedAt: string; signature: string; pin: string }) {
    const terminal = await this.verifiedTerminal(dto)
    const org = terminal.site.organizationId
    return this.openTillSession(
      { ...terminal, siteOrg: org },
      PIN_RE.test(dto.pin) ? { organizationId_pinLookup: { organizationId: org, pinLookup: pinLookup(this.pinSecret, org, dto.pin) } } : null,
      'Code inconnu',
    )
  }

  // Connexion par badge : QR code présenté à la caméra ou badge NFC
  async badgeLogin(dto: { terminalId: string; signedAt: string; signature: string; code: string }) {
    const terminal = await this.verifiedTerminal(dto)
    const org = terminal.site.organizationId
    const badge = normalizeBadge(dto.code)
    return this.openTillSession(
      { ...terminal, siteOrg: org },
      badge ? { organizationId_badgeLookup: { organizationId: org, badgeLookup: badgeLookup(this.pinSecret, org, badge) } } : null,
      'Badge inconnu',
    )
  }

  // QR : un jeton neuf (l'ancien badge ne marche plus). NFC : l'identifiant lu.
  async setBadge(userId: string, organizationId: string, dto: { kind: 'QR' | 'NFC'; uid?: string }) {
    const badge = dto.kind === 'QR' ? { kind: 'QR' as const, value: newBadgeToken() } : normalizeBadge(dto.uid ?? '')
    if (!badge || badge.kind !== dto.kind) throw new BadRequestException('Badge illisible : approchez-le à nouveau')
    try {
      await this.prisma.user.update({
        where: { id: userId, organizationId },
        data: { badgeLookup: badgeLookup(this.pinSecret, organizationId, badge), badgeKind: badge.kind, badgeSetAt: new Date() },
      })
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Ce badge est déjà attribué à quelqu’un de l’équipe')
      throw e
    }
    return badge.kind === 'QR' ? { kind: 'QR', payload: `${BADGE_QR_PREFIX}${badge.value}` } : { kind: 'NFC' }
  }

  async clearBadge(userId: string, organizationId: string) {
    await this.prisma.user.update({ where: { id: userId, organizationId }, data: { badgeLookup: null, badgeKind: null, badgeSetAt: null } })
  }

  // Code tiré au hasard, unique dans l'organisation. Jamais choisi par
  // l'utilisateur : « code déjà pris » révélerait ceux des collègues.
  async setPin(userId: string, organizationId: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const pin = randomPin()
      try {
        await this.prisma.user.update({
          where: { id: userId, organizationId },
          data: { pinLookup: pinLookup(this.pinSecret, organizationId, pin), pinSetAt: new Date() },
        })
        return { pin }
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e
      }
    }
    throw new ConflictException('Plus de code libre : retirez ceux des anciens comptes')
  }

  async clearPin(userId: string, organizationId: string) {
    await this.prisma.user.update({ where: { id: userId, organizationId }, data: { pinLookup: null, pinSetAt: null } })
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS)
  }
}

// « Maison Dupont & Fils » → « maison-dupont-fils »
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
