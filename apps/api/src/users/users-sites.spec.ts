import { describe, expect, it, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { Role } from '@erp/types'
import { UsersService } from './users.service'
import { SiteGuard } from '../common/guards/site.guard'
import { UsersController } from './users.controller'

const OWNER = { id: 'o1', organizationId: 'org1', role: Role.OWNER }
const MANAGER = { id: 'm1', organizationId: 'org1', role: Role.MANAGER }

function setup(opts: { role?: string; current?: string[]; orgSites?: string[] } = {}) {
  let links = [...(opts.current ?? ['s1'])]
  const orgSites = opts.orgSites ?? ['s1', 's2', 's3']
  const tx = {
    userSite: {
      findMany: vi.fn(async () => links.map((siteId) => ({ siteId }))),
      deleteMany: vi.fn(async ({ where }: { where: { siteId: { notIn: string[] } } }) => {
        links = links.filter((s) => where.siteId.notIn.includes(s))
      }),
      createMany: vi.fn(async ({ data }: { data: Array<{ siteId: string }> }) => {
        links.push(...data.map((d) => d.siteId))
      }),
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    user: { findFirst: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'u1' ? { id: 'u1', role: opts.role ?? 'SELLER', email: 'a@b.test' } : null)) },
    site: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.filter((i) => orgSites.includes(i)).map((id) => ({ id }))) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  }
  const audit = { log: vi.fn(async () => undefined) }
  const service = new UsersService(prisma, {} as never, audit as never)
  return { service, prisma, audit, tx, links: () => links }
}

describe('UsersService.setSites', () => {
  it('remplace les boutiques et écrit l’audit avec l’avant et l’après', async () => {
    const { service, audit, links } = setup({ current: ['s1', 's2'] })
    const r = await service.setSites(OWNER, 'u1', ['s2', 's3', 's3'])
    expect(r.siteIds).toEqual(['s2', 's3'])
    expect(links().sort()).toEqual(['s2', 's3'])
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1', userId: 'o1', action: 'user.sites_changed', target: 'u1', detail: 'avant : s1, s2 ; après : s2, s3' }),
    )
  })

  it('refuse un site d’une autre organisation, sans rien écrire', async () => {
    const { service, prisma, audit } = setup()
    await expect(service.setSites(OWNER, 'u1', ['s1', 'autre-org'])).rejects.toThrow('Site inconnu')
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(audit.log).not.toHaveBeenCalled()
  })

  it('refuse un utilisateur d’une autre organisation', async () => {
    const { service } = setup()
    await expect(service.setSites(OWNER, 'inconnu', ['s1'])).rejects.toThrow('Utilisateur introuvable')
  })

  it('refuse zéro boutique', async () => {
    const { service, prisma } = setup()
    await expect(service.setSites(OWNER, 'u1', [])).rejects.toThrow('Au moins une boutique')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuse un gérant, même sur lui-même', async () => {
    const { service, prisma } = setup()
    await expect(service.setSites(MANAGER, 'u1', ['s1'])).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('route réservée au titulaire (RolesGuard)', () => {
    const roles = Reflect.getMetadata('roles', UsersController.prototype.setSites)
    expect(roles).toEqual(['OWNER'])
  })

  it('titulaire et gérant ont déjà toutes les boutiques : erreur claire', async () => {
    for (const role of ['OWNER', 'MANAGER']) {
      const { service, prisma } = setup({ role })
      await expect(service.setSites(OWNER, 'u1', ['s1'])).rejects.toThrow('toutes les boutiques')
      expect(prisma.$transaction).not.toHaveBeenCalled()
    }
  })
})

describe('SiteGuard après retrait', () => {
  const ctx = (siteId: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', role: 'SELLER', organizationId: 'org1' }, params: { siteId } }) }) }) as never

  it('relit UserSite à chaque requête : un vendeur retiré est refusé aussitôt, sans nouveau jeton', async () => {
    let links = ['s1', 's2']
    const prisma: any = {
      site: { findUnique: vi.fn(async () => ({ organizationId: 'org1' })) },
      userSite: { findUnique: vi.fn(async ({ where }: any) => (links.includes(where.userId_siteId.siteId) ? { siteId: where.userId_siteId.siteId } : null)) },
    }
    const guard = new SiteGuard(prisma)
    expect(await guard.canActivate(ctx('s2'))).toBe(true)
    links = ['s1']
    await expect(guard.canActivate(ctx('s2'))).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.userSite.findUnique).toHaveBeenCalledTimes(2)
  })

  it('la synchronisation de ventes signées reste ouverte à un vendeur retiré, de la même organisation seulement', async () => {
    const prisma: any = {
      site: { findUnique: vi.fn(async () => ({ organizationId: 'org1' })) },
      userSite: { findUnique: vi.fn(async () => null) },
    }
    const reflector: any = { getAllAndOverride: vi.fn(() => true) }
    const guard = new SiteGuard(prisma, reflector)
    const routeCtx = (siteId: string) => ({ ...(ctx(siteId) as object), getHandler: () => ({}), getClass: () => ({}) }) as never
    expect(await guard.canActivate(routeCtx('s2'))).toBe(true)
    expect(prisma.userSite.findUnique).not.toHaveBeenCalled()
    // Autre organisation : refusé même sur la route de synchronisation
    prisma.site.findUnique = vi.fn(async () => ({ organizationId: 'autre' }))
    await expect(guard.canActivate(routeCtx('s2'))).rejects.toBeInstanceOf(ForbiddenException)
  })
})
