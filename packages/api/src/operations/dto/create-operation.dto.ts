import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOperationDto {
  @ApiProperty({ enum: ['transaction', 'task'] })
  @IsEnum(['transaction', 'task'])
  category: 'transaction' | 'task';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
