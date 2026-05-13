import { Type } from 'class-transformer';
import { IsNumber, IsString, ValidateNested } from 'class-validator';

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

export class RouteCandidatesDto {
  @ValidateNested()
  @Type(() => LocationDto)
  origin!: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  destination!: LocationDto;
}
