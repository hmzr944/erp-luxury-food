// Ordre de la file de l'équipe : ce qui attend une réponse d'abord, les
// urgences avant le reste, puis l'échéance la plus proche.
export interface QueueItem {
  status: 'OPEN' | 'WAITING_CUSTOMER' | 'RESOLVED'
  priority: 'NORMAL' | 'URGENT'
  dueAt: Date
  lastMessageAt: Date
}

const STATUS_RANK = { OPEN: 0, WAITING_CUSTOMER: 1, RESOLVED: 2 } as const

export function compareQueue(a: QueueItem, b: QueueItem): number {
  if (a.status !== b.status) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
  if (a.status === 'OPEN') {
    if (a.priority !== b.priority) return a.priority === 'URGENT' ? -1 : 1
    return a.dueAt.getTime() - b.dueAt.getTime()
  }
  // En attente du commerçant ou résolu : le plus récent d'abord
  return b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
}

// En retard : l'équipe doit une réponse et l'échéance est passée
export const isOverdue = (t: Pick<QueueItem, 'status' | 'dueAt'>, now: Date) => t.status === 'OPEN' && t.dueAt < now
