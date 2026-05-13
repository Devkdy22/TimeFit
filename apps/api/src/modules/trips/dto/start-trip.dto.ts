import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { MobilityRoute } from '../../recommendation/types/recommendation.types';

class CurrentPositionDto {
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;
}

export class StartTripDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  recommendationId?: string;

  @IsOptional()
  @IsString()
  currentRoute?: string;

  @IsOptional()
  @IsObject()
  route?: MobilityRoute;

  @IsOptional()
  @IsISO8601()
  departureAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  plannedDurationMinutes?: number;

  @IsOptional()
  @IsISO8601()
  arrivalAt?: string;

  @IsOptional()
  @IsISO8601()
  targetArrivalTime?: string;

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

  @IsOptional()
  @ValidateNested()
  @Type(() => CurrentPositionDto)
  currentPosition?: CurrentPositionDto;
}
