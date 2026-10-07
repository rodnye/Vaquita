import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OperationsService } from './operations.service.js';
import { SubOperationsService } from './sub-operations.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { VaultPermissionGuard } from '../common/guards/vault-permission.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RequireVaultPermission } from '../common/decorators/vault-permission.decorator.js';
import { PERMISSIONS } from '../common/enums/permissions.enum.js';
import { CreateOperationDto } from './dto/create-operation.dto.js';
import { AddSubOperationDto } from './dto/add-sub-operation.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VaultPermissionGuard)
@Controller('vaults/:vaultId/operations')
export class OperationsController {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly subOpsService: SubOperationsService,
  ) {}

  @Post()
  @RequireVaultPermission(PERMISSIONS.CREATE_OPERATIONS)
  @ApiOperation({ summary: 'Create operation' })
  create(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Body() dto: CreateOperationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.operationsService.create(vaultId, user.sub, dto);
  }

  @Get()
  @RequireVaultPermission(PERMISSIONS.VIEW_HISTORY)
  @ApiOperation({ summary: 'List operations' })
  findAll(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.operationsService.findByVault(vaultId, pagination);
  }

  @Get(':operationId')
  @ApiOperation({ summary: 'Get operation with sub-operations' })
  findOne(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('operationId', ParseIntPipe) operationId: number,
  ) {
    return this.operationsService.findOneWithSubOps(vaultId, operationId);
  }

  @Post(':operationId/sub-operations')
  @RequireVaultPermission(PERMISSIONS.CREATE_OPERATIONS)
  @ApiOperation({ summary: 'Add sub-operation to active operation' })
  addSubOp(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('operationId', ParseIntPipe) operationId: number,
    @Body() dto: AddSubOperationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subOpsService.add(vaultId, operationId, dto, user.sub);
  }

  @Post(':operationId/sub-operations/:subOpId/accept')
  @ApiOperation({ summary: 'Accept sub-operation' })
  acceptSubOp(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('operationId', ParseIntPipe) operationId: number,
    @Param('subOpId', ParseIntPipe) subOpId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subOpsService.accept(vaultId, operationId, subOpId, user.sub);
  }

  @Post(':operationId/sub-operations/:subOpId/reject')
  @ApiOperation({ summary: 'Reject sub-operation' })
  rejectSubOp(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('operationId', ParseIntPipe) operationId: number,
    @Param('subOpId', ParseIntPipe) subOpId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subOpsService.reject(vaultId, operationId, subOpId, user.sub);
  }

  @Post(':operationId/cancel')
  @RequireVaultPermission(PERMISSIONS.CANCEL_OPERATIONS)
  @ApiOperation({ summary: 'Cancel operation (global)' })
  cancel(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('operationId', ParseIntPipe) operationId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.operationsService.cancel(vaultId, operationId, user.sub);
  }

  @Patch(':operationId/convert')
  @RequireVaultPermission(PERMISSIONS.CONVERT_OPERATIONS)
  @ApiOperation({ summary: 'Convert between task and transaction' })
  convert(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('operationId', ParseIntPipe) operationId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.operationsService.convertCategory(
      vaultId,
      operationId,
      user.sub,
    );
  }
}
