import { ArrayMinSize, IsArray, IsMongoId, IsOptional } from 'class-validator';

export class MarkThreadReadDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  ids?: string[];
}
