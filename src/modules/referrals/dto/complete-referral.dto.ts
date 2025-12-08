import { IsString } from 'class-validator';

export class CompleteReferralDto {
  @IsString()
  userId: string;

  @IsString()
  eventType: string; // e.g., 'email_verified' | 'first_purchase' | 'first_session'
}
