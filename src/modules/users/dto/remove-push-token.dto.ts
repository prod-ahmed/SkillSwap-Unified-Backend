import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RemovePushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
