import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { VaultPermissionGuard } from '../common/guards/vault-permission.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RequireVaultPermission } from '../common/decorators/vault-permission.decorator.js';
import { PERMISSIONS } from '../common/enums/permissions.enum.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';

@ApiTags('Invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, VaultPermissionGuard)
@Controller('vaults/:vaultId/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @RequireVaultPermission(PERMISSIONS.INVITE_MEMBERS)
  @ApiOperation({ summary: 'Invite user by ID' })
  create(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.create(vaultId, user.sub, dto.inviteeId);
  }

  @Get('sent')
  @ApiOperation({ summary: 'List invitations I sent (only visible to sender)' })
  getSent(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.getSentByMe(vaultId, user.sub);
  }

  @Get('received')
  @ApiOperation({ summary: 'List invitations I received' })
  getReceived(@CurrentUser() user: JwtPayload) {
    return this.invitationsService.getReceivedByMe(user.sub);
  }

  @Post(':invitationId/accept')
  @ApiOperation({ summary: 'Accept invitation' })
  accept(
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.accept(invitationId, user.sub);
  }

  @Post(':invitationId/reject')
  @ApiOperation({ summary: 'Reject invitation' })
  reject(
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.reject(invitationId, user.sub);
  }

  @Post(':invitationId/revoke')
  @RequireVaultPermission(PERMISSIONS.REVOKE_INVITATIONS)
  @ApiOperation({ summary: 'Revoke invitation' })
  revoke(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.revoke(invitationId, user.sub);
  }
}
