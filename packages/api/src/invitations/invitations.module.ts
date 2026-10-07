import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { RolesService } from '../roles/roles.service.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    RolesService,
    WalletsService,
    AuditService,
    NotificationsService,
  ],
})
export class InvitationsModule {}
