// ============================================================
// PERMISSIONS — Centralized permission matrix
// Keep in sync with database RLS policies
// ============================================================

import type { UserRole } from '@/types/database'

export type Permission =
  // Order permissions
  | 'orders:read'
  | 'orders:create'
  | 'orders:update'
  | 'orders:delete'
  | 'orders:import'
  | 'orders:export'
  | 'orders:assign'
  | 'orders:reassign'
  | 'orders:cancel'
  // Driver permissions
  | 'drivers:read'
  | 'drivers:create'
  | 'drivers:update'
  | 'drivers:delete'
  | 'drivers:suspend'
  // User / role permissions
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'users:manage_roles'
  // Reports
  | 'reports:read'
  | 'reports:export'
  // Settings
  | 'settings:read'
  | 'settings:update'
  // Audit
  | 'audit:read'
  // Status changes (driver-specific)
  | 'orders:mark_in_transit'
  | 'orders:mark_delivered'
  | 'orders:mark_failed'
  | 'orders:reschedule'
  | 'orders:add_evidence'
  | 'orders:report_incident'
  // WhatsApp
  | 'whatsapp:send'
  | 'whatsapp:manage_templates'
  // Notifications
  | 'notifications:read'

/**
 * Permission matrix — which roles have which permissions.
 * This is the single source of truth for authorization logic.
 */
export const PERMISSIONS: Record<Permission, UserRole[]> = {
  // Orders
  'orders:read': ['super_admin', 'admin', 'supervisor', 'driver'],
  'orders:create': ['super_admin', 'admin'],
  'orders:update': ['super_admin', 'admin', 'supervisor'],
  'orders:delete': ['super_admin', 'admin'],
  'orders:import': ['super_admin', 'admin'],
  'orders:export': ['super_admin', 'admin', 'supervisor'],
  'orders:assign': ['super_admin', 'admin', 'supervisor'],
  'orders:reassign': ['super_admin', 'admin', 'supervisor'],
  'orders:cancel': ['super_admin', 'admin'],

  // Drivers
  'drivers:read': ['super_admin', 'admin', 'supervisor'],
  'drivers:create': ['super_admin', 'admin'],
  'drivers:update': ['super_admin', 'admin'],
  'drivers:delete': ['super_admin'],
  'drivers:suspend': ['super_admin', 'admin'],

  // Users
  'users:read': ['super_admin', 'admin'],
  'users:create': ['super_admin', 'admin'],
  'users:update': ['super_admin', 'admin'],
  'users:delete': ['super_admin'],
  'users:manage_roles': ['super_admin'],

  // Reports
  'reports:read': ['super_admin', 'admin', 'supervisor'],
  'reports:export': ['super_admin', 'admin'],

  // Settings
  'settings:read': ['super_admin', 'admin'],
  'settings:update': ['super_admin', 'admin'],

  // Audit
  'audit:read': ['super_admin', 'admin'],

  // Driver actions
  'orders:mark_in_transit': ['super_admin', 'admin', 'supervisor', 'driver'],
  'orders:mark_delivered': ['super_admin', 'admin', 'supervisor', 'driver'],
  'orders:mark_failed': ['super_admin', 'admin', 'supervisor', 'driver'],
  'orders:reschedule': ['super_admin', 'admin', 'supervisor', 'driver'],
  'orders:add_evidence': ['super_admin', 'admin', 'supervisor', 'driver'],
  'orders:report_incident': ['super_admin', 'admin', 'supervisor', 'driver'],

  // WhatsApp
  'whatsapp:send': ['super_admin', 'admin', 'supervisor', 'driver'],
  'whatsapp:manage_templates': ['super_admin', 'admin'],

  // Notifications
  'notifications:read': ['super_admin', 'admin', 'supervisor', 'driver'],
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role)
}

/**
 * Check if a role has ALL of the given permissions.
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

/**
 * Check if a role has ANY of the given permissions.
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

/**
 * Returns true if the role is admin-level or above.
 */
export function isAdminOrAbove(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin'
}

/**
 * Returns true if the role is supervisor-level or above.
 */
export function isSupervisorOrAbove(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'supervisor'
}

/**
 * Returns the default redirect path for a given role after login.
 */
export function getDefaultRedirectPath(role: UserRole): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/admin/dashboard'
    case 'supervisor':
      return '/admin/operations'
    case 'driver':
      return '/driver'
    default:
      return '/login'
  }
}
