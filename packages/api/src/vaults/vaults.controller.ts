import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VaultsService } from './vaults.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { VaultPermissionGuard } from '../common/guards/vault-permission.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RequireVaultPermission } from '../common/decorators/vault-permission.decorator.js';
import { PERMISSIONS } from '../common/enums/permissions.enum.js';
import { CreateVaultDto } from './dto/create-vault.dto.js';
import { UpdateVaultDto } from './dto/update-vault.dto.js';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto.js';

@ApiTags('Vaults')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VaultPermissionGuard)
@Controller('vaults')
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a vault' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVaultDto) {
    return this.vaultsService.create(user.sub, dto);
  }

  @Get(':vaultId')
  @ApiOperation({ summary: 'Get vault details + public totals' })
  findOne(@Param('vaultId', ParseIntPipe) vaultId: number) {
    return this.vaultsService.findOne(vaultId);
  }

  @Get(':vaultId/members')
  @ApiOperation({ summary: 'List vault members' })
  getMembers(@Param('vaultId', ParseIntPipe) vaultId: number) {
    return this.vaultsService.getMembers(vaultId);
  }

  @Patch(':vaultId')
  @RequireVaultPermission(PERMISSIONS.MANAGE_VAULT_CONFIG)
  @ApiOperation({ summary: 'Update vault config (owner only)' })
  update(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Body() dto: UpdateVaultDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vaultsService.update(vaultId, dto, user.sub);
  }

  @Post(':vaultId/transfer-ownership')
  @ApiOperation({ summary: 'Transfer vault ownership' })
  transferOwnership(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vaultsService.transferOwnership(
      vaultId,
      dto.newOwnerId,
      user.sub,
    );
  }

  @Post(':vaultId/leave')
  @ApiOperation({ summary: 'Leave vault (requires zero balance)' })
  leave(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vaultsService.leaveVault(vaultId, user.sub);
  }

  @Post(':vaultId/expel/:userId')
  @RequireVaultPermission(PERMISSIONS.MANAGE_MEMBERS)
  @ApiOperation({ summary: 'Expel a member' })
  expel(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vaultsService.expelMember(vaultId, userId, user.sub);
  }
}
