import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  assets,
  walletBalances,
  wallets,
  subOperations,
} from '../db/schema.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';

@Injectable()
export class AssetsService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findByVault(vaultId: number) {
    return this.db.select().from(assets).where(eq(assets.vaultId, vaultId));
  }

  async create(vaultId: number, dto: CreateAssetDto, actorId: number) {
    const [asset] = await this.db
      .insert(assets)
      .values({
        vaultId,
        name: dto.name,
        isDecimal: dto.isDecimal ?? true,
        allowNegative: dto.allowNegative ?? false,
      })
      .returning();

    await this.auditService.log(vaultId, actorId, 'asset_created', {
      assetId: asset.id,
      name: asset.name,
    });
    return asset;
  }

  async deactivate(vaultId: number, assetId: number, actorId: number) {
    const totalBalance = await this.getTotalBalance(vaultId, assetId);
    if (Number(totalBalance) !== 0)
      throw new ConflictException(
        'Cannot deactivate asset with non-zero total balance',
      );

    const [asset] = await this.db
      .update(assets)
      .set({ isActive: false })
      .where(and(eq(assets.id, assetId), eq(assets.vaultId, vaultId)))
      .returning();
    if (!asset) throw new NotFoundException('Asset not found');

    await this.auditService.log(vaultId, actorId, 'asset_deactivated', {
      assetId,
    });
    return asset;
  }

  async remove(vaultId: number, assetId: number, actorId: number) {
    const totalBalance = await this.getTotalBalance(vaultId, assetId);
    if (Number(totalBalance) !== 0)
      throw new ConflictException('Cannot delete asset with non-zero balance');

    const [hasOps] = await this.db
      .select({ id: subOperations.id })
      .from(subOperations)
      .where(eq(subOperations.assetId, assetId))
      .limit(1);
    if (hasOps)
      throw new ConflictException('Cannot delete asset with operation history');

    await this.db
      .delete(assets)
      .where(and(eq(assets.id, assetId), eq(assets.vaultId, vaultId)));

    await this.auditService.log(vaultId, actorId, 'asset_deleted', { assetId });
  }

  async getByIdOrThrow(assetId: number) {
    const [asset] = await this.db
      .select()
      .from(assets)
      .where(eq(assets.id, assetId));
    if (!asset) throw new NotFoundException('Asset not found');
    if (!asset.isActive) throw new ConflictException('Asset is inactive');
    return asset;
  }

  private async getTotalBalance(
    vaultId: number,
    assetId: number,
  ): Promise<string> {
    const [result] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${walletBalances.balance} AS NUMERIC)), 0)`,
      })
      .from(walletBalances)
      .innerJoin(wallets, eq(walletBalances.walletId, wallets.id))
      .where(
        and(eq(wallets.vaultId, vaultId), eq(walletBalances.assetId, assetId)),
      );
    return result?.total ?? '0';
  }
}
