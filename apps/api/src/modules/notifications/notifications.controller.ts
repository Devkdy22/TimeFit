import { Body, Controller, Get, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { AuthAccessGuard, type AuthenticatedRequest } from '../auth/auth-access.guard';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationService } from './services/notification.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('push-token')
  @UseGuards(AuthAccessGuard)
  async registerPushToken(@Req() request: AuthenticatedRequest, @Body() body: RegisterPushTokenDto) {
    if (!request.authUserId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return ApiResponse.ok(await this.notificationService.registerPushToken(request.authUserId, body));
  }

  @Get('preferences')
  @UseGuards(AuthAccessGuard)
  async getPreferences(@Req() request: AuthenticatedRequest) {
    return ApiResponse.ok(await this.notificationService.getNotificationPreferences(this.requireUserId(request)));
  }

  @Patch('preferences')
  @UseGuards(AuthAccessGuard)
  async updatePreferences(@Req() request: AuthenticatedRequest, @Body() body: UpdateNotificationPreferencesDto) {
    return ApiResponse.ok(await this.notificationService.updateNotificationPreferences(this.requireUserId(request), body));
  }

  private requireUserId(request: AuthenticatedRequest): string {
    if (!request.authUserId) throw new UnauthorizedException('Missing authenticated user');
    return request.authUserId;
  }
}
