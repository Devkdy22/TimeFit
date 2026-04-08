import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StartTripDto {
  @IsString()
  userId!: string;

  @IsString()
  recommendationId!: string;

  @IsOptional()
  @IsString()
  currentRoute?: string;

  @IsOptional()
  @IsISO8601()
  departureAt?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  plannedDurationMinutes!: number;

  @IsOptional()
  @IsISO8601()
  arrivalAt?: string;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  originLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  originLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLng?: number;

  @IsOptional()
  @IsString()
  stationName?: string;

  @IsOptional()
  @IsString()
  expoPushToken?: string;
}
