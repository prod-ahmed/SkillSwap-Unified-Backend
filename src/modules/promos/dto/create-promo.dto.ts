import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { IsMongoId } from 'class-validator';

export class CreatePromoDto {

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsNumber()
  discountPercent: number;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validTo: string;
}
