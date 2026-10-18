import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes } from 'node:crypto'
import { PrismaService } from '../common/prisma/prisma.service'
import { MailService, esc } from '../common/mail/mail.service'
import { AuditService } from '../audit/audit.service'
import { AuthService } from './auth.service'

export const RESET_TTL_MS = 60 * 60_000
const INVALID = 'Ce lien n’est plus valable : demandez-en un nouveau.'

// Seule l'empreinte du jeton est en base : une fuite de la table ne permet
// pas de changer un mot de passe
export const resetTokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

export function newResetToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: resetTokenHash(token) }
}

// Mot de passe oublié : lien par e-mail, valable une heure, une seule fois
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
    private audit: AuditService,
    private auth: AuthService,
  ) {}

  // Même réponse, et aussi vite, que le compte existe ou non : l'envoi se
  // fait après la réponse
  forgot(email: string) {
    void this.sendLink(email).catch((e) => this.logger.error(`Lien de mot de passe non envoyé : ${(e as Error).message}`))
  }

  async sendLink(email: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, firstName: true, organizationId: true },
    })
    if (!user) return
    const { token, tokenHash } = newResetToken()
    // Un seul lien à la fois : le dernier demandé
    await this.prisma.$transaction([
      this.prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordReset.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(now.getTime() + RESET_TTL_MS) } }),
    ])
    const link = `${this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'}/mot-de-passe/nouveau?token=${token}`
    const hello = user.firstName ? `Bonjour ${user.firstName},` : 'Bonjour,'
    const result = await this.mail.send({
      to: user.email,
      subject: 'Choisir un nouveau mot de passe FLŌW',
      text: [
        hello,
        '',
        'Vous avez demandé à changer le mot de passe de votre compte FLŌW. Ouvrez ce lien pour en choisir un nouveau :',
        link,
        '',
        'Le lien marche une seule fois, pendant une heure.',
        'Si vous n’avez rien demandé, ignorez ce message : votre mot de passe reste le même.',
      ].join('\n'),
      html: [
        `<p>${esc(hello)}</p>`,
        '<p>Vous avez demandé à changer le mot de passe de votre compte FLŌW.</p>',
        `<p><a href="${esc(link)}">Choisir un nouveau mot de passe</a></p>`,
        '<p>Le lien marche une seule fois, pendant une heure.</p>',
        '<p>Si vous n’avez rien demandé, ignorez ce message : votre mot de passe reste le même.</p>',
      ].join(''),
    })
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'auth.password_reset_requested',
      detail: result.sent ? null : `E-mail non envoyé : ${result.reason}`,
    })
  }

  // Nouveau mot de passe : toutes les sessions ouvertes sont déconnectées
  async reset(token: string, password: string, now = new Date()) {
    const tokenHash = resetTokenHash(token)
    const row = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { organizationId: true } } },
    })
    if (!row || row.usedAt || row.expiresAt <= now) throw new BadRequestException(INVALID)
    const passwordHash = await this.auth.hashPassword(password)
    // Usage unique, même si le lien est ouvert deux fois en même temps
    const done = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordReset.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
      if (!count) return false
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } })
      return true
    })
    if (!done) throw new BadRequestException(INVALID)
    await this.audit.log({ organizationId: row.user.organizationId, userId: row.userId, action: 'auth.password_reset', target: row.userId })
  }
}
