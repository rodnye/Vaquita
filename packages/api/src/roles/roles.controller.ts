import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { VaultPermissionGuard } from '../common/guards/vault-permission.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RequireVaultPermission } from '../common/decorators/vault-permission.decorator.js';
import { PERMISSIONS } from '../common/enums/permissions.enum.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto.js';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VaultPermissionGuard)
@Controller('vaults/:vaultId/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List vault roles' })
  findAll(@Param('vaultId', ParseIntPipe) vaultId: number) {
    return this.rolesService.getVaultRoles(vaultId);
  }

  @Patch(':roleId/permissions')
  @RequireVaultPermission(PERMISSIONS.MANAGE_ROLES)
  @ApiOperation({ summary: 'Update role permissions (owner only)' })
  updatePermissions(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.updateRolePermissions(
      vaultId,
      roleId,
      dto.permissions,
      user.sub,
    );
  }

  @Patch('members/:userId')
  @RequireVaultPermission(PERMISSIONS.MANAGE_ROLES)
  @ApiOperation({ summary: 'Change member role (owner only)' })
  changeMemberRole(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ChangeMemberRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.changeMemberRole(
      vaultId,
      userId,
      dto.roleId,
      user.sub,
    );
  }
}
