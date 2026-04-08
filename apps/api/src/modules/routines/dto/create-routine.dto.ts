import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { RouteType } from '../../recommendation/types/recommendation.types';

class LocationDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;
}

class SavedRouteDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  busRouteId?: string;

  @IsOptional()
  @IsString()
  busStationId?: string;

  @IsOptional()
  @IsIn(['subway-heavy', 'bus-heavy', 'walking-heavy', 'mixed', 'bus', 'subway', 'car'])
  routeType?: RouteType;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  estimatedTravelMinutes!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  delayRisk!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transferCount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  walkingMinutes!: number;
}

export class CreateRoutineDto {
  @IsString()
  userId!: string;

  @IsString()
  title!: string;

  @ValidateNested()
  @Type(() => LocationDto)
  origin!: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  destination!: LocationDto;

  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];

  @IsString()
  arrivalTime!: string; // HH:mm

  @IsOptional()
  @ValidateNested()
  @Type(() => SavedRouteDto)
  @IsObject()
  savedRoute?: SavedRouteDto;

  @IsOptional()
  @IsString()
  expoPushToken?: string;
}
