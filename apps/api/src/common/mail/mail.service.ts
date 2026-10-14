import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

export interface MailAttachment {
  filename: string
  content: Buffer
}

export interface MailInput {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  attachments?: MailAttachment[]
}

export type MailResult = { sent: true; id?: string } | { sent: false; reason: string }

// Envoi d'e-mails par Resend (RESEND_API_KEY, RESEND_FROM). Sans clé, rien
// ne part : le message est seulement journalisé, et l'appelant le sait.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly client: Resend | null
  private readonly from: string

  constructor(config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY')
    this.client = key && !key.startsWith('your-') ? new Resend(key) : null
    this.from = config.get<string>('RESEND_FROM') ?? 'FLŌW <noreply@flow.local>'
  }

  get enabled() {
    return !!this.client
  }

  async send(mail: MailInput): Promise<MailResult> {
    if (!this.client) {
      this.logger.warn(`E-mail non envoyé (RESEND_API_KEY absente) : « ${mail.subject} » à ${[mail.to].flat().join(', ')}`)
      return { sent: false, reason: 'L’envoi d’e-mails n’est pas configuré sur ce serveur.' }
    }
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
        ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
      })
      if (error) {
        this.logger.error(`Resend : ${error.message}`)
        return { sent: false, reason: 'L’e-mail n’a pas pu partir. Réessayez dans un instant.' }
      }
      return { sent: true, id: data?.id }
    } catch (e) {
      this.logger.error(`Resend : ${(e as Error).message}`)
      return { sent: false, reason: 'L’e-mail n’a pas pu partir. Réessayez dans un instant.' }
    }
  }
}

// Échappement HTML des valeurs insérées dans les e-mails
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
