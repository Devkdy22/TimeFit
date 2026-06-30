import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
}

@Injectable()
export class AuthAccessGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = request.headers.authorization;
    const accessToken = this.extractBearer(bearer);
    if (!accessToken) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Missing or malformed bearer token',
      });
    }

    const profile = await this.authService.getMe(accessToken);
    request.authUserId = profile.id;
    return true;
  }

  private extractBearer(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }
    const [type, token] = authorization.split(' ');
    if (type?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }
    return token;
  }
}
