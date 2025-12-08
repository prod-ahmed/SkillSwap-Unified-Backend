import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ahmed.ridha@esprit.tn' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
