import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { operations, subOperations } from '../db/schema.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateOperationDto } from './dto/create-operation.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

@Injectable()
export class OperationsService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly walletsService: WalletsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(vaultId: number, creatorId: number, dto: CreateOperationDto) {
    const [op] = await this.db
      .insert(operations)
      .values({
        vaultId,
        creatorId,
        category: dto.category,
        description: dto.description ?? '',
      })
      .returning();
    return op;
  }

  async findByVault(vaultId: number, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const offset = (page - 1) * limit;

    const items = await this.db
      .select()
      .from(operations)
      .where(eq(operations.vaultId, vaultId))
      .orderBy(desc(operations.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, page, limit };
  }

  async findOneWithSubOps(vaultId: number, operationId: number) {
    const [op] = await this.db
      .select()
      .from(operations)
      .where(
        and(eq(operations.id, operationId), eq(operations.vaultId, vaultId)),
      );
    if (!op) throw new NotFoundException('Operation not found');

    const subOps = await this.db
      .select()
      .from(subOperations)
      .where(eq(subOperations.operationId, operationId));

    return { ...op, subOperations: subOps };
  }

  async getActiveOrThrow(vaultId: number, operationId: number) {
    const [op] = await this.db
      .select()
      .from(operations)
      .where(
        and(
          eq(operations.id, operationId),
          eq(operations.vaultId, vaultId),
          eq(operations.status, 'active'),
        ),
      );
    if (!op) throw new ConflictException('Operation not found or not active');
    return op;
  }

  async cancel(vaultId: number, operationId: number, actorId: number) {
    const op = await this.getActiveOrThrow(vaultId, operationId);

    await this.db.transaction(async (tx) => {
      // Release all reservations for pending extraction sub-ops
      const pendingExtractions = await tx
        .select()
        .from(subOperations)
        .where(
          and(
            eq(subOperations.operationId, operationId),
            eq(subOperations.type, 'extraction'),
            eq(subOperations.status, 'pending'),
          ),
        );

      for (const sub of pendingExtractions) {
        await this.walletsService.releaseReservation(
          tx,
          vaultId,
          sub.targetUserId,
          sub.assetId,
          sub.amount,
        );
      }

      await tx
        .update(subOperations)
        .set({ status: 'cancelled', resolvedAt: new Date() })
        .where(
          and(
            eq(subOperations.operationId, operationId),
            eq(subOperations.status, 'pending'),
          ),
        );

      await tx
        .update(operations)
        .set({ status: 'cancelled' })
        .where(eq(operations.id, operationId));
    });

    await this.auditService.log(vaultId, actorId, 'operation_cancelled', {
      operationId,
    });
    await this.notificationsService.send(op.creatorId, 'operation_cancelled', {
      vaultId,
      operationId,
    });
  }

  async convertCategory(vaultId: number, operationId: number, actorId: number) {
    const op = await this.getActiveOrThrow(vaultId, operationId);
    const newCategory = op.category === 'task' ? 'transaction' : 'task';

    await this.db.transaction(async (tx) => {
      if (newCategory === 'transaction') {
        // task → transaction: sub-ops become pending, reserve funds for extractions
        const subOps = await tx
          .select()
          .from(subOperations)
          .where(
            and(
              eq(subOperations.operationId, operationId),
              eq(subOperations.type, 'extraction'),
            ),
          );
        for (const sub of subOps) {
          await this.walletsService.reserve(
            tx,
            vaultId,
            sub.targetUserId,
            sub.assetId,
            sub.amount,
          );
        }
      } else {
        // transaction → task: release reservations
        const subOps = await tx
          .select()
          .from(subOperations)
          .where(
            and(
              eq(subOperations.operationId, operationId),
              eq(subOperations.type, 'extraction'),
              eq(subOperations.status, 'pending'),
            ),
          );
        for (const sub of subOps) {
          await this.walletsService.releaseReservation(
            tx,
            vaultId,
            sub.targetUserId,
            sub.assetId,
            sub.amount,
          );
        }
      }

      await tx
        .update(operations)
        .set({ category: newCategory, version: op.version + 1 })
        .where(eq(operations.id, operationId));
    });

    await this.auditService.log(vaultId, actorId, 'operation_converted', {
      operationId,
      from: op.category,
      to: newCategory,
    });
  }

  async tryComplete(tx: any, operationId: number, vaultId: number) {
    const subOps = await tx
      .select()
      .from(subOperations)
      .where(eq(subOperations.operationId, operationId));

    const requiredPending = subOps.filter(
      (s: any) => s.isRequired && s.status === 'pending',
    );
    const anyRejected = subOps.some(
      (s: any) => s.isRequired && s.status === 'rejected',
    );

    if (anyRejected) return; // already cancelled by reject handler
    if (requiredPending.length > 0) return; // still waiting

    // All required accepted → complete
    const [op] = await tx
      .select()
      .from(operations)
      .where(eq(operations.id, operationId));

    if (op.status !== 'active') return;

    // Apply all accepted sub-operations as definitive movements
    const accepted = subOps.filter((s: any) => s.status === 'accepted');
    for (const sub of accepted) {
      await this.walletsService.applyMovement(
        tx,
        vaultId,
        sub.targetUserId,
        sub.assetId,
        sub.amount,
        sub.type,
      );
    }

    await tx
      .update(operations)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(operations.id, operationId));

    await this.notificationsService.send(op.creatorId, 'operation_completed', {
      vaultId,
      operationId,
    });
  }
}
