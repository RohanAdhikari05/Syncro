'use client'

import { useState, use, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldError, StatusMessage } from '@/components/shared/StatusMessage'
import { apiFetch } from '@/lib/api-client'
import { canDeleteTask, canEditTask } from '@/lib/permissions'
import {
  buildAssigneesFromApi,
  mapProjectMembers,
  normalizeTaskStatus,
} from '@/lib/task-utils'
import type { ProjectRole } from '@/types/project'
import {
  validateDueDate,
  validateTaskTitle,
  type FieldErrors,
} from '@/lib/validation'
import type { TaskStatus } from '@/lib/taskStore'

const statusStyles: Record<TaskStatus, string> = {
  todo: 'bg-muted/70 text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  done: 'bg-green-500/15 text-green-300',
}

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
}

function getProjectName(
  projectId: string,
  projectNameById: Map<string, string>,
  fallback = 'Unknown project',
) {
  return projectNameById.get(projectId) ?? fallback
}

type TaskDetailItem = {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  createdAt: string
  projectId: string
  projectName: string
  createdById?: string
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

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const resolvedParams = use(params)
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [task, setTask] = useState<TaskDetailItem | null>(null)
  const [projectMembers, setProjectMembers] = useState<{id: string, name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editPriority, setEditPriority] = useState<"high" | "medium" | "low">("medium")
  const [editDueDate, setEditDueDate] = useState("")
  const [editAssigneeId, setEditAssigneeId] = useState("")
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<ProjectRole | null>(null)
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({})
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    let cancelled = false

    async function loadTask() {
      setLoading(true)
      setError(null)

      try {
        const token = await getToken({ template: 'postman' })

        const [userResult, projectsResponse, taskResponse] = await Promise.all([
          fetch('/api/v1/auth', { cache: 'no-store' }),
          apiFetch<{ success?: boolean; projects?: any[] }>('/api/v1/projects', {
            token,
            router,
          }),
          apiFetch<{ success?: boolean; task?: any; error?: string }>(
            `/api/v1/tasks/${resolvedParams.id}`,
            { token, router, redirectOn403: true },
          ),
        ])

        if (taskResponse.unauthorized || projectsResponse.unauthorized) {
          return
        }

        if (taskResponse.forbidden) {
          router.push('/access-denied')
          return
        }

        if (!taskResponse.ok) {
          throw new Error(taskResponse.error)
        }

        const userData = await userResult.json().catch(() => null)
        const projectsData = projectsResponse.ok ? projectsResponse.data : null
        const data = taskResponse.data

        if (!cancelled) {
          const apiTask = data.task
          const currentUser = userData?.id ?? null
          setCurrentUserId(currentUser)

          const nextProjects: Array<{ id: string; name: string; members?: any[]; currentUserRole?: ProjectRole }> =
            Array.isArray(projectsData?.projects)
              ? projectsData.projects.map((project: any) => ({
                  id: project?.id ?? '',
                  name: project?.name ?? 'Untitled project',
                  members: project?.members,
                  currentUserRole: project?.currentUserRole ?? null,
                }))
              : []
          const projectNameById = new Map<string, string>(
            nextProjects.map((project) => [project.id, project.name]),
          )
          const projectId = apiTask?.projectId ?? apiTask?.project?.id ?? ''
          const currentProject = nextProjects.find((p) => p.id === projectId)
          setCurrentUserRole(currentProject?.currentUserRole ?? null)
          setProjectMembers(mapProjectMembers(currentProject?.members))

          const assignees = buildAssigneesFromApi(apiTask, currentUser)

          setTask({
            id: apiTask?.id ?? resolvedParams.id,
            title: apiTask?.title ?? 'Untitled task',
            description: apiTask?.description ?? '',
            status: normalizeTaskStatus(apiTask?.status),
            priority: (apiTask?.priority ?? 'medium').toLowerCase(),
            dueDate: apiTask?.dueDate
              ? new Date(apiTask.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : undefined,
            createdAt: apiTask?.createdAt
              ? new Date(apiTask.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recently created',
            projectId,
            projectName: getProjectName(
              projectId,
              projectNameById,
              apiTask?.project?.name ?? 'Unknown project',
            ),
            createdById: apiTask?.createdById ?? apiTask?.creator?.id,
            tags:
              Array.isArray(apiTask?.tags) && apiTask.tags.length > 0
                ? apiTask.tags
                : [],
            assignees,
          })

          setEditAssigneeId(apiTask?.assigneeId ?? apiTask?.assignee?.id ?? '')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Task not found')
          setTask(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTask()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, isSignedIn, resolvedParams.id, router])

  const isCreator = Boolean(task && currentUserId && task.createdById === currentUserId)
  const isAssignee = Boolean(
    task && currentUserId && task.assignees.some((a) => a.id === currentUserId),
  )
  const canEdit = canEditTask(currentUserRole, isCreator, isAssignee)
  const canDelete = canDeleteTask(currentUserRole, isCreator)

  if (loading) {
    return (
      <main className="flex-1 p-8">
        <StatusMessage type="loading" message="Loading task…" />
      </main>
    )
  }

  if (!task) {
    return (
      <main className="flex-1 p-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted/50 mb-6"
        >
          ← Back
        </button>
        <StatusMessage type="error" message={error || 'Task not found.'} />
      </main>
    )
  }

  async function handleStatusChange(s: TaskStatus) {
    if (!task || !canEdit) return

    try {
      const token = await getToken({ template: 'postman' })
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/v1/tasks/${task.id}`,
        {
          method: 'PATCH',
          token,
          router,
          body: { status: s.toUpperCase() },
        },
      )

      if (!result.ok) {
        throw new Error(result.error)
      }

      setTask((current) => (current ? { ...current, status: s } : current))
      setShowStatusMenu(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update task')
    }
  }

  async function handleEditTask(e: React.FormEvent) {
    e.preventDefault()
    if (!task || !canEdit) return

    const errors: FieldErrors = {}
    const titleError = validateTaskTitle(editTitle)
    const dueDateError = validateDueDate(editDueDate)
    if (titleError) errors.title = titleError
    if (dueDateError) errors.dueDate = dueDateError
    setEditFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setSaveMessage('Please fix the errors below before saving.')
      return
    }

    setUpdating(true)
    setError(null)
    setSaveMessage(null)
    try {
      const token = await getToken({ template: 'postman' })
      const result = await apiFetch<{ success?: boolean; task?: any; error?: string }>(
        `/api/v1/tasks/${task.id}`,
        {
          method: 'PATCH',
          token,
          router,
          body: {
            title: editTitle.trim(),
            description: editDesc.trim(),
            dueDate: editDueDate || null,
            assigneeId: editAssigneeId || null,
          },
        },
      )

      if (!result.ok) {
        throw new Error(result.error)
      }

      const updatedAssignees = buildAssigneesFromApi(result.data.task, currentUserId)

      setTask((current) =>
        current
          ? {
              ...current,
              title: editTitle.trim(),
              description: editDesc.trim(),
              dueDate: editDueDate
                ? new Date(editDueDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : undefined,
              assignees: updatedAssignees,
            }
          : null,
      )
      setShowEdit(false)
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to update task')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteTask() {
    if (!task || !canDelete) return
    setDeleting(true)
    setError(null)
    try {
      const token = await getToken({ template: 'postman' })
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/v1/tasks/${task.id}`,
        { method: 'DELETE', token, router },
      )

      if (!result.ok) {
        throw new Error(result.error)
      }

      router.push(`/projects/${task.projectId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete task')
      setDeleting(false)
    }
  }

  return (
    <main className="flex-1 p-8 max-w-3xl">

      {/* Back button + Breadcrumb */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted/50"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/tasks" className="hover:text-foreground transition-colors">
            My Tasks
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${task.projectId}`}
            className="hover:text-foreground transition-colors"
          >
            {task.projectName}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{task.title}</span>
        </div>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight leading-snug">
          {task.title}
        </h1>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditTitle(task.title)
              setEditDesc(task.description)
              setEditPriority(task.priority)
              const rawDue = task.dueDate
              setEditDueDate(
                rawDue
                  ? (() => {
                      const parsed = new Date(rawDue)
                      return Number.isNaN(parsed.getTime())
                        ? ''
                        : parsed.toISOString().split('T')[0]
                    })()
                  : '',
              )
              setEditAssigneeId(task.assignees[0]?.id || '')
              setEditFieldErrors({})
              setSaveMessage(null)
              setShowEdit(true)
            }}
            className="text-xs shrink-0 rounded-lg border border-border text-muted-foreground"
          >
            Edit task
          </Button>
        )}
      </div>

      {showEdit && canEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}
        >
          <section className="w-full max-w-lg rounded-2xl bg-card shadow-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Edit Task</h2>
              <button
                onClick={() => setShowEdit(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                ×
              </button>
            </div>
            {saveMessage && (
              <StatusMessage type="error" message={saveMessage} className="mb-3" />
            )}
            <form onSubmit={handleEditTask} className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
                Task title *
                <input
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value)
                    setEditFieldErrors((prev) => ({ ...prev, title: '' }))
                  }}
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <FieldError message={editFieldErrors.title} />
              </label>
              <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
                Description
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </label>
              <label className="flex flex-col text-sm text-muted-foreground">
                Priority
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as any)}
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="flex flex-col text-sm text-muted-foreground">
                Assignee
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
                Due date
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => {
                    setEditDueDate(e.target.value)
                    setEditFieldErrors((prev) => ({ ...prev, dueDate: '' }))
                  }}
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <FieldError message={editFieldErrors.dueDate} />
              </label>
              <div className="sm:col-span-2 flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" className="rounded-lg text-sm" disabled={updating}>
                  {updating ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left — main content */}
        <div className="md:col-span-2 flex flex-col gap-6">

          {/* Description */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {task.description || 'No description provided.'}
              </p>
            </CardContent>
          </Card>

          {/* Assignees */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Assignees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {task.assignees.length === 0 && (
                  <p className="text-xs text-muted-foreground">No assignees yet.</p>
                )}
                {task.assignees.map((a) => (
                  <div key={a.id ?? a.name} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: a.color, color: a.text }}
                    >
                      {a.initials}
                    </div>
                    <span className="text-sm text-foreground font-medium">
                      {a.name}
                    </span>
                    {a.isMe && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right — meta */}
        <div className="flex flex-col gap-4">

          {/* Status */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {canEdit ? (
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`w-full text-left text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${statusStyles[task.status]} cursor-pointer`}
              >
                {statusLabels[task.status]} ▾
              </button>
              ) : (
                <span
                  className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-full ${statusStyles[task.status]}`}
                >
                  {statusLabels[task.status]}
                </span>
              )}

              {showStatusMenu && (
                <div
                  className="absolute top-10 left-0 right-0 mx-4 bg-card rounded-lg shadow-md z-10 overflow-hidden border border-border"
                >
                  {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors ${
                        task.status === s ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {statusLabels[s]}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/projects/${task.projectId}`}
                className="text-sm font-medium text-primary hover:opacity-70 transition-opacity"
              >
                {task.projectName} →
              </Link>
            </CardContent>
          </Card>

          {/* Due date */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Due Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-foreground">
                {task.dueDate || '—'}
              </p>
            </CardContent>
          </Card>

          {/* Created */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{task.createdAt}</p>
            </CardContent>
          </Card>

          <Separator />

          {/* Danger */}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this task?")) {
                  handleDeleteTask()
                }
              }}
              disabled={deleting}
              className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors text-left"
            >
              {deleting ? "Deleting..." : "Delete task"}
            </button>
          )}

        </div>
      </div>

    </main>
  )
}