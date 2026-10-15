import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma, SupportStatus } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { MailService, esc } from '../common/mail/mail.service'
import { AuditService } from '../audit/audit.service'
import { SupportConfig } from './support.config'
import { dueAt, isOpen, nextOpening } from './support-hours'
import { compareQueue, isOverdue } from './support-queue'
import type { AgentReplyDto, CreateThreadDto } from './support.dto'

export interface SupportUser {
  id: string
  email?: string
  role: string
  organizationId: string
}

// Champs d'un message visibles du commerçant : jamais l'identifiant du
// membre de l'équipe (compte d'une autre organisation)
const MESSAGE_SELECT = { id: true, author: true, authorName: true, body: true, createdAt: true, readAt: true } as const

const THREAD_SELECT = {
  id: true,
  siteId: true,
  userId: true,
  subject: true,
  status: true,
  priority: true,
  dueAt: true,
  firstResponseAt: true,
  slaMet: true,
  lastMessageAt: true,
  createdAt: true,
} as const

export const AGENT_LABEL = 'Équipe FLŌW'

const when = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone }).format(d)

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private audit: AuditService,
    private config: SupportConfig,
  ) {}

  // --- Commerçant ------------------------------------------------------

  async status(user: SupportUser, now = new Date()) {
    const c = this.config
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscriptionStatus: true, trialEndsAt: true },
    })
    const inTrial = org?.subscriptionStatus === 'TRIALING' && (!org.trialEndsAt || org.trialEndsAt > now)
    const openNow = isOpen(now, c.schedule, c.timeZone)
    return {
      timeZone: c.timeZone,
      // null : délai non annoncé (horaires mal configurés)
      slaMinutes: c.valid ? c.slaMinutes : null,
      urgentSlaMinutes: c.valid ? c.urgentSlaMinutes : null,
      promise: c.promise('NORMAL'),
      urgentPromise: c.promise('URGENT'),
      hoursConfigured: !!c.schedule,
      openNow,
      nextOpenAt: openNow ? null : nextOpening(now, c.schedule, c.timeZone).toISOString(),
      // Contact nommé pendant l'essai, seulement s'il est configuré
      trialContact: inTrial ? c.trialContact : null,
      isAgent: await this.isAgent(user.id),
    }
  }

  async isAgent(userId: string) {
    if (!this.config.agentEmails.length) return false
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    return this.config.isAgentEmail(u?.email)
  }

  async create(user: SupportUser, dto: CreateThreadDto, now = new Date()) {
    const priority = dto.priority ?? 'NORMAL'
    const author = await this.userInfo(user.id)
    // Boutique : seulement une boutique de l'organisation
    const site = dto.siteId
      ? await this.prisma.site.findFirst({ where: { id: dto.siteId, organizationId: user.organizationId }, select: { id: true, name: true } })
      : null
    const { minutes, schedule } = this.config.slaFor(priority)
    const due = dueAt(now, minutes, schedule, this.config.timeZone)
    const context = { ...(dto.context ?? {}), ...(site ? { siteName: site.name } : {}), role: user.role } as Prisma.InputJsonValue

    const thread = await this.prisma.supportThread.create({
      data: {
        organizationId: user.organizationId,
        siteId: site?.id ?? null,
        userId: user.id,
        subject: dto.subject.replace(/\s+/g, ' ').trim(),
        priority,
        dueAt: due,
        lastMessageAt: now,
        context,
        messages: {
          create: [
            { author: 'USER', authorId: user.id, authorName: author.name, body: dto.body.trim(), createdAt: now },
            {
              author: 'SYSTEM',
              authorName: AGENT_LABEL,
              body: this.config.valid
                ? `Demande reçue. Réponse attendue avant ${when(due, this.config.timeZone)}.`
                : 'Demande reçue. L’équipe vous répond ici.',
              createdAt: new Date(now.getTime() + 1),
              readAt: now,
            },
          ],
        },
      },
      select: { id: true },
    })

    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: priority === 'URGENT' ? 'support.urgent_created' : 'support.thread_created',
      target: thread.id,
      detail: dto.subject.slice(0, 200),
    })
    void this.notifyTeam(thread.id, 'new')
    return this.get(user.organizationId, thread.id)
  }

  async list(organizationId: string) {
    const threads = await this.prisma.supportThread.findMany({
      where: { organizationId },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      select: {
        ...THREAD_SELECT,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: MESSAGE_SELECT },
        _count: { select: { messages: { where: { author: { in: ['AGENT'] }, readAt: null } } } },
      },
    })
    return threads.map(({ messages, _count, ...t }) => ({
      ...this.forMerchant(t),
      lastMessage: messages[0] ?? null,
      unread: _count.messages,
    }))
  }

  // Réponses non lues de l'équipe, pour la pastille du menu
  async unread(organizationId: string) {
    const count = await this.prisma.supportMessage.count({
      where: { author: 'AGENT', readAt: null, thread: { organizationId } },
    })
    return { count }
  }

  async get(organizationId: string, id: string) {
    const t = await this.prisma.supportThread.findFirst({
      where: { id, organizationId },
      select: { ...THREAD_SELECT, context: true, messages: { orderBy: { createdAt: 'asc' }, select: MESSAGE_SELECT } },
    })
    if (!t) throw new NotFoundException('Demande introuvable')
    return this.forMerchant(t)
  }

  async post(user: SupportUser, id: string, body: string, now = new Date()) {
    const t = await this.prisma.supportThread.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true, status: true, priority: true, dueAt: true },
    })
    if (!t) throw new NotFoundException('Demande introuvable')
    const author = await this.userInfo(user.id)
    // L'équipe avait répondu ou clos : la demande repart chez elle, avec
    // une nouvelle échéance. Déjà ouverte : l'échéance reste la même.
    const reopen = t.status !== 'OPEN'
    const { minutes, schedule } = this.config.slaFor(t.priority)
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { threadId: id, author: 'USER', authorId: user.id, authorName: author.name, body: body.trim(), createdAt: now } }),
      this.prisma.supportThread.update({
        where: { id },
        data: { lastMessageAt: now, ...(reopen ? { status: 'OPEN', dueAt: dueAt(now, minutes, schedule, this.config.timeZone) } : {}) },
      }),
    ])
    void this.notifyTeam(id, 'message')
    return this.get(user.organizationId, id)
  }

  async markRead(organizationId: string, id: string, now = new Date()) {
    const t = await this.prisma.supportThread.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!t) throw new NotFoundException('Demande introuvable')
    await this.prisma.supportMessage.updateMany({ where: { threadId: id, author: { in: ['AGENT', 'SYSTEM'] }, readAt: null }, data: { readAt: now } })
    return { ok: true }
  }

  // --- Équipe FLŌW -----------------------------------------------------

  async agentList(filter: 'active' | 'all' | 'RESOLVED' = 'active', now = new Date()) {
    const where: Prisma.SupportThreadWhereInput =
      filter === 'all' ? {} : filter === 'RESOLVED' ? { status: 'RESOLVED' } : { status: { in: ['OPEN', 'WAITING_CUSTOMER'] } }
    const threads = await this.prisma.supportThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 300,
      select: {
        ...THREAD_SELECT,
        organizationId: true,
        context: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: MESSAGE_SELECT },
        _count: { select: { messages: { where: { author: 'USER', readAt: null } } } },
      },
    })
    const names = await this.names(threads)
    return threads
      .sort(compareQueue)
      .map(({ messages, _count, ...t }) => ({
        ...t,
        ...names(t),
        overdue: isOverdue(t, now),
        lastMessage: messages[0] ?? null,
        unread: _count.messages,
      }))
  }

  async agentGet(id: string, now = new Date()) {
    const t = await this.prisma.supportThread.findUnique({
      where: { id },
      select: { ...THREAD_SELECT, organizationId: true, context: true, messages: { orderBy: { createdAt: 'asc' }, select: MESSAGE_SELECT } },
    })
    if (!t) throw new NotFoundException('Demande introuvable')
    // L'équipe a ouvert la demande : les messages du commerçant sont lus
    await this.prisma.supportMessage.updateMany({ where: { threadId: id, author: 'USER', readAt: null }, data: { readAt: now } })
    const names = await this.names([t])
    const org = await this.prisma.organization.findUnique({
      where: { id: t.organizationId },
      select: { plan: true, subscriptionStatus: true, trialEndsAt: true, sector: true },
    })
    return { ...t, ...names(t), organization: org, overdue: isOverdue(t, now) }
  }

  async agentReply(agent: SupportUser, id: string, dto: AgentReplyDto, now = new Date()) {
    const t = await this.prisma.supportThread.findUnique({
      where: { id },
      select: { id: true, organizationId: true, userId: true, subject: true, dueAt: true, firstResponseAt: true },
    })
    if (!t) throw new NotFoundException('Demande introuvable')
    const author = await this.userInfo(agent.id)
    const status: SupportStatus = dto.status ?? 'WAITING_CUSTOMER'
    const first = !t.firstResponseAt
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { threadId: id, author: 'AGENT', authorId: agent.id, authorName: author.firstName || AGENT_LABEL, body: dto.body.trim(), createdAt: now } }),
      this.prisma.supportThread.update({
        where: { id },
        data: {
          status,
          lastMessageAt: now,
          ...(first ? { firstResponseAt: now, slaMet: now <= t.dueAt } : {}),
        },
      }),
    ])
    await this.audit.log({ organizationId: t.organizationId, userId: agent.id, action: 'support.agent_reply', target: id, detail: first ? `Première réponse${now <= t.dueAt ? ' dans le délai' : ' hors délai'}` : null })
    void this.notifyMerchant(t.userId, t.subject, dto.body)
    return this.agentGet(id, now)
  }

  async agentStatus(agent: SupportUser, id: string, status: SupportStatus, now = new Date()) {
    const t = await this.prisma.supportThread.findUnique({ where: { id }, select: { id: true, organizationId: true, status: true, priority: true } })
    if (!t) throw new NotFoundException('Demande introuvable')
    if (t.status !== status) {
      const { minutes, schedule } = this.config.slaFor(t.priority)
      const note =
        status === 'RESOLVED'
          ? 'Demande marquée comme résolue. Écrivez ici si le problème revient.'
          : status === 'OPEN'
            ? 'Demande rouverte par l’équipe.'
            : null
      await this.prisma.$transaction([
        this.prisma.supportThread.update({
          where: { id },
          data: { status, ...(status === 'OPEN' ? { dueAt: dueAt(now, minutes, schedule, this.config.timeZone) } : {}) },
        }),
        ...(note ? [this.prisma.supportMessage.create({ data: { threadId: id, author: 'SYSTEM', authorName: AGENT_LABEL, body: note, createdAt: now } })] : []),
      ])
      await this.audit.log({ organizationId: t.organizationId, userId: agent.id, action: 'support.status_changed', target: id, detail: `${t.status} → ${status}` })
    }
    return this.agentGet(id, now)
  }

  // --- Interne ---------------------------------------------------------

  private forMerchant<T extends { dueAt: Date; status: SupportStatus }>(t: T) {
    // Échéance montrée seulement quand l'équipe doit une réponse et qu'un
    // délai est réellement annoncé
    return { ...t, dueAt: this.config.valid && t.status === 'OPEN' ? t.dueAt : null }
  }

  private async userInfo(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true } })
    const firstName = u?.firstName ?? ''
    return { firstName, name: [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Commerçant', email: u?.email ?? null }
  }

  // Noms de l'organisation, de la personne et de la boutique pour l'équipe
  private async names(threads: Array<{ organizationId: string; userId: string; siteId: string | null }>) {
    const uniq = (xs: Array<string | null>) => [...new Set(xs.filter((x): x is string => !!x))]
    const [orgs, users, sites] = await Promise.all([
      this.prisma.organization.findMany({ where: { id: { in: uniq(threads.map((t) => t.organizationId)) } }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { id: { in: uniq(threads.map((t) => t.userId)) } }, select: { id: true, firstName: true, lastName: true, email: true, role: true } }),
      this.prisma.site.findMany({ where: { id: { in: uniq(threads.map((t) => t.siteId)) } }, select: { id: true, name: true } }),
    ])
    return (t: { organizationId: string; userId: string; siteId: string | null }) => {
      const u = users.find((x) => x.id === t.userId)
      return {
        organizationName: orgs.find((x) => x.id === t.organizationId)?.name ?? null,
        siteName: sites.find((x) => x.id === t.siteId)?.name ?? null,
        user: u ? { name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, role: u.role } : null,
      }
    }
  }

  private async notifyTeam(threadId: string, kind: 'new' | 'message') {
    try {
      if (!this.config.teamEmails.length) return
      const t = await this.prisma.supportThread.findUnique({
        where: { id: threadId },
        select: { ...THREAD_SELECT, organizationId: true, context: true, messages: { orderBy: { createdAt: 'desc' }, where: { author: 'USER' }, take: 1, select: MESSAGE_SELECT } },
      })
      if (!t) return
      const n = (await this.names([t]))(t)
      const urgent = t.priority === 'URGENT'
      const due = when(t.dueAt, this.config.timeZone)
      const link = `${this.config.frontendUrl}/support-team?demande=${t.id}`
      const body = t.messages[0]?.body ?? ''
      const ctx = (t.context ?? {}) as Record<string, unknown>
      const ctxLines = [
        ['Boutique', n.siteName],
        ['Caisse', ctx.terminalName],
        ['Page', ctx.page],
        ['Réseau', ctx.online === false ? 'hors ligne' : ctx.online === true ? 'en ligne' : null],
        ['Version', ctx.appVersion],
      ].filter(([, v]) => v) as Array<[string, string]>
      const head = `${urgent ? '[URGENT] ' : ''}${kind === 'new' ? 'Nouvelle demande' : 'Nouveau message'} : ${t.subject}`
      const who = `${n.user?.name ?? 'Commerçant'} (${n.organizationName ?? 'organisation inconnue'})`
      await this.mail.send({
        to: this.config.teamEmails,
        subject: head,
        replyTo: n.user?.email,
        text: [`${who}`, `Réponse attendue avant ${due}`, '', body, '', ...ctxLines.map(([k, v]) => `${k} : ${v}`), '', link].join('\n'),
        html: [
          `<p><strong>${esc(who)}</strong><br>Réponse attendue avant ${esc(due)}</p>`,
          `<blockquote style="white-space:pre-wrap">${esc(body)}</blockquote>`,
          ctxLines.length ? `<p>${ctxLines.map(([k, v]) => `${esc(k)} : ${esc(String(v))}`).join('<br>')}</p>` : '',
          `<p><a href="${esc(link)}">Ouvrir la demande</a></p>`,
        ].join(''),
      })
    } catch (e) {
      this.logger.error(`Alerte support non envoyée : ${(e as Error).message}`)
    }
  }

  private async notifyMerchant(userId: string, subject: string, body: string) {
    try {
      const u = await this.userInfo(userId)
      if (!u.email) return
      const link = this.config.frontendUrl
      await this.mail.send({
        to: u.email,
        subject: `Réponse de l’équipe FLŌW : ${subject}`,
        text: [`Bonjour ${u.firstName},`, '', body, '', 'Pour répondre, ouvrez FLŌW puis « Aide et support ».', link].join('\n'),
        html: [
          `<p>Bonjour ${esc(u.firstName)},</p>`,
          `<blockquote style="white-space:pre-wrap">${esc(body)}</blockquote>`,
          `<p>Pour répondre, ouvrez FLŌW puis « Aide et support ».</p>`,
          `<p><a href="${esc(link)}">Ouvrir FLŌW</a></p>`,
        ].join(''),
      })
    } catch (e) {
      this.logger.error(`Réponse du support non envoyée par e-mail : ${(e as Error).message}`)
    }
  }
}
