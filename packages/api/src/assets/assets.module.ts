import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, AuditService, NotificationsService],
  exports: [AssetsService],
})
export class AssetsModule {}
