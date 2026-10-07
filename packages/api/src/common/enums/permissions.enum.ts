export const PERMISSIONS = {
  MANAGE_VAULT_CONFIG: 'manage_vault_config',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_MEMBERS: 'manage_members',
  MANAGE_ASSETS: 'manage_assets',
  CREATE_OPERATIONS: 'create_operations',
  ACCEPT_REJECT_SUBOPS: 'accept_reject_subops',
  CANCEL_OPERATIONS: 'cancel_operations',
  VIEW_HISTORY: 'view_history',
  EXPORT_HISTORY: 'export_history',
  INVITE_MEMBERS: 'invite_members',
  REVOKE_INVITATIONS: 'revoke_invitations',
  CONVERT_OPERATIONS: 'convert_operations',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const DEFAULT_ROLE_PERMISSIONS: Record<
  string,
  Record<Permission, boolean>
> = {
  propietario: Object.fromEntries(
    Object.values(PERMISSIONS).map((p) => [p, true]),
  ) as Record<Permission, boolean>,
  administrador: {
    [PERMISSIONS.MANAGE_VAULT_CONFIG]: false,
    [PERMISSIONS.MANAGE_ROLES]: false,
    [PERMISSIONS.MANAGE_MEMBERS]: true,
    [PERMISSIONS.MANAGE_ASSETS]: false,
    [PERMISSIONS.CREATE_OPERATIONS]: true,
    [PERMISSIONS.ACCEPT_REJECT_SUBOPS]: true,
    [PERMISSIONS.CANCEL_OPERATIONS]: false,
    [PERMISSIONS.VIEW_HISTORY]: true,
    [PERMISSIONS.EXPORT_HISTORY]: false,
    [PERMISSIONS.INVITE_MEMBERS]: true,
    [PERMISSIONS.REVOKE_INVITATIONS]: true,
    [PERMISSIONS.CONVERT_OPERATIONS]: true,
  },
  participante: {
    [PERMISSIONS.MANAGE_VAULT_CONFIG]: false,
    [PERMISSIONS.MANAGE_ROLES]: false,
    [PERMISSIONS.MANAGE_MEMBERS]: false,
    [PERMISSIONS.MANAGE_ASSETS]: false,
    [PERMISSIONS.CREATE_OPERATIONS]: true,
    [PERMISSIONS.ACCEPT_REJECT_SUBOPS]: true,
    [PERMISSIONS.CANCEL_OPERATIONS]: false,
    [PERMISSIONS.VIEW_HISTORY]: true,
    [PERMISSIONS.EXPORT_HISTORY]: false,
    [PERMISSIONS.INVITE_MEMBERS]: false,
    [PERMISSIONS.REVOKE_INVITATIONS]: false,
    [PERMISSIONS.CONVERT_OPERATIONS]: false,
  },
  invitado: {
    [PERMISSIONS.MANAGE_VAULT_CONFIG]: false,
    [PERMISSIONS.MANAGE_ROLES]: false,
    [PERMISSIONS.MANAGE_MEMBERS]: false,
    [PERMISSIONS.MANAGE_ASSETS]: false,
    [PERMISSIONS.CREATE_OPERATIONS]: false,
    [PERMISSIONS.ACCEPT_REJECT_SUBOPS]: false,
    [PERMISSIONS.CANCEL_OPERATIONS]: false,
    [PERMISSIONS.VIEW_HISTORY]: true,
    [PERMISSIONS.EXPORT_HISTORY]: false,
    [PERMISSIONS.INVITE_MEMBERS]: false,
    [PERMISSIONS.REVOKE_INVITATIONS]: false,
    [PERMISSIONS.CONVERT_OPERATIONS]: false,
  },
};
