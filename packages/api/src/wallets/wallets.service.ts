import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { wallets, walletBalances, assets } from '../db/schema.js';

export type TxDb =
  | NodePgDatabase
  | Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

@Injectable()
export class WalletsService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async createForUser(tx: TxDb, vaultId: number, userId: number) {
    const [wallet] = await tx
      .insert(wallets)
      .values({ vaultId, userId })
      .returning();

    // Initialize balances for existing active assets
    const vaultAssets = await tx
      .select()
      .from(assets)
      .where(and(eq(assets.vaultId, vaultId), eq(assets.isActive, true)));

    if (vaultAssets.length > 0) {
      await tx.insert(walletBalances).values(
        vaultAssets.map((a) => ({
          walletId: wallet.id,
          assetId: a.id,
          balance: '0',
          reserved: '0',
        })),
      );
    }
    return wallet;
  }

  async getWalletWithBalances(vaultId: number, userId: number) {
    const [wallet] = await this.db
      .select()
      .from(wallets)
      .where(and(eq(wallets.vaultId, vaultId), eq(wallets.userId, userId)));
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balances = await this.db
      .select({
        assetId: walletBalances.assetId,
        assetName: assets.name,
        balance: walletBalances.balance,
        reserved: walletBalances.reserved,
        isDecimal: assets.isDecimal,
      })
      .from(walletBalances)
      .innerJoin(assets, eq(walletBalances.assetId, assets.id))
      .where(eq(walletBalances.walletId, wallet.id));

    return {
      walletId: wallet.id,
      balances: balances.map((b) => ({
        ...b,
        available: (Number(b.balance) - Number(b.reserved)).toFixed(2),
      })),
    };
  }

  async getBalance(tx: TxDb, vaultId: number, userId: number, assetId: number) {
    const [row] = await tx
      .select({
        id: walletBalances.id,
        balance: walletBalances.balance,
        reserved: walletBalances.reserved,
      })
      .from(walletBalances)
      .innerJoin(wallets, eq(walletBalances.walletId, wallets.id))
      .where(
        and(
          eq(wallets.vaultId, vaultId),
          eq(wallets.userId, userId),
          eq(walletBalances.assetId, assetId),
        ),
      );
    return row;
  }

  async reserve(
    tx: TxDb,
    vaultId: number,
    userId: number,
    assetId: number,
    amount: string,
  ): Promise<boolean> {
    const row = await this.getBalance(tx, vaultId, userId, assetId);
    if (!row) return false;

    const available = Number(row.balance) - Number(row.reserved);
    const toReserve = Math.min(Number(amount), Math.max(available, 0));

    await tx
      .update(walletBalances)
      .set({ reserved: (Number(row.reserved) + toReserve).toFixed(2) })
      .where(eq(walletBalances.id, row.id));

    return toReserve >= Number(amount);
  }

  async releaseReservation(
    tx: TxDb,
    vaultId: number,
    userId: number,
    assetId: number,
    amount: string,
  ) {
    const row = await this.getBalance(tx, vaultId, userId, assetId);
    if (!row) return;

    const newReserved = Math.max(Number(row.reserved) - Number(amount), 0);
    await tx
      .update(walletBalances)
      .set({ reserved: newReserved.toFixed(2) })
      .where(eq(walletBalances.id, row.id));
  }

  async applyMovement(
    tx: TxDb,
    vaultId: number,
    userId: number,
    assetId: number,
    amount: string,
    type: 'injection' | 'extraction',
  ) {
    const row = await this.getBalance(tx, vaultId, userId, assetId);
    if (!row) throw new NotFoundException('Balance not found');

    const delta = type === 'injection' ? Number(amount) : -Number(amount);
    const newBalance = (Number(row.balance) + delta).toFixed(2);
    const newReserved =
      type === 'extraction'
        ? Math.max(Number(row.reserved) - Number(amount), 0).toFixed(2)
        : row.reserved;

    await tx
      .update(walletBalances)
      .set({ balance: newBalance, reserved: newReserved })
      .where(eq(walletBalances.id, row.id));
  }
}
