import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CookieOptions, Response } from 'express'
import { AuthService, SafeUser } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { AUTH_COOKIE, JwtAuthGuard } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE') === 'true',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const user = await this.auth.validateCredentials(dto.email, dto.password)
    const token = this.auth.signToken(user)
    res.cookie(AUTH_COOKIE, token, this.cookieOptions())
    return { user }
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(AUTH_COOKIE, { ...this.cookieOptions(), maxAge: undefined })
    return { ok: true }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SafeUser): { user: SafeUser } {
    return { user }
  }
}
