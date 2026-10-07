import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { invitations, vaultMembers, roles } from '../db/schema.js';
import { UsersService } from '../users/users.service.js';
import { RolesService } from '../roles/roles.service.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const EXPIRY_HOURS = 24;

@Injectable()
export class InvitationsService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly walletsService: WalletsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(vaultId: number, inviterId: number, inviteeId: number) {
    await this.usersService.getByIdOrThrow(inviteeId);

    // Check not already member
    const [existing] = await this.db
      .select()
      .from(vaultMembers)
      .where(
        and(
          eq(vaultMembers.vaultId, vaultId),
          eq(vaultMembers.userId, inviteeId),
        ),
      );
    if (existing) throw new ConflictException('User is already a member');

    // Check no pending invitation
    const [pending] = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.vaultId, vaultId),
          eq(invitations.inviteeId, inviteeId),
          eq(invitations.status, 'pending'),
        ),
      );
    if (pending)
      throw new ConflictException('Pending invitation already exists');

    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);
    const [invitation] = await this.db
      .insert(invitations)
      .values({ vaultId, inviterId, inviteeId, expiresAt })
      .returning();

    await this.notificationsService.send(inviteeId, 'invitation_sent', {
      vaultId,
      invitationId: invitation.id,
      inviterId,
    });
    return invitation;
  }

  async getSentByMe(vaultId: number, userId: number) {
    return this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.vaultId, vaultId),
          eq(invitations.inviterId, userId),
        ),
      );
  }

  async getReceivedByMe(userId: number) {
    return this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.inviteeId, userId),
          eq(invitations.status, 'pending'),
        ),
      );
  }

  async accept(invitationId: number, userId: number) {
    const inv = await this.getValidInvitation(invitationId, userId, 'invitee');

    await this.db.transaction(async (tx) => {
      await tx
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, invitationId));

      // Add as participante
      const participantRole = await this.rolesService.getByName(
        tx,
        inv.vaultId,
        'participante',
      );
      await tx.insert(vaultMembers).values({
        vaultId: inv.vaultId,
        userId,
        roleId: participantRole.id,
      });

      await this.walletsService.createForUser(tx, inv.vaultId, userId);
    });

    await this.notificationsService.send(inv.inviterId, 'invitation_accepted', {
      vaultId: inv.vaultId,
      inviteeId: userId,
    });
  }

  async reject(invitationId: number, userId: number) {
    const inv = await this.getValidInvitation(invitationId, userId, 'invitee');
    await this.db
      .update(invitations)
      .set({ status: 'rejected' })
      .where(eq(invitations.id, invitationId));

    await this.notificationsService.send(inv.inviterId, 'invitation_rejected', {
      vaultId: inv.vaultId,
      inviteeId: userId,
    });
  }

  async revoke(invitationId: number, actorId: number) {
    const [inv] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId));
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'pending')
      throw new ConflictException('Invitation is no longer pending');
    if (inv.inviterId !== actorId)
      throw new ForbiddenException(
        'Only the inviter or owner/admin can revoke',
      );

    await this.db
      .update(invitations)
      .set({ status: 'revoked' })
      .where(eq(invitations.id, invitationId));

    await this.notificationsService.send(inv.inviteeId, 'invitation_revoked', {
      vaultId: inv.vaultId,
    });
  }

  private async getValidInvitation(
    invitationId: number,
    userId: number,
    role: 'invitee' | 'inviter',
  ) {
    const [inv] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId));
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'pending')
      throw new ConflictException('Invitation is no longer pending');
    if (new Date() > inv.expiresAt) {
      await this.db
        .update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, invitationId));
      throw new ConflictException('Invitation expired');
    }
    const expectedId = role === 'invitee' ? inv.inviteeId : inv.inviterId;
    if (expectedId !== userId)
      throw new ForbiddenException('Not authorized for this invitation');
    return inv;
  }
}
