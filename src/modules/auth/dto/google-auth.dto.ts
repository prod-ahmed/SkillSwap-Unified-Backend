import { IsString, IsOptional } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  idToken: string;

  @IsString()
  @IsOptional()
  referralCode?: string;
}
