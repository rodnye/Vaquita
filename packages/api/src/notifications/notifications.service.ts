import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { notifications } from '../db/schema.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

type NotificationType =
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_rejected'
  | 'invitation_expired'
  | 'invitation_revoked'
  | 'subop_affects_you'
  | 'subop_accepted'
  | 'subop_rejected'
  | 'operation_completed'
  | 'operation_cancelled'
  | 'role_changed'
  | 'expelled'
  | 'config_changed'
  | 'asset_changed';

@Injectable()
export class NotificationsService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async send(
    userId: number,
    type: NotificationType,
    payload: Record<string, unknown>,
  ) {
    await this.db.insert(notifications).values({ userId, type, payload });
  }

  async findByUser(userId: number, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const offset = (page - 1) * limit;

    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async markRead(id: number, userId: number) {
    const [notif] = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    if (!notif) throw new ForbiddenException('Notification not found');
    return notif;
  }

  async markAllRead(userId: number) {
    await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
  }
}
