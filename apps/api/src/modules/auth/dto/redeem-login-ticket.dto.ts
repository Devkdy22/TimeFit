import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemLoginTicketDto {
  @IsString()
  @MinLength(16)
  @MaxLength(4096)
  ticket!: string;
}
