import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  vaults,
  vaultMembers,
  roles,
  assets,
  wallets,
  walletBalances,
  subOperations,
} from '../db/schema.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../common/enums/permissions.enum.js';
import { RolesService } from '../roles/roles.service.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateVaultDto } from './dto/create-vault.dto.js';
import { UpdateVaultDto } from './dto/update-vault.dto.js';

@Injectable()
export class VaultsService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly rolesService: RolesService,
    private readonly walletsService: WalletsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(ownerId: number, dto: CreateVaultDto) {
    return this.db.transaction(async (tx) => {
      const [vault] = await tx
        .insert(vaults)
        .values({ name: dto.name, description: dto.description ?? '', ownerId })
        .returning();

      // Create default roles
      const createdRoles = await this.rolesService.seedDefaults(tx, vault.id);

      // Assign owner role
      const ownerRole = createdRoles.find((r) => r.name === 'propietario')!;
      await tx.insert(vaultMembers).values({
        vaultId: vault.id,
        userId: ownerId,
        roleId: ownerRole.id,
      });

      // Create default assets: CUP, USD
      for (const name of ['CUP', 'USD']) {
        await tx
          .insert(assets)
          .values({ vaultId: vault.id, name, isDecimal: true });
      }

      // Create owner wallet
      await this.walletsService.createForUser(tx, vault.id, ownerId);

      return vault;
    });
  }

  async findOne(vaultId: number) {
    const [vault] = await this.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));
    if (!vault) throw new NotFoundException('Vault not found');

    // Public totals per asset
    const totals = await this.db
      .select({
        assetName: assets.name,
        total: sql<string>`COALESCE(SUM(CAST(${walletBalances.balance} AS NUMERIC)), 0)`,
      })
      .from(walletBalances)
      .innerJoin(wallets, eq(walletBalances.walletId, wallets.id))
      .innerJoin(assets, eq(walletBalances.assetId, assets.id))
      .where(eq(wallets.vaultId, vaultId))
      .groupBy(assets.name);

    return { ...vault, totals };
  }

  async getMembers(vaultId: number) {
    return this.db
      .select({
        userId: vaultMembers.userId,
        roleId: vaultMembers.roleId,
        roleName: roles.name,
        joinedAt: vaultMembers.joinedAt,
      })
      .from(vaultMembers)
      .innerJoin(roles, eq(vaultMembers.roleId, roles.id))
      .where(eq(vaultMembers.vaultId, vaultId));
  }

  async update(vaultId: number, dto: UpdateVaultDto, actorId: number) {
    const [vault] = await this.db
      .update(vaults)
      .set({ name: dto.name, description: dto.description })
      .where(eq(vaults.id, vaultId))
      .returning();
    if (!vault) throw new NotFoundException('Vault not found');

    await this.auditService.log(vaultId, actorId, 'vault_config_updated', {
      changes: dto,
    });
    return vault;
  }

  async transferOwnership(
    vaultId: number,
    newOwnerId: number,
    actorId: number,
  ) {
    const [vault] = await this.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));
    if (!vault) throw new NotFoundException('Vault not found');
    if (vault.ownerId !== actorId)
      throw new ForbiddenException('Only owner can transfer');

    // Verify new owner is a member
    const [membership] = await this.db
      .select()
      .from(vaultMembers)
      .where(
        and(
          eq(vaultMembers.vaultId, vaultId),
          eq(vaultMembers.userId, newOwnerId),
        ),
      );
    if (!membership) throw new BadRequestException('Target must be a member');

    await this.db.transaction(async (tx) => {
      await tx
        .update(vaults)
        .set({ ownerId: newOwnerId })
        .where(eq(vaults.id, vaultId));

      // Swap roles
      const ownerRole = await this.rolesService.getByName(
        tx,
        vaultId,
        'propietario',
      );
      await tx
        .update(vaultMembers)
        .set({ roleId: ownerRole.id })
        .where(
          and(
            eq(vaultMembers.vaultId, vaultId),
            eq(vaultMembers.userId, newOwnerId),
          ),
        );
    });

    await this.auditService.log(vaultId, actorId, 'ownership_transferred', {
      to: newOwnerId,
    });
  }

  async leaveVault(vaultId: number, userId: number) {
    const [vault] = await this.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));
    if (!vault) throw new NotFoundException('Vault not found');
    if (vault.ownerId === userId)
      throw new ForbiddenException('Owner must transfer ownership first');

    await this.assertZeroBalance(vaultId, userId);

    await this.db
      .delete(vaultMembers)
      .where(
        and(eq(vaultMembers.vaultId, vaultId), eq(vaultMembers.userId, userId)),
      );
  }

  async expelMember(vaultId: number, targetUserId: number, actorId: number) {
    const [vault] = await this.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));
    if (!vault) throw new NotFoundException('Vault not found');
    if (vault.ownerId === targetUserId)
      throw new ForbiddenException('Cannot expel owner');

    // Cannot expel admin if actor is admin (only owner can manage admins)
    if (vault.ownerId !== actorId) {
      const [targetMember] = await this.db
        .select({ roleName: roles.name })
        .from(vaultMembers)
        .innerJoin(roles, eq(vaultMembers.roleId, roles.id))
        .where(
          and(
            eq(vaultMembers.vaultId, vaultId),
            eq(vaultMembers.userId, targetUserId),
          ),
        );
      if (targetMember?.roleName === 'administrador')
        throw new ForbiddenException('Only owner can expel admins');
    }

    await this.assertZeroBalance(vaultId, targetUserId);

    await this.db.transaction(async (tx) => {
      // Cancel pending sub-operations of expelled user
      await tx
        .update(subOperations)
        .set({ status: 'cancelled', resolvedAt: new Date() })
        .where(
          and(
            eq(subOperations.targetUserId, targetUserId),
            eq(subOperations.status, 'pending'),
          ),
        );

      await tx
        .delete(vaultMembers)
        .where(
          and(
            eq(vaultMembers.vaultId, vaultId),
            eq(vaultMembers.userId, targetUserId),
          ),
        );
    });

    await this.auditService.log(vaultId, actorId, 'member_expelled', {
      targetUserId,
    });
    await this.notificationsService.send(targetUserId, 'expelled', {
      vaultId,
    });
  }

  private async assertZeroBalance(vaultId: number, userId: number) {
    const [wallet] = await this.db
      .select()
      .from(wallets)
      .where(and(eq(wallets.vaultId, vaultId), eq(wallets.userId, userId)));
    if (!wallet) return;

    const [nonZero] = await this.db
      .select()
      .from(walletBalances)
      .where(
        and(
          eq(walletBalances.walletId, wallet.id),
          sql`${walletBalances.balance} != 0`,
        ),
      )
      .limit(1);
    if (nonZero)
      throw new ConflictException('User has non-zero balance; liquidate first');
  }
}
