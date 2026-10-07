import {
  IsInt,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddSubOperationDto {
  @ApiProperty()
  @IsInt()
  targetUserId: number;

  @ApiProperty()
  @IsInt()
  assetId: number;

  @ApiProperty({ enum: ['injection', 'extraction'] })
  @IsEnum(['injection', 'extraction'])
  type: 'injection' | 'extraction';

  @ApiProperty({ description: 'Amount as string to preserve precision' })
  @IsString()
  amount: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
