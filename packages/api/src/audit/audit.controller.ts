import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { VaultPermissionGuard } from '../common/guards/vault-permission.guard.js';
import { RequireVaultPermission } from '../common/decorators/vault-permission.decorator.js';
import { PERMISSIONS } from '../common/enums/permissions.enum.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VaultPermissionGuard)
@Controller('vaults/:vaultId/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireVaultPermission(PERMISSIONS.EXPORT_HISTORY)
  @ApiOperation({ summary: 'Get vault audit log (restricted)' })
  getAudit(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.auditService.getVaultAudit(vaultId, pagination);
  }
}
