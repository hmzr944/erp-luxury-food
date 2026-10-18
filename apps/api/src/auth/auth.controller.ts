import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { RegisterDto } from './dto/register.dto'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { PinLoginDto } from './dto/pin-login.dto'
import { BadgeLoginDto } from './dto/badge-login.dto'
import { OfflineRosterDto } from './dto/offline-roster.dto'
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto'
import { PasswordResetService } from './password-reset.service'
import { JwtRefreshGuard } from './guards/jwt-refresh.guard'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'

// Limite les tentatives (mots de passe, inscriptions en masse)
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private auth: AuthService,
    private passwords: PasswordResetService,
  ) {}

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

  // Équipe reconnue par cette caisse sans réseau (sels liés à la caisse, aucun code)
  @Post('pin/offline')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  offlineRoster(@Req() req: Request & { user: { id: string; organizationId: string; role: string } }, @Body() dto: OfflineRosterDto) {
    return this.auth.offlineRoster(req.user, dto)
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

  // Toujours 204 : la réponse ne dit pas si un compte existe pour cet e-mail
  @Post('password/forgot')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    this.passwords.forgot(dto.email)
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwords.reset(dto.token, dto.password)
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
