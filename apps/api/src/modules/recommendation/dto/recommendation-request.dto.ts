import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

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

class CandidateRouteDto {
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
  routeType?: 'subway-heavy' | 'bus-heavy' | 'walking-heavy' | 'mixed' | 'bus' | 'subway' | 'car';

  @IsOptional()
  @IsIn(['api', 'fallback'])
  source?: 'api' | 'fallback';

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

class UserPreferenceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prepMinutes!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preferredBufferMinutes!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transferPenaltyWeight!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  walkingPenaltyWeight!: number;
}

export class RecommendationRequestDto {
  @ValidateNested()
  @Type(() => LocationDto)
  origin!: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  destination!: LocationDto;

  @IsISO8601()
  arrivalAt!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidateRouteDto)
  candidateRoutes?: CandidateRouteDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserPreferenceDto)
  userPreference?: UserPreferenceDto;
}
