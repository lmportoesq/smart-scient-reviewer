import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private auditService: AuditService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    try {
      const { user, tokens } = await this.authService.login(dto);
      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      // Audit successful login
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return { user, message: 'Login successful' };
    } catch (error) {
      // Audit failed login attempt
      await this.auditService.log({
        action: AuditAction.LOGIN_FAILED,
        metadata: { email: dto.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const user = (req as any).user;

    this.clearAuthCookies(res);

    // Audit logout
    await this.auditService.log({
      userId: user?.id,
      action: AuditAction.LOGOUT,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { message: 'Logout successful' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      this.clearAuthCookies(res);
      return { message: 'No refresh token' };
    }

    const tokens = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return { message: 'Tokens refreshed' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return { user: (req as any).user };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  }
}
