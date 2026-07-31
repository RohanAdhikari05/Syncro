'use client'

import { useAuth } from '@clerk/nextjs'
import type { ProjectRole } from '@/types/project'
import { apiFetch } from '@/lib/api-client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done'

type ProjectStatus = 'active' | 'paused' | 'done'

/** A flattened, UI-ready task object shared across all pages */
export interface StoreTask {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  createdAt: string
  projectId: string
  projectName: string
  tags: { label: string; color: string }[]
  assignees: {
    id: string
    name: string
    initials: string
    color: string
    text: string
    isMe?: boolean
  }[]
}

export interface StoreProject {
  id: string
  name: string
  description: string
  color: string
  priority: 'high' | 'medium' | 'low'
  status: ProjectStatus
  currentUserRole?: ProjectRole | null
  lead: { initials: string; name: string; color: string; text: string }
  members: {
    id?: string
    userId?: string
    role?: ProjectRole
    initials: string
    color: string
    text: string
    name: string
  }[]
}

interface TaskStore {
  /** All tasks, as a flat array */
  tasks: StoreTask[]
  /** All projects, as a flat array */
  projects: StoreProject[]
  /** Whether initial data is loading */
  isLoading: boolean
  /** Any request error */
  error: string | null
  /** Add a new task */
  addTask: (task: Omit<StoreTask, 'id' | 'createdAt'>) => Promise<void>
  /** Move a task to a new status */
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>
  /** Refresh data from the backend */
  refreshData: () => Promise<void>
  /** Create a new project */
  createProject: (input: { name: string; description: string }) => Promise<StoreProject | null>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeTaskStatus(status?: string): TaskStatus {
  const value = (status ?? '').toUpperCase()
  if (value === 'DONE') return 'done'
  if (value === 'IN_PROGRESS' || value === 'INPROGRESS') return 'in_progress'
  return 'todo'
}

function normalizeProjectStatus(status?: string): ProjectStatus {
  const value = (status ?? 'active').toLowerCase()
  if (value === 'completed') return 'done'
  if (value === 'archived') return 'paused'
  return 'active'
}

function formatDateForUi(input?: string | null): string | undefined {
  if (!input) return undefined
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PR'
}

function toColor(name: string) {
  const palette = ['#6366f1', '#0f766e', '#f59e0b', '#ef4444', '#8b5cf6']
  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

function mapProject(raw: any): StoreProject {
  const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name : 'Untitled project'
  const description = typeof raw?.description === 'string' ? raw.description : ''
  const color = typeof raw?.color === 'string' ? raw.color : toColor(name)

  const members = Array.isArray(raw?.members)
    ? raw.members.map((m: any) => {
        const mName = m?.name || 'Unknown User'
        return {
          id: m?.id,
          userId: m?.userId,
          role: m?.role,
          initials: buildInitials(mName),
          color: toColor(mName),
          text: '#ffffff',
          name: mName,
        }
      })
    : []

  const owner = members.find((m: any) => m.role === 'OWNER') || members[0] || {
    initials: buildInitials('Owner'),
    name: 'Owner',
    color,
    text: '#ffffff'
  }

  return {
    id: raw?.id ?? '',
    name,
    description,
    color,
    priority: 'medium',
    status: normalizeProjectStatus(raw?.status),
    currentUserRole: raw?.currentUserRole ?? null,
    lead: {
      initials: owner.initials,
      name: owner.name,
      color: owner.color,
      text: owner.text,
    },
    members,
  }
}

function mapTask(raw: any, projectLookup: Record<string, StoreProject>): StoreTask {
  const projectName =
    typeof raw?.project?.name === 'string'
      ? raw.project.name
      : typeof raw?.projectName === 'string'
        ? raw.projectName
        : projectLookup[raw?.projectId ?? '']?.name ?? 'Unknown project'

  const assignees = Array.isArray(raw?.assignees)
    ? raw.assignees.map((assignee: any) => {
        const aName = assignee?.name || 'Unknown User'
        return {
          id: assignee?.id ?? '',
          name: aName,
          initials: buildInitials(aName),
          color: assignee?.color ?? toColor(aName),
          text: assignee?.text ?? '#ffffff',
          isMe: Boolean(assignee?.isMe),
        }
      })
    : []

  if (raw?.assignee) {
    const aName = raw.assignee?.name || 'Unknown User'
    assignees.push({
      id: raw.assignee.id ?? '',
      name: aName,
      initials: buildInitials(aName),
      color: toColor(aName),
      text: '#ffffff',
    })
  } else if (raw?.assigneeId && assignees.length === 0) {
    assignees.push({
      id: raw.assigneeId,
      name: 'Unknown User',
      initials: 'UU',
      color: '#6366f1',
      text: '#ffffff',
    })
  }

  return {
    id: raw?.id ?? '',
    title: raw?.title ?? 'Untitled task',
    description: raw?.description ?? '',
    status: normalizeTaskStatus(raw?.status),
    priority: (raw?.priority ?? 'medium').toLowerCase(),
    dueDate: formatDateForUi(raw?.dueDate),
    createdAt: formatDateForUi(raw?.createdAt) ?? 'Recently created',
    projectId: raw?.projectId ?? '',
    projectName,
    tags:
      Array.isArray(raw?.tags) && raw.tags.length > 0
        ? raw.tags
        : [
            {
              label: normalizeTaskStatus(raw?.status) === 'done' ? 'Done' : normalizeTaskStatus(raw?.status) === 'in_progress' ? 'In Progress' : 'Todo',
              color:
                normalizeTaskStatus(raw?.status) === 'done'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : normalizeTaskStatus(raw?.status) === 'in_progress'
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'bg-muted/20 text-muted-foreground',
            },
          ],
    assignees,
  }
}

function buildAuthHeaders(token: string | null) {
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

// ── Context ───────────────────────────────────────────────────────────────────

const TaskStoreContext = createContext<TaskStore | null>(null)

export function TaskStoreProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [tasks, setTasks] = useState<StoreTask[]>([])
  const [projects, setProjects] = useState<StoreProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setTasks([])
      setProjects([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken({ template: 'postman' })
      const headers = buildAuthHeaders(token)

      const [projectsResponse, tasksResponse] = await Promise.all([
        apiFetch<{ success?: boolean; projects?: unknown[]; error?: string }>(
          '/api/v1/projects',
          { token },
        ),
        apiFetch<{ success?: boolean; tasks?: unknown[]; error?: string }>(
          '/api/v1/tasks',
          { token },
        ),
      ])

      if (!projectsResponse.ok) {
        throw new Error(projectsResponse.error)
      }
      if (!tasksResponse.ok) {
        throw new Error(tasksResponse.error)
      }

      const projectsData = projectsResponse.data
      const tasksData = tasksResponse.data

      const mappedProjects = Array.isArray(projectsData?.projects)
        ? projectsData.projects.map(mapProject)
        : []
      const projectLookup = Object.fromEntries(mappedProjects.map((project: StoreProject) => [project.id, project]))

      setProjects(mappedProjects)
      setTasks(
        Array.isArray(tasksData?.tasks)
          ? tasksData.tasks.map((task: any) => mapTask(task, projectLookup))
          : [],
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
      setTasks([])
      setProjects([])
    } finally {
      setIsLoading(false)
    }
  }, [getToken, isLoaded, isSignedIn])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const addTask = useCallback(async (task: Omit<StoreTask, 'id' | 'createdAt'>) => {
    const token = await getToken({ template: 'postman' })
    const headers = buildAuthHeaders(token)

    const response = await fetch('/api/v1/tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        status: task.status.toUpperCase(),
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to create task')
    }

    const mappedProjects = [...projects]
    const projectLookup = Object.fromEntries(mappedProjects.map((project) => [project.id, project]))
    setTasks((prev) => [mapTask(data.task, projectLookup), ...prev])
  }, [getToken])

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const token = await getToken({ template: 'postman' })
    const headers = buildAuthHeaders(token)

    const response = await fetch(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: status.toUpperCase() }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to update task')
    }

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)))
  }, [getToken])

  const createProject = useCallback(async (input: { name: string; description: string }) => {
    const token = await getToken({ template: 'postman' })
    const headers = buildAuthHeaders(token)

    const response = await fetch('/api/v1/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to create project')
    }

    const createdProject = mapProject(data.project)
    setProjects((prev) => [createdProject, ...prev])
    return createdProject
  }, [getToken])

  const value = useMemo(
    () => ({
      tasks,
      projects,
      isLoading,
      error,
      addTask,
      updateTaskStatus,
      refreshData,
      createProject,
    }),
    [tasks, projects, isLoading, error, addTask, updateTaskStatus, refreshData, createProject],
  )

  return (
    <TaskStoreContext.Provider value={value}>
      {children}
    </TaskStoreContext.Provider>
  )
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskStoreContext)
  if (!ctx) throw new Error('useTaskStore must be used within <TaskStoreProvider>')
  return ctx
}

/** Returns tasks for a specific project, grouped by status */
export function useProjectTasks(projectId: string) {
  const { tasks } = useTaskStore()
  return useMemo(
    () => tasks.filter((t) => t.projectId === projectId),
    [tasks, projectId],
  )
}

/** Returns all projects available for task selection */
export function useProjectOptions() {
  const { projects } = useTaskStore()
  return useMemo(
    () =>
      projects.map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
      })),
    [projects],
  )
}
