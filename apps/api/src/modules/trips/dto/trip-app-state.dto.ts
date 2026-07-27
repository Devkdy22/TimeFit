import { IsIn } from 'class-validator';

export class TripAppStateDto {
  @IsIn(['foreground', 'background'])
  appState!: 'foreground' | 'background';
}
