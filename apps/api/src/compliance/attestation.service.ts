import { createHash } from 'crypto'
import { join } from 'path'
import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { FISCAL_SOFTWARE } from '@erp/types'
import { BRAND_COLORS } from '@erp/utils'
import { drawBrandLogo } from '../common/pdf/brand'
import { PrismaService } from '../common/prisma/prisma.service'
import { SigningKeyService } from './signing-key.service'
import { FiscalEventsService } from './fiscal-events.service'

// Identité de l'éditeur, fixée par la configuration du serveur : FLŌW ne
// l'invente jamais. Sans elle, aucune attestation n'est délivrée.
export interface EditorIdentity {
  company: string // raison sociale
  siren: string
  address: string
  representative: string // NOM Prénom du représentant légal
  city: string // « Fait à »
}

export function editorFromEnv(env: NodeJS.ProcessEnv = process.env): EditorIdentity | null {
  const e = {
    company: env.EDITOR_COMPANY?.trim(),
    siren: env.EDITOR_SIREN?.replace(/\s/g, ''),
    address: env.EDITOR_ADDRESS?.trim(),
    representative: env.EDITOR_REPRESENTATIVE?.trim(),
    city: env.EDITOR_CITY?.trim(),
  }
  if (!e.company || !e.siren || !e.address || !e.representative || !e.city) return null
  return e as EditorIdentity
}

const FONTS = join(__dirname, '..', '..', 'assets', 'fonts')
const INK = BRAND_COLORS.ink
const ACCENT = BRAND_COLORS.accent
const MUTED = '#4A4A4F'

// Périmètre attesté : les fonctions de caisse qui enregistrent les
// règlements des clients particuliers
export const COVERED = [
  'Enregistrement des ventes et des remboursements en caisse, en ligne et hors ligne, sur tablette, téléphone ou ordinateur',
  'Signature de chaque ticket par la caisse (ECDSA P-256) et grand livre du site chaîné par empreintes SHA-256, numérotation continue',
  'Total perpétuel et cumul en valeur absolue, jamais remis à zéro',
  'Clôtures journalières, mensuelles et annuelles cumulatives, scellées et chaînées',
  'Archives périodiques au format ouvert (JSON), datées, scellées et signées par l’éditeur',
  'Journal des événements techniques chaîné, duplicatas numérotés, mode formation identifié',
  'Conservation des données détaillées ligne par ligne, tables protégées en ajout seul',
]

export const NOT_COVERED = [
  'Facturation entre professionnels (factures B2B) et facturation électronique',
  'Commandes internes entre boutiques et laboratoire, gestion des stocks et des produits',
  'Paiements encaissés hors de FLŌW (terminal de paiement autonome non relié)',
]

@Injectable()
export class AttestationService {
  constructor(
    private prisma: PrismaService,
    private keys: SigningKeyService,
    private events: FiscalEventsService,
  ) {}

  editorConfigured() {
    return editorFromEnv() !== null
  }

  // Numéro de licence stable par organisation
  licenceNumber(organizationId: string) {
    return `FLW-${createHash('sha256').update(organizationId).digest('hex').slice(0, 10).toUpperCase()}`
  }

