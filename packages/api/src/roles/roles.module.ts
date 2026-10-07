import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Module({
  controllers: [RolesController],
  providers: [RolesService, AuditService, NotificationsService],
  exports: [RolesService],
})
export class RolesModule {}
