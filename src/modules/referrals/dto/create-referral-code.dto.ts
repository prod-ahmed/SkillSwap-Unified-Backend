import { IsOptional, IsNumber, IsString, IsISO8601 } from 'class-validator';

export class CreateReferralCodeDto {
  @IsOptional()
  @IsNumber()
  usageLimit?: number; // 0 = unlimited

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  campaign?: string;
}
