import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { roles, vaultMembers, vaults } from '../db/schema.js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  type Permission,
} from '../common/enums/permissions.enum.js';
import { AuditService } from '../audit/audit.service.js';

export type TxDb =
  | NodePgDatabase
  | Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

@Injectable()
export class RolesService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly auditService: AuditService,
  ) {}

  async seedDefaults(tx: TxDb, vaultId: number) {
    const created = [];
    for (const [name, permissions] of Object.entries(
      DEFAULT_ROLE_PERMISSIONS,
    )) {
      const [role] = await tx
        .insert(roles)
        .values({ vaultId, name, permissions, isDefault: true })
        .returning();
      created.push(role);
    }
    return created;
  }

  async getByName(tx: TxDb, vaultId: number, name: string) {
    const [role] = await tx
      .select()
      .from(roles)
      .where(and(eq(roles.vaultId, vaultId), eq(roles.name, name)));
    if (!role) throw new NotFoundException(`Role "${name}" not found`);
    return role;
  }

  async getVaultRoles(vaultId: number) {
    return this.db.select().from(roles).where(eq(roles.vaultId, vaultId));
  }

  async updateRolePermissions(
    vaultId: number,
    roleId: number,
    permissions: Record<Permission, boolean>,
    actorId: number,
  ) {
    const [vault] = await this.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));
    if (vault?.ownerId !== actorId)
      throw new ForbiddenException('Only owner can edit roles');

    const [role] = await this.db
      .update(roles)
      .set({ permissions })
      .where(and(eq(roles.id, roleId), eq(roles.vaultId, vaultId)))
      .returning();
    if (!role) throw new NotFoundException('Role not found');

    await this.auditService.log(vaultId, actorId, 'role_permissions_updated', {
      roleId,
      permissions,
    });
    return role;
  }

  async changeMemberRole(
    vaultId: number,
    targetUserId: number,
    newRoleId: number,
    actorId: number,
  ) {
    const [vault] = await this.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));
    if (vault?.ownerId !== actorId)
      throw new ForbiddenException('Only owner can change roles');
    if (vault?.ownerId === targetUserId)
      throw new ForbiddenException('Cannot change owner role');

    const [member] = await this.db
      .update(vaultMembers)
      .set({ roleId: newRoleId })
      .where(
        and(
          eq(vaultMembers.vaultId, vaultId),
          eq(vaultMembers.userId, targetUserId),
        ),
      )
      .returning();
    if (!member) throw new NotFoundException('Member not found');

    await this.auditService.log(vaultId, actorId, 'member_role_changed', {
      targetUserId,
      newRoleId,
    });
    await this.auditService.notifyRoleChange(targetUserId, vaultId, newRoleId);
    return member;
  }
}
