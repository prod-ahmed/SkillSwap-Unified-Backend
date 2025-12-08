import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: '123456',
    description: 'Reset code sent to your email',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'newPassword123!' })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({ example: 'newPassword123!' })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  confirmPassword: string;
}