  async generate(organizationId: string, userId: string): Promise<{ filename: string; pdf: Buffer }> {
    const editor = editorFromEnv()
    if (!editor) {
      throw new ServiceUnavailableException(
        'L’attestation n’est pas encore disponible : l’identité de l’éditeur (raison sociale, SIREN, adresse, représentant légal) doit être renseignée dans la configuration du serveur.',
      )
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, createdAt: true, settings: true, users: { where: { role: 'OWNER' }, select: { firstName: true, lastName: true }, take: 1 } },
    })
    if (!org) throw new NotFoundException('Organisation introuvable')
    const firstReceipt = await this.prisma.receiptChain.findFirst({
      where: { site: { organizationId } },
      orderBy: { signedAt: 'asc' },
      select: { signedAt: true },
    })

    const issuedAt = new Date()
    const licence = this.licenceNumber(organizationId)
    const fr = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
    const owner = org.users[0] ? `${org.users[0].lastName.toUpperCase()} ${org.users[0].firstName}` : null
    const s = org.settings
    const merchantAddress = [s?.legalAddress, [s?.legalZipCode, s?.legalCity].filter(Boolean).join(' ')].filter(Boolean).join(', ')

    // Texte du volet 1, signé par la clé de l'éditeur : toute retouche du
    // document se voit en recalculant l'empreinte
    const volet1 = [
      `Je soussigné, ${editor.representative}, représentant légal de la société ${editor.company} (SIREN ${editor.siren}), éditeur du logiciel / système de caisse ${FISCAL_SOFTWARE.name} (logiciel de caisse en ligne), atteste que les fonctionnalités de caisse de ce logiciel, mis sur le marché à compter du ${fr(FISCAL_SOFTWARE.releasedAt)}, dans sa version n° ${FISCAL_SOFTWARE.version}, sous le numéro de licence ${licence}, satisfont aux conditions d’inaltérabilité, de sécurisation, de conservation et d’archivage des données en vue du contrôle de l’administration fiscale, prévues au 3° bis du I de l’article 286 du code général des impôts.`,
      `J’atteste que la dernière version majeure de ce logiciel ou système est identifiée avec la racine suivante : ${FISCAL_SOFTWARE.majorVersion} et que les versions mineures développées ultérieurement à cette version majeure sont ou seront identifiées par les subdivisions suivantes de cette racine : ${FISCAL_SOFTWARE.majorVersion}.x.y. Je m’engage à ce que ces subdivisions ne soient utilisées par ${editor.company} que pour l’identification des versions mineures ultérieures, à l’exclusion de toute version majeure. Les versions majeures et mineures du logiciel ou système s’entendent au sens du III-A § 340 du BOI-TVA-DECLA-30-10-30.`,
    ]
    const signed = [
      volet1.join('\n'),
      'Couvert : ' + COVERED.join(' ; '),
      'Non couvert : ' + NOT_COVERED.join(' ; '),
      `Entreprise utilisatrice : ${org.name} ${s?.siret ?? ''}`,
      `Délivrée le ${issuedAt.toISOString()}`,
    ].join('\n')
    const digest = createHash('sha256').update(signed).digest('hex')
    const { signature, keyId } = await this.keys.sign(signed)

    const pdf = await this.render({ editor, org: { name: org.name, siret: s?.siret ?? null, address: merchantAddress || null, owner }, licence, issuedAt, firstUse: firstReceipt?.signedAt ?? null, acquiredAt: org.createdAt, volet1, digest, signature, keyId, fr })

    await this.events.log({
      organizationId,
      code: 'ATTESTATION_ISSUED',
      userId,
      detail: { version: FISCAL_SOFTWARE.version, licence, digest, keyId },
    })
    return { filename: `attestation-conformite-${FISCAL_SOFTWARE.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}-${FISCAL_SOFTWARE.version}-${licence}.pdf`, pdf }
  }

  private render(a: {
    editor: EditorIdentity
    org: { name: string; siret: string | null; address: string | null; owner: string | null }
    licence: string
    issuedAt: Date
    firstUse: Date | null
    acquiredAt: Date
    volet1: string[]
    digest: string
    signature: string
    keyId: string
    fr: (d: Date | string) => string
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 48, bottom: 40, left: 64, right: 64 },
        info: { Title: 'Attestation individuelle de conformité du logiciel de caisse', Author: a.editor.company, Subject: 'Article 286 I 3° bis du CGI, BOI-LETTRE-000242' },
      })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.registerFont('regular', join(FONTS, 'HankenGrotesk-Regular.ttf'))
      doc.registerFont('medium', join(FONTS, 'HankenGrotesk-Medium.ttf'))
      doc.registerFont('semibold', join(FONTS, 'HankenGrotesk-SemiBold.ttf'))
      const width = doc.page.width - 128

      // Le nom FLŌW dessiné, comme dans l'application
      this.wordmark(doc, 64, 50, 15)
      doc.font('regular').fontSize(8.5).fillColor(MUTED).text('Modèle BOI-LETTRE-000242 (version du 25/03/2026)', 64, 54, { width, align: 'right' })

      doc.font('semibold').fontSize(16).fillColor(INK).text('Attestation individuelle relative à l’utilisation d’un logiciel ou d’un système de caisse sécurisé', 64, 84, { width })
      doc.moveDown(0.6)
      doc.font('regular').fontSize(9.5).fillColor(MUTED).text('Les volets 1 et 2 de cette attestation doivent être présentés à l’administration fiscale en cas de contrôle. Elle n’a de valeur que si son volet 2 est dûment complété et signé par l’entreprise utilisatrice du logiciel / système.', { width })

      const section = (title: string) => {
        doc.moveDown(0.8)
        const y = doc.y
        doc.save().roundedRect(64, y + 3, 22, 4, 2).fill(ACCENT).restore()
        doc.font('semibold').fontSize(12).fillColor(INK).text(title, 94, y - 3, { width: width - 30 })
        doc.moveDown(0.5)
        doc.x = 64
      }
      const para = (text: string, opts: { size?: number; color?: string; font?: string } = {}) => {
        doc.font(opts.font ?? 'regular').fontSize(opts.size ?? 10).fillColor(opts.color ?? INK).text(text, 64, doc.y, { width, lineGap: 2 })
        doc.moveDown(0.5)
      }
      const list = (items: string[]) => {
        for (const it of items) {
          const y = doc.y
          doc.save().circle(68, y + 6.5, 1.8).fill(INK).restore()
          doc.font('regular').fontSize(9.5).fillColor(INK).text(it, 78, y, { width: width - 14, lineGap: 1.5 })
          doc.moveDown(0.15)
        }
        doc.x = 64
        doc.moveDown(0.4)
      }

      section('Volet 1 : partie remplie par l’éditeur du logiciel de caisse')
      a.volet1.forEach((p) => para(p))
      para('Le périmètre couvert par cette attestation concerne les fonctionnalités suivantes :', { font: 'medium' })
      list(COVERED)
      para('Les fonctionnalités suivantes ne sont pas couvertes par cette attestation :', { font: 'medium' })
      list(NOT_COVERED)
      para(`Fait à ${a.editor.city}, le ${a.fr(a.issuedAt)}.`)
      para(`Signature du représentant légal de l’éditeur du logiciel ou système de caisse : ${a.editor.representative}, pour ${a.editor.company}, ${a.editor.address}.`, { font: 'medium' })
      para(
        `Signé électroniquement par la clé de l’éditeur (ECDSA P-256, clé ${a.keyId}). Empreinte SHA-256 du volet 1 : ${a.digest}. Signature : ${a.signature}`,
        { size: 7.5, color: MUTED },
      )
      para('Remarque : il est rappelé que l’établissement d’une fausse attestation est un délit pénal passible de trois ans d’emprisonnement et de 45 000 € d’amende (code pénal, art. 441-1). L’usage d’une fausse attestation est passible des mêmes peines.', { size: 8.5, color: MUTED })

      doc.addPage()
      this.wordmark(doc, 64, 50, 15)
      doc.y = 92
      section('Volet 2 : partie à remplir par l’entreprise qui utilise le logiciel de caisse')
      const blank = '..............................'
      para(
        `Je soussigné, ${a.org.owner ?? blank}, représentant légal de la société ${a.org.name}${a.org.siret ? ` (SIRET ${a.org.siret})` : ''}${a.org.address ? `, ${a.org.address}` : ''}, certifie avoir acquis ou téléchargé le ${a.fr(a.acquiredAt)}, auprès de ${a.editor.company}, le logiciel / système de caisse mentionné au volet 1 de cette attestation (licence ${a.licence}).`,
      )
      para(`J’atteste utiliser ce logiciel / système de caisse pour enregistrer les règlements de mes clients particuliers, conformément à la réglementation fiscale en vigueur, depuis le ${a.firstUse ? a.fr(a.firstUse) : blank}.`)
      para(`Fait à ${blank}, le ${blank}`)
      para('Signature du représentant légal :', { font: 'medium' })
      const y = doc.y + 4
      doc.save().roundedRect(64, y, width, 96, 10).lineWidth(0.8).strokeColor('#B1AFAE').stroke().restore()
      doc.y = y + 110
      para('Remarque : il est rappelé que l’établissement d’une fausse attestation est un délit pénal passible de trois ans d’emprisonnement et de 45 000 € d’amende (C. pén., art. 441-1). L’usage d’une fausse attestation est passible des mêmes peines.', { size: 8.5, color: MUTED })
      para('À conserver avec vos documents comptables et à présenter en cas de contrôle. Une nouvelle attestation est délivrée à chaque nouvelle version majeure du logiciel.', { size: 8.5, color: MUTED })

      doc.end()
    })
  }

  // Logo FLŌW (signe et nom, mêmes tracés que l'application), en points PDF
  private wordmark(doc: PDFKit.PDFDocument, x: number, y: number, cap: number) {
    drawBrandLogo(doc, x, y, cap)
  }
}
