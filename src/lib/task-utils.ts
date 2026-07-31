import type { TaskStatus } from '@/lib/taskStore'

export function normalizeTaskStatus(status?: string): TaskStatus {
  const value = (status ?? '').toUpperCase()
  if (value === 'DONE') return 'done'
  if (value === 'IN_PROGRESS' || value === 'INPROGRESS') return 'in_progress'
  return 'todo'
}

export function buildAssigneesFromApi(apiTask: any, currentUserId?: string | null) {
  if (apiTask?.assignee) {
    const name = apiTask.assignee?.name ?? 'Unknown User'
    return [
      {
        id: apiTask.assignee.id ?? '',
        name,
        initials:
          name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part: string) => part[0]?.toUpperCase() ?? '')
            .join('') || 'U',
        color: '#6366f1',
        text: '#ffffff',
        isMe: currentUserId ? apiTask.assignee.id === currentUserId : false,
      },
    ]
  }

  if (Array.isArray(apiTask?.assignees) && apiTask.assignees.length > 0) {
    return apiTask.assignees.map((assignee: any) => ({
      id: assignee?.id ?? '',
      name: assignee?.name ?? 'Unassigned',
      initials:
        (assignee?.name ?? 'Unassigned')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part: string) => part[0]?.toUpperCase() ?? '')
          .join('') || 'U',
      color: assignee?.color ?? '#6366f1',
      text: assignee?.text ?? '#ffffff',
      isMe: Boolean(assignee?.isMe),
    }))
  }

  return []
}

export function mapProjectMembers(members: any[] | undefined) {
  if (!Array.isArray(members)) return []
  return members.map((m) => ({
    id: m.userId || m.id,
    name: m.name || 'Unknown',
  }))
}
