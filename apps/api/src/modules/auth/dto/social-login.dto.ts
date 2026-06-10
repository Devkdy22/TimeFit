import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SocialLoginDto {
  @IsIn(['google', 'kakao', 'naver'])
  provider!: 'google' | 'kakao' | 'naver';

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  idToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  accessToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  authorizationCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  redirectUri?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  state?: string;
}
