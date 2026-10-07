import { Module } from '@nestjs/common';
import { VaultsController } from './vaults.controller.js';
import { VaultsService } from './vaults.service.js';
import { RolesService } from '../roles/roles.service.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Module({
  controllers: [VaultsController],
  providers: [
    VaultsService,
    RolesService,
    WalletsService,
    AuditService,
    NotificationsService,
  ],
  exports: [VaultsService],
})
export class VaultsModule {}
