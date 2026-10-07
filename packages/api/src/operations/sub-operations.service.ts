import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { subOperations, operations } from '../db/schema.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { AssetsService } from '../assets/assets.service.js';
import { OperationsService } from './operations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AddSubOperationDto } from './dto/add-sub-operation.dto.js';

@Injectable()
export class SubOperationsService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly walletsService: WalletsService,
    private readonly assetsService: AssetsService,
    private readonly operationsService: OperationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async add(
    vaultId: number,
    operationId: number,
    dto: AddSubOperationDto,
    actorId: number,
  ) {
    const op = await this.operationsService.getActiveOrThrow(
      vaultId,
      operationId,
    );
    const asset = await this.assetsService.getByIdOrThrow(dto.assetId);

    // Validate amount
    this.validateAmount(dto.amount, asset.isDecimal);

    // Reserve funds for extractions in transactions
    let insufficientFunds = false;
    if (dto.type === 'extraction' && op.category === 'transaction') {
      await this.db.transaction(async (tx) => {
        const fullyReserved = await this.walletsService.reserve(
          tx,
          vaultId,
          dto.targetUserId,
          dto.assetId,
          dto.amount,
        );
        if (!fullyReserved) insufficientFunds = true;
      });
    }

    const [subOp] = await this.db
      .insert(subOperations)
      .values({
        operationId,
        targetUserId: dto.targetUserId,
        assetId: dto.assetId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description ?? '',
        isRequired: dto.isRequired ?? true,
        insufficientFunds,
      })
      .returning();

    // Increment operation version
    await this.db
      .update(operations)
      .set({ version: op.version + 1 })
      .where(eq(operations.id, operationId));

    // Notify target user
    if (dto.targetUserId !== actorId) {
      await this.notificationsService.send(
        dto.targetUserId,
        'subop_affects_you',
        {
          vaultId,
          operationId,
          subOpId: subOp.id,
          type: dto.type,
          amount: dto.amount,
        },
      );
    }

    return { ...subOp, insufficientFunds };
  }

  async accept(
    vaultId: number,
    operationId: number,
    subOpId: number,
    userId: number,
  ) {
    return this.db.transaction(async (tx) => {
      const sub = await this.getSubOpOrThrow(tx, operationId, subOpId);
      if (sub.targetUserId !== userId)
        throw new ForbiddenException('Only the target user can accept');
      if (sub.status !== 'pending')
        throw new ConflictException('Sub-operation is not pending');

      // Revalidate balance for extractions
      if (sub.type === 'extraction') {
        const balance = await this.walletsService.getBalance(
          tx,
          vaultId,
          sub.targetUserId,
          sub.assetId,
        );
        if (!balance) throw new BadRequestException('No balance record');
        const available =
          Number(balance.balance) -
          Number(balance.reserved) +
          Number(sub.amount);
        // + sub.amount because the reservation is part of reserved; we need total >= amount
        if (Number(balance.balance) < Number(sub.amount))
          throw new ConflictException('Insufficient funds to accept');
      }

      await tx
        .update(subOperations)
        .set({ status: 'accepted', resolvedAt: new Date() })
        .where(eq(subOperations.id, subOpId));

      // Notify creator
      const [op] = await tx
        .select()
        .from(operations)
        .where(eq(operations.id, operationId));
      await this.notificationsService.send(op.creatorId, 'subop_accepted', {
        vaultId,
        operationId,
        subOpId,
        userId,
      });

      // Try to complete
      await this.operationsService.tryComplete(tx, operationId, vaultId);
    });
  }

  async reject(
    vaultId: number,
    operationId: number,
    subOpId: number,
    userId: number,
  ) {
    return this.db.transaction(async (tx) => {
      const sub = await this.getSubOpOrThrow(tx, operationId, subOpId);
      if (sub.targetUserId !== userId)
        throw new ForbiddenException('Only the target user can reject');
      if (sub.status !== 'pending')
        throw new ConflictException('Sub-operation is not pending');

      await tx
        .update(subOperations)
        .set({ status: 'rejected', resolvedAt: new Date() })
        .where(eq(subOperations.id, subOpId));

      // Release reservation
      if (sub.type === 'extraction') {
        await this.walletsService.releaseReservation(
          tx,
          vaultId,
          sub.targetUserId,
          sub.assetId,
          sub.amount,
        );
      }

      const [op] = await tx
        .select()
        .from(operations)
        .where(eq(operations.id, operationId));
      await this.notificationsService.send(op.creatorId, 'subop_rejected', {
        vaultId,
        operationId,
        subOpId,
        userId,
      });

      // If required → cancel entire operation
      if (sub.isRequired) {
        await this.cancelOperationInTx(tx, operationId, vaultId);
      }
    });
  }

  private async cancelOperationInTx(
    tx: any,
    operationId: number,
    vaultId: number,
  ) {
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
  }

  private async getSubOpOrThrow(tx: any, operationId: number, subOpId: number) {
    const [sub] = await tx
      .select()
      .from(subOperations)
      .where(
        and(
          eq(subOperations.id, subOpId),
          eq(subOperations.operationId, operationId),
        ),
      );
    if (!sub) throw new NotFoundException('Sub-operation not found');
    return sub;
  }

  private validateAmount(amount: string, isDecimal: boolean) {
    const num = Number(amount);
    if (isNaN(num) || num <= 0)
      throw new BadRequestException('Amount must be greater than zero');
    if (!isDecimal && !Number.isInteger(num))
      throw new BadRequestException('Asset requires integer amounts');
    if (isDecimal) {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length > 2)
        throw new BadRequestException('Maximum 2 decimal places');
    }
  }
}
