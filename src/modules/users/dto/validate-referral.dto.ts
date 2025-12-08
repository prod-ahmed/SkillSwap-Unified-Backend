import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ValidateReferralDto {
  @ApiProperty({ example: 'ABC12' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 5)
  codeParainnage: string;
}
