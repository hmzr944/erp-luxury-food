import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { RegisterDto } from './dto/register.dto'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { PinLoginDto } from './dto/pin-login.dto'
import { BadgeLoginDto } from './dto/badge-login.dto'
import { JwtRefreshGuard } from './guards/jwt-refresh.guard'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'

// Limite les tentatives (mots de passe, inscriptions en masse)
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto)
  }

  // Code vendeur sur une caisse enregistrée
  @Post('pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  pinLogin(@Body() dto: PinLoginDto) {
    return this.auth.pinLogin(dto)
  }

  // Badge vendeur (QR ou NFC) sur une caisse enregistrée
  @Post('badge')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  badgeLogin(@Body() dto: BadgeLoginDto) {
    return this.auth.badgeLogin(dto)
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  refresh(@Req() req: Request & { user: { id: string; tv: number } }) {
    return this.auth.refresh(req.user.id, req.user.tv)
  }

  // Déconnecte tous les appareils de ce compte (téléphone perdu, départ)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logoutAll(@Req() req: Request & { user: { id: string; organizationId: string } }) {
    return this.auth.logoutEverywhere(req.user.id, req.user.organizationId)
  }
}
