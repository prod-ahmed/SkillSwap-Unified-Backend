import { IsEmail, IsMongoId, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateThreadDto {
  @ValidateIf((o) => !o.participantEmail)
  @IsMongoId()
  participantId?: string;

  @ValidateIf((o) => !o.participantId)
  @IsEmail()
  participantEmail?: string;

  @IsOptional()
  @IsMongoId()
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;
}
