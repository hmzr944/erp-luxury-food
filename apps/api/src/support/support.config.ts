import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SUPPORT_TZ, describePromise, emailList, parseSupportHours, positiveMinutes, type SupportSchedule } from './support-hours'

// Réglages du support lus une fois au démarrage. Le délai annoncé est une
// promesse commerciale : il vient de l'environnement, jamais du code.
@Injectable()
export class SupportConfig {
  private readonly logger = new Logger(SupportConfig.name)
  readonly timeZone = SUPPORT_TZ
  readonly slaMinutes: number
  readonly urgentSlaMinutes: number
  readonly schedule: SupportSchedule
  readonly urgentSchedule: SupportSchedule
  // Horaires illisibles : on n'annonce aucun délai plutôt qu'un faux
  readonly valid: boolean
  readonly teamEmails: string[]
  readonly agentEmails: string[]
  readonly trialContact: { name: string; phone: string | null } | null
  readonly frontendUrl: string

  constructor(config: ConfigService) {
    this.slaMinutes = positiveMinutes(config.get('SUPPORT_SLA_MINUTES'), 120)
    this.urgentSlaMinutes = positiveMinutes(config.get('SUPPORT_URGENT_SLA_MINUTES'), 30)
    let schedule: SupportSchedule = null
    let urgentSchedule: SupportSchedule = null
    let valid = true
    try {
      schedule = parseSupportHours(config.get('SUPPORT_HOURS'))
      const urgentRaw = config.get<string>('SUPPORT_URGENT_HOURS')
      urgentSchedule = urgentRaw?.trim() ? parseSupportHours(urgentRaw) : schedule
    } catch (e) {
      valid = false
      this.logger.error(`${(e as Error).message}. Aucun délai de réponse ne sera annoncé tant que ce réglage n'est pas corrigé.`)
    }
    this.schedule = schedule
    this.urgentSchedule = urgentSchedule
    this.valid = valid
    this.teamEmails = emailList(config.get('SUPPORT_TEAM_EMAILS'))
    this.agentEmails = emailList(config.get('SUPPORT_AGENT_EMAILS'))
    const name = config.get<string>('SUPPORT_TRIAL_CONTACT_NAME')?.trim()
    const phone = config.get<string>('SUPPORT_TRIAL_CONTACT_PHONE')?.trim()
    this.trialContact = name ? { name, phone: phone || null } : null
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
  }

  isAgentEmail(email: string | null | undefined) {
    return !!email && this.agentEmails.includes(email.trim().toLowerCase())
  }

  slaFor(priority: 'NORMAL' | 'URGENT') {
    return priority === 'URGENT'
      ? { minutes: this.urgentSlaMinutes, schedule: this.urgentSchedule }
      : { minutes: this.slaMinutes, schedule: this.schedule }
  }

  promise(priority: 'NORMAL' | 'URGENT' = 'NORMAL'): string | null {
    if (!this.valid) return null
    const { minutes, schedule } = this.slaFor(priority)
    return describePromise(minutes, schedule)
  }
}
