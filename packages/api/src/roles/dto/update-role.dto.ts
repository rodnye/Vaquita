import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { Permission } from '../../common/enums/permissions.enum.js';

export class UpdateRoleDto {
  @ApiProperty({ description: 'Map of permission → boolean' })
  @IsObject()
  permissions: Record<Permission, boolean>;
}
