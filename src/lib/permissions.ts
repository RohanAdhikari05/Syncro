import type { ProjectRole } from '@/types/project'

export function canManageProject(role: ProjectRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canCreateTask(role: ProjectRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canDeleteProject(role: ProjectRole | null | undefined): boolean {
  return role === 'OWNER'
}

export function canManageMembers(role: ProjectRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canChangeMemberRole(
  actorRole: ProjectRole | null | undefined,
  targetRole: ProjectRole,
): boolean {
  if (actorRole === 'OWNER') {
    return targetRole !== 'OWNER'
  }
  if (actorRole === 'ADMIN') {
    return targetRole === 'MEMBER'
  }
  return false
}

export function canRemoveMember(
  actorRole: ProjectRole | null | undefined,
  targetRole: ProjectRole,
  isSelf: boolean,
): boolean {
  if (isSelf) {
    return targetRole !== 'OWNER'
  }
  if (actorRole === 'OWNER') {
    return targetRole !== 'OWNER'
  }
  if (actorRole === 'ADMIN') {
    return targetRole === 'MEMBER'
  }
  return false
}

export function canEditTask(
  role: ProjectRole | null | undefined,
  isCreator: boolean,
  isAssignee: boolean,
): boolean {
  return canManageProject(role) || isCreator || isAssignee
}

export function canDeleteTask(
  role: ProjectRole | null | undefined,
  isCreator: boolean,
): boolean {
  return canManageProject(role) || isCreator
}

export function roleLabel(role: ProjectRole | string | undefined): string {
  switch (role) {
    case 'OWNER':
      return 'Owner'
    case 'ADMIN':
      return 'Admin'
    case 'MEMBER':
      return 'Member'
    default:
      return 'Member'
  }
}
