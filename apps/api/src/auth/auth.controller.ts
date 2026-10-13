import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { RegisterDto } from './dto/register.dto'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { JwtRefreshGuard } from './guards/jwt-refresh.guard'

// Limite les tentatives (mots de passe, inscriptions en masse)
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto)
  }

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  refresh(@Req() req: Request & { user: { id: string } }) {
    return this.auth.refresh(req.user.id)
  }
}
