import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMailDto {
  @ApiProperty({
    example: '663784',
    description: 'Verification code sent to your email',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
