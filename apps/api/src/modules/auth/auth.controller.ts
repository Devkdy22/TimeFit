import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RedeemLoginTicketDto } from './dto/redeem-login-ticket.dto';
import { AuthAccessGuard, type AuthenticatedRequest } from './auth-access.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get(':provider/start')
  async startOAuth(
    @Param('provider') provider: 'google' | 'kakao' | 'naver',
    @Query('returnTo') returnTo: string,
    @Res() response: Response,
  ) {
    const redirectUrl = await this.authService.startOAuth(provider, returnTo);
    return response.redirect(302, redirectUrl);
  }

  @Get(':provider/callback')
  async completeOAuthCallback(
    @Param('provider') provider: 'google' | 'kakao' | 'naver',
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    const redirectUrl = await this.authService.completeOAuthCallback(provider, {
      code,
      state,
      error,
    });
    return response.redirect(302, redirectUrl);
  }

  @Post('social/login')
  async socialLogin(@Body() body: SocialLoginDto) {
    return {
      success: true,
      data: await this.authService.socialLogin(body),
    };
  }

  @Post('session/redeem')
  async redeemLoginTicket(@Body() body: RedeemLoginTicketDto) {
    return {
      success: true,
      data: await this.authService.redeemLoginTicket(body.ticket),
    };
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    return {
      success: true,
      data: await this.authService.refresh(body.refreshToken),
    };
  }

  @Post('logout')
  async logout(
    @Body() body: Partial<RefreshTokenDto>,
    @Headers('authorization') authorization?: string,
  ) {
    const accessToken = this.extractBearer(authorization);
    await this.authService.logout(body.refreshToken, accessToken ?? undefined);
    return { success: true, data: { loggedOut: true } };
  }

  @Get('me')
  @UseGuards(AuthAccessGuard)
  async me(@Req() request: AuthenticatedRequest) {
    const accessToken = this.extractBearer(request.headers.authorization);
    if (!accessToken) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return {
      success: true,
      data: await this.authService.getMe(accessToken),
    };
  }

  private extractBearer(authorization?: string) {
    if (!authorization) {
      return undefined;
    }
    const [type, token] = authorization.split(' ');
    if (type?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }
    return token;
  }
}
