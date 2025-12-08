import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RespondNotificationDto {
  @IsBoolean()
  accepted: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}
