// UI permissions per role. These mirror firestore.rules, which is what actually enforces them.
export const ROLES = {
  accountant: {
    label: 'Accountant',
    badgeText: 'Full Financial Access',
    canRegister: true,
    canPay: true,
    canEdit: true,
    canReverse: true,
    canExport: true,
    canViewAudit: true,
    canManageUsers: true,
  },
  social_worker: {
    label: 'Social Worker',
    badgeText: 'Social Worker Permissions',
    canRegister: true,
    canPay: true,
    canEdit: false,
    canReverse: false,
    canExport: true,
    canViewAudit: false,
    canManageUsers: false,
  },
  auditor: {
    label: 'Auditor',
    badgeText: 'Audit & Read-Only Access',
    canRegister: false,
    canPay: false,
    canEdit: false,
    canReverse: false,
    canExport: true,
    canViewAudit: true,
    canManageUsers: false,
  },
}

export const ROLE_KEYS = Object.keys(ROLES)

export function permissionsFor(role) {
  return ROLES[role] ?? null
}
