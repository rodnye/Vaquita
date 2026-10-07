import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { VAULT_PERMISSION_KEY } from '../decorators/vault-permission.decorator.js';
import type { Permission } from '../enums/permissions.enum.js';
import { vaultMembers, roles, vaults } from '../../db/schema.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class VaultPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDrizzle() private readonly db: NodePgDatabase,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission>(
      VAULT_PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!permission) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    const vaultId = Number(
      request.params.vaultId ?? request.body?.vaultId ?? request.query?.vaultId,
    );
    if (!vaultId) throw new ForbiddenException('vaultId required');

    // Owner bypass
    const [vault] = await this.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));
    if (vault?.ownerId === user.sub) return true;

    const [member] = await this.db
      .select({ permissions: roles.permissions })
      .from(vaultMembers)
      .innerJoin(roles, eq(vaultMembers.roleId, roles.id))
      .where(
        and(
          eq(vaultMembers.vaultId, vaultId),
          eq(vaultMembers.userId, user.sub),
        ),
      );

    if (!member) throw new ForbiddenException('Not a member');
    const perms = member.permissions as Record<string, boolean>;
    if (!perms[permission])
      throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
