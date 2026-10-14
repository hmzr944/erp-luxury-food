import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Prisma } from '@prisma/client'
import { businessDate, businessDayStart } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { MailService, esc } from '../common/mail/mail.service'
import { AuditService } from '../audit/audit.service'
import { DEFAULT_ROUTINE, HHMM, routineStatus, type RoutineConfig, type RoutineTaskConfig } from './routine-plan'

export interface RoutineSettingsInput {
  enabled?: boolean
  closingTime?: string
  supplyDeadline?: string | null
  cashDeadline?: string | null
  days?: number[]
  reminderMinutes?: number
  alertAfterMinutes?: number
  autoLock?: boolean
  notifyEmails?: string[]
  tasks?: Array<{ key?: string; label: string; deadline?: string | null }>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

@Injectable()
export class RoutinesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoutinesService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private audit: AuditService,
    private events: EventEmitter2,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.ROUTINE_ALERTS === 'off') return
    // Toutes les 5 minutes (et une minute après le démarrage) : caisses oubliées après la fermeture
    const run = () => void this.alertAll().catch((e) => this.logger.error(e))
    this.timer = setInterval(run, 5 * 60_000)
    setTimeout(run, 60_000).unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  private config(row: { enabled: boolean; closingTime: string; supplyDeadline: string | null; cashDeadline: string | null; days: number[]; reminderMinutes: number; alertAfterMinutes: number; autoLock: boolean; tasks: Prisma.JsonValue } | null): RoutineConfig {
    if (!row) return DEFAULT_ROUTINE
    return { ...row, tasks: Array.isArray(row.tasks) ? (row.tasks as unknown as RoutineTaskConfig[]) : [] }
  }

  async settings(siteId: string) {
    const row = await this.prisma.siteRoutine.findUnique({ where: { siteId } })
    const site = await this.site(siteId)
    return {
      ...this.config(row),
      notifyEmails: row?.notifyEmails ?? [],
      configured: !!row,
      canOrderSupply: await this.canOrderSupply(siteId, site.organizationId),
    }
  }

  async updateSettings(siteId: string, dto: RoutineSettingsInput) {
    await this.site(siteId)
    for (const t of [dto.closingTime, dto.supplyDeadline, dto.cashDeadline, ...(dto.tasks ?? []).map((x) => x.deadline)]) {
      if (t != null && t !== '' && !HHMM.test(t)) throw new BadRequestException(`Heure invalide : ${t} (format HH:MM)`)
    }
    if (dto.days && (dto.days.length === 0 || dto.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7))) throw new BadRequestException('Jours d’ouverture invalides')
    const emails = dto.notifyEmails?.map((e) => e.trim().toLowerCase()).filter(Boolean)
    if (emails?.some((e) => !EMAIL.test(e))) throw new BadRequestException('Adresse e-mail d’alerte invalide')
    const tasks = dto.tasks
      ?.filter((t) => t.label?.trim())
      .slice(0, 12)
      .map((t, i) => ({ key: t.key && /^[a-z0-9-]{1,40}$/.test(t.key) && !['cash', 'supply'].includes(t.key) ? t.key : `tache-${Date.now().toString(36)}-${i}`, label: t.label.trim().slice(0, 80), deadline: t.deadline || null }))
    const data = {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.closingTime ? { closingTime: dto.closingTime } : {}),
      ...(dto.supplyDeadline !== undefined ? { supplyDeadline: dto.supplyDeadline || null } : {}),
      ...(dto.cashDeadline !== undefined ? { cashDeadline: dto.cashDeadline || null } : {}),
      ...(dto.days ? { days: [...new Set(dto.days)].sort() } : {}),
      ...(dto.reminderMinutes !== undefined ? { reminderMinutes: Math.min(120, Math.max(5, Math.round(dto.reminderMinutes))) } : {}),
      ...(dto.alertAfterMinutes !== undefined ? { alertAfterMinutes: Math.min(360, Math.max(15, Math.round(dto.alertAfterMinutes))) } : {}),
      ...(dto.autoLock !== undefined ? { autoLock: dto.autoLock } : {}),
      ...(emails ? { notifyEmails: emails.slice(0, 5) } : {}),
      ...(tasks ? { tasks: tasks as unknown as Prisma.InputJsonValue } : {}),
    }
    await this.prisma.siteRoutine.upsert({ where: { siteId }, create: { siteId, enabled: true, ...data }, update: data })
    return this.settings(siteId)
  }

  async status(siteId: string, now = new Date()) {
    const site = await this.site(siteId)
    const row = await this.prisma.siteRoutine.findUnique({ where: { siteId } })
    const config = this.config(row)
    const day = businessDate(now, site.timezone)
    const dayStart = businessDayStart(day, site.timezone)
    const [canOrderSupply, supply, openCash, lastClosed, checks] = await Promise.all([
      config.supplyDeadline ? this.canOrderSupply(siteId, site.organizationId) : Promise.resolve(false),
      this.prisma.supplyOrder.findFirst({ where: { fromSiteId: siteId, sentAt: { gte: dayStart } }, orderBy: { sentAt: 'asc' }, select: { sentAt: true } }),
      this.prisma.cashSession.count({ where: { siteId, status: 'OPEN' } }),
      this.prisma.cashSession.findFirst({ where: { siteId, status: 'CLOSED', closedAt: { gte: dayStart } }, orderBy: { closedAt: 'desc' }, select: { closedAt: true } }),
      this.prisma.routineCheck.findMany({ where: { siteId, day } }),
    ])
    return routineStatus(now, site.timezone, config, {
      canOrderSupply,
      supplySentAt: supply?.sentAt ?? null,
      openCash,
      lastCashClosedAt: lastClosed?.closedAt ?? null,
      checks: Object.fromEntries(checks.map((c) => [c.key, { doneAt: c.doneAt, userName: c.userName }])),
    })
  }

  // Tâche libre cochée (ou décochée) sur la caisse
  async check(siteId: string, key: string, done: boolean, user: { id: string }) {
    const status = await this.status(siteId)
    const task = status.tasks.find((t) => t.key === key && t.kind === 'CUSTOM')
    if (!task) throw new NotFoundException('Tâche inconnue')
    if (done) {
      const who = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true } })
      const userName = [who?.firstName, who?.lastName?.[0] ? `${who.lastName[0]}.` : null].filter(Boolean).join(' ') || null
      await this.prisma.routineCheck.upsert({ where: { siteId_day_key: { siteId, day: status.day, key } }, create: { siteId, day: status.day, key, userId: user.id, userName }, update: {} })
    } else {
      await this.prisma.routineCheck.deleteMany({ where: { siteId, day: status.day, key } })
    }
    return this.status(siteId)
  }

  // Alerte au gérant : caisse restée ouverte longtemps après la fermeture
  async alertAll(now = new Date()) {
    const routines = await this.prisma.siteRoutine.findMany({ where: { enabled: true }, select: { siteId: true } })
    for (const { siteId } of routines) {
      try {
        await this.alertSite(siteId, now)
      } catch (e) {
        this.logger.warn(`Routine du site ${siteId} : ${(e as Error).message}`)
      }
    }
  }

  async alertSite(siteId: string, now = new Date()) {
    const status = await this.status(siteId, now)
    if (status.level !== 3) return null
    const exists = await this.prisma.routineAlert.findUnique({ where: { siteId_day_kind: { siteId, day: status.day, kind: 'UNCLOSED' } } })
    if (exists) return null
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, organizationId: true, routine: { select: { notifyEmails: true } } } })
    let recipients = site.routine?.notifyEmails ?? []
    if (!recipients.length) {
      const managers = await this.prisma.user.findMany({
        where: { organizationId: site.organizationId, role: { in: ['OWNER', 'MANAGER'] }, OR: [{ role: 'OWNER' }, { sites: { some: { siteId } } }] },
        select: { email: true },
      })
      recipients = managers.map((m) => m.email)
    }
    // Enregistrée d'abord : une seule alerte par soir, même si deux serveurs tournent
    try {
      await this.prisma.routineAlert.create({ data: { siteId, day: status.day, kind: 'UNCLOSED', recipients } })
    } catch {
      return null
    }
    const pending = status.tasks.filter((t) => !t.done).map((t) => t.label)
    const subject = `La caisse ${site.name} n’a pas été clôturée ce soir`
    if (recipients.length) {
      await this.mail.send({
        to: recipients,
        subject,
        text: `Attention : la caisse ${site.name} est restée ouverte après la fermeture.\n\nÀ faire : ${pending.join(', ')}.\n\nElle s’est verrouillée : un vendeur pourra la clôturer avec son code, ou demain matin avant d’ouvrir.`,
        html: `<p><strong>Attention : la caisse ${esc(site.name)} est restée ouverte après la fermeture.</strong></p><p>À faire : ${pending.map(esc).join(', ')}.</p><p>Elle s’est verrouillée : un vendeur pourra la clôturer avec son code, ou demain matin avant d’ouvrir.</p>`,
      })
    }
    await this.audit.log({ organizationId: site.organizationId, action: 'routine.unclosed_alert', target: siteId, detail: `${status.day} : ${pending.join(', ')} (alerte à ${recipients.join(', ') || 'personne'})` })
    // Écrans ouverts (gérant, caisses) : alerte en direct
    this.events.emit('routine.alert', { siteId, day: status.day, pending })
    return { day: status.day, recipients }
  }

  private async canOrderSupply(siteId: string, organizationId: string) {
    return (await this.prisma.site.count({ where: { organizationId, isSupplier: true, id: { not: siteId } } })) > 0
  }

  private async site(siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { id: true, organizationId: true, timezone: true } })
    if (!site) throw new NotFoundException('Site introuvable')
    return site
  }
}
