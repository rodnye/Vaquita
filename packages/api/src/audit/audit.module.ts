import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Module({
  providers: [AuditService, NotificationsService],
  exports: [AuditService],
})
export class AuditModule {}
