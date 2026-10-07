import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssetsService } from './assets.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { VaultPermissionGuard } from '../common/guards/vault-permission.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RequireVaultPermission } from '../common/decorators/vault-permission.decorator.js';
import { PERMISSIONS } from '../common/enums/permissions.enum.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VaultPermissionGuard)
@Controller('vaults/:vaultId/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List vault assets' })
  findAll(@Param('vaultId', ParseIntPipe) vaultId: number) {
    return this.assetsService.findByVault(vaultId);
  }

  @Post()
  @RequireVaultPermission(PERMISSIONS.MANAGE_ASSETS)
  @ApiOperation({ summary: 'Add asset (owner only)' })
  create(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assetsService.create(vaultId, dto, user.sub);
  }

  @Patch(':assetId/deactivate')
  @RequireVaultPermission(PERMISSIONS.MANAGE_ASSETS)
  @ApiOperation({ summary: 'Deactivate asset (requires zero total balance)' })
  deactivate(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assetsService.deactivate(vaultId, assetId, user.sub);
  }

  @Delete(':assetId')
  @RequireVaultPermission(PERMISSIONS.MANAGE_ASSETS)
  @ApiOperation({ summary: 'Delete asset (zero balance + no history)' })
  remove(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assetsService.remove(vaultId, assetId, user.sub);
  }
}
