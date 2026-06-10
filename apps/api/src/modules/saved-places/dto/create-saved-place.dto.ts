import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class CreateSavedPlaceDto {
  @IsString()
  label!: string;

  @IsString()
  address!: string;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;
}
