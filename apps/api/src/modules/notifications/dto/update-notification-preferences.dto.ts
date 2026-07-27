import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  departureLeadMinutes?: number;

  @IsOptional()
  @IsBoolean()
  delayNotificationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  rerouteNotificationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  vibrationEnabled?: boolean;
}
