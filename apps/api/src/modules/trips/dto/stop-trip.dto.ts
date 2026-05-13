import { IsString } from 'class-validator';

export class StopTripDto {
  @IsString()
  tripId!: string;
}
