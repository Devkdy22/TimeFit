import { Body, Controller, Get, Headers, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthAccessGuard, type AuthenticatedRequest } from './auth-access.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('social/login')
  async socialLogin(@Body() body: SocialLoginDto) {
    return {
      success: true,
      data: await this.authService.socialLogin(body),
    };
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    return {
      success: true,
      data: this.authService.refresh(body.refreshToken),
    };
  }

  @Post('logout')
  async logout(
    @Body() body: Partial<RefreshTokenDto>,
    @Headers('authorization') authorization?: string,
  ) {
    const accessToken = this.extractBearer(authorization);
    this.authService.logout(body.refreshToken, accessToken ?? undefined);
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
      data: this.authService.getMe(accessToken),
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
