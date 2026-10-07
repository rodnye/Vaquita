import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferOwnershipDto {
  @ApiProperty()
  @IsInt()
  newOwnerId: number;
}
