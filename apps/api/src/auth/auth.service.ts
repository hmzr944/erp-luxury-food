import { TRIAL_DAYS } from '@erp/types'
import {
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
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: 'OWNER',
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
      })
      return { org, site, user }
    })
    await this.platform.applySector(org.id, dto.sector)

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
      },
    })

    if (!user) throw new UnauthorizedException('Identifiants invalides')

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Identifiants invalides')

    const { passwordHash: _, ...safeUser } = user
    return { ...this.issue(safeUser), user: safeUser }
  }

  private issue(user: { id: string; email: string; role: string; organizationId: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId }
    const accessToken = this.jwt.sign(payload)
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    })
    return { accessToken, refreshToken }
  }

  async refresh(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, role: true, organizationId: true },
    })

    const payload = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId }
    const accessToken = this.jwt.sign(payload)
    return { accessToken }
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
