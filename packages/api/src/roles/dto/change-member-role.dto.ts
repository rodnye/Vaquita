import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeMemberRoleDto {
  @ApiProperty()
  @IsInt()
  roleId: number;
}
