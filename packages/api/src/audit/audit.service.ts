import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog } from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

@Injectable()
export class AuditService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly notificationsService: NotificationsService,
  ) {}

  async log(
    vaultId: number,
    userId: number,
    action: string,
    detail: Record<string, unknown>,
  ) {
    await this.db.insert(auditLog).values({ vaultId, userId, action, detail });
  }

  async getVaultAudit(vaultId: number, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const offset = (page - 1) * limit;

    return this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.vaultId, vaultId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async notifyRoleChange(userId: number, vaultId: number, roleId: number) {
    await this.notificationsService.send(userId, 'role_changed', {
      vaultId,
      roleId,
    });
  }
}
