import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RequestRescheduleDto {
  @IsDateString()
  newDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  newTime?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}
