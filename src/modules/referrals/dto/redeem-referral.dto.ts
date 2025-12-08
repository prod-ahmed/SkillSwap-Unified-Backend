import { IsOptional, IsString, Length } from 'class-validator';

export class RedeemReferralDto {
  @IsString()
  @Length(8, 8)
  code: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
