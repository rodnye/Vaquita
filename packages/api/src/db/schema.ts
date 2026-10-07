import { relations } from 'drizzle-orm/_relations';
import {
  pgTable,
  integer,
  text,
  boolean,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const operationCategoryEnum = pgEnum('operation_category', [
  'transaction',
  'task',
]);
export const operationStatusEnum = pgEnum('operation_status', [
  'active',
  'completed',
  'cancelled',
]);
export const subOpTypeEnum = pgEnum('sub_op_type', ['injection', 'extraction']);
export const subOpStatusEnum = pgEnum('sub_op_status', [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
]);
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'rejected',
  'revoked',
  'expired',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'invitation_sent',
  'invitation_accepted',
  'invitation_rejected',
  'invitation_expired',
  'invitation_revoked',
  'subop_affects_you',
  'subop_accepted',
  'subop_rejected',
  'operation_completed',
  'operation_cancelled',
  'role_changed',
  'expelled',
  'config_changed',
  'asset_changed',
]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Vaults ──────────────────────────────────────────────────────────────────

export const vaults = pgTable('vaults', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Roles ───────────────────────────────────────────────────────────────────

export const roles = pgTable('roles', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  vaultId: integer('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  permissions: jsonb('permissions').notNull().$type<Record<string, boolean>>(),
  isDefault: boolean('is_default').notNull().default(false),
});

// ─── Vault Members ───────────────────────────────────────────────────────────

export const vaultMembers = pgTable(
  'vault_members',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vaultId: integer('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_vault_member').on(t.vaultId, t.userId)],
);

// ─── Assets ──────────────────────────────────────────────────────────────────

export const assets = pgTable('assets', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  vaultId: integer('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isDecimal: boolean('is_decimal').notNull().default(true),
  allowNegative: boolean('allow_negative').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
});

// ─── Wallets & Balances ──────────────────────────────────────────────────────

export const wallets = pgTable(
  'wallets',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vaultId: integer('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('uq_wallet').on(t.vaultId, t.userId)],
);

export const walletBalances = pgTable(
  'wallet_balances',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    walletId: integer('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    assetId: integer('asset_id')
      .notNull()
      .references(() => assets.id),
    balance: numeric('balance', { precision: 18, scale: 2 })
      .notNull()
      .default('0'),
    reserved: numeric('reserved', { precision: 18, scale: 2 })
      .notNull()
      .default('0'),
  },
  (t) => [uniqueIndex('uq_wallet_asset').on(t.walletId, t.assetId)],
);

// ─── Invitations ─────────────────────────────────────────────────────────────

export const invitations = pgTable('invitations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  vaultId: integer('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  inviterId: integer('inviter_id')
    .notNull()
    .references(() => users.id),
  inviteeId: integer('invitee_id')
    .notNull()
    .references(() => users.id),
  status: invitationStatusEnum('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Operations ──────────────────────────────────────────────────────────────

export const operations = pgTable('operations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  vaultId: integer('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => users.id),
  category: operationCategoryEnum('category').notNull(),
  status: operationStatusEnum('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const subOperations = pgTable('sub_operations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  operationId: integer('operation_id')
    .notNull()
    .references(() => operations.id, { onDelete: 'cascade' }),
  targetUserId: integer('target_user_id')
    .notNull()
    .references(() => users.id),
  assetId: integer('asset_id')
    .notNull()
    .references(() => assets.id),
  type: subOpTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  description: text('description').notNull().default(''),
  isRequired: boolean('is_required').notNull().default(true),
  status: subOpStatusEnum('status').notNull().default('pending'),
  insufficientFunds: boolean('insufficient_funds').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('idx_notif_user').on(t.userId, t.isRead)],
);

// ─── Audit Log ───────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  'audit_log',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    vaultId: integer('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    detail: jsonb('detail').notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('idx_audit_vault').on(t.vaultId, t.createdAt)],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  vaultMemberships: many(vaultMembers),
  wallets: many(wallets),
  notifications: many(notifications),
}));

export const vaultsRelations = relations(vaults, ({ one, many }) => ({
  owner: one(users, { fields: [vaults.ownerId], references: [users.id] }),
  members: many(vaultMembers),
  roles: many(roles),
  assets: many(assets),
  wallets: many(wallets),
  operations: many(operations),
}));

export const vaultMembersRelations = relations(vaultMembers, ({ one }) => ({
  vault: one(vaults, {
    fields: [vaultMembers.vaultId],
    references: [vaults.id],
  }),
  user: one(users, { fields: [vaultMembers.userId], references: [users.id] }),
  role: one(roles, { fields: [vaultMembers.roleId], references: [roles.id] }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  vault: one(vaults, { fields: [wallets.vaultId], references: [vaults.id] }),
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
  balances: many(walletBalances),
}));

export const walletBalancesRelations = relations(walletBalances, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletBalances.walletId],
    references: [wallets.id],
  }),
  asset: one(assets, {
    fields: [walletBalances.assetId],
    references: [assets.id],
  }),
}));

export const operationsRelations = relations(operations, ({ one, many }) => ({
  vault: one(vaults, { fields: [operations.vaultId], references: [vaults.id] }),
  creator: one(users, {
    fields: [operations.creatorId],
    references: [users.id],
  }),
  subOperations: many(subOperations),
}));

export const subOperationsRelations = relations(subOperations, ({ one }) => ({
  operation: one(operations, {
    fields: [subOperations.operationId],
    references: [operations.id],
  }),
  targetUser: one(users, {
    fields: [subOperations.targetUserId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [subOperations.assetId],
    references: [assets.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Vault = typeof vaults.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type VaultMember = typeof vaultMembers.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletBalance = typeof walletBalances.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Operation = typeof operations.$inferSelect;
export type SubOperation = typeof subOperations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
