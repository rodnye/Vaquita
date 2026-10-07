import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../enums/permissions.enum.js';

export const VAULT_PERMISSION_KEY = 'vault_permission';
export const RequireVaultPermission = (permission: Permission) =>
  SetMetadata(VAULT_PERMISSION_KEY, permission);
