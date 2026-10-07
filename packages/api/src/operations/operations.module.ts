import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';
import { SubOperationsService } from './sub-operations.service.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { AssetsService } from '../assets/assets.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Module({
  controllers: [OperationsController],
  providers: [
    OperationsService,
    SubOperationsService,
    WalletsService,
    AssetsService,
    AuditService,
    NotificationsService,
  ],
})
export class OperationsModule {}
