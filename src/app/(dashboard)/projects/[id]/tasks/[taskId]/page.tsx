'use client'

import { useState, use, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

// ── Moved outside component ───────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

type ProjectTaskDetailItem = {
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

export default function ProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>
}) {
  const router = useRouter()
  const resolvedParams = use(params)
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [task, setTask] = useState<ProjectTaskDetailItem | null>(null)
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
        const response = await fetch(`/api/v1/tasks/${resolvedParams.taskId}`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Task not found')
        }

        const projectResponse = await fetch(`/api/v1/projects`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
        })
        const projectsData = await projectResponse.json().catch(() => null)

        if (!cancelled) {
          const apiTask = data.task
          setTask({
            id: apiTask?.id ?? resolvedParams.taskId,
            title: apiTask?.title ?? 'Untitled task',
            description: apiTask?.description ?? '',
            status: (apiTask?.status ?? 'TODO').toUpperCase() === 'DONE' ? 'done' : (apiTask?.status ?? 'TODO').toUpperCase() === 'IN_PROGRESS' ? 'in_progress' : 'todo',
            priority: (apiTask?.priority ?? 'medium').toLowerCase(),
            dueDate: apiTask?.dueDate ? new Date(apiTask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
            createdAt: apiTask?.createdAt ? new Date(apiTask.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently created',
            projectId: apiTask?.projectId ?? '',
            projectName: apiTask?.project?.name ?? 'Unknown project',
            tags: Array.isArray(apiTask?.tags) && apiTask.tags.length > 0 ? apiTask.tags : [],
            assignees: apiTask?.assignee
              ? [
                  {
                    id: apiTask.assignee?.id ?? '',
                    name: apiTask.assignee?.name ?? 'Unassigned',
                    initials: (apiTask.assignee?.name ?? 'Unassigned').split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]?.toUpperCase() ?? '').join('') || 'U',
                    color: '#6366f1',
                    text: '#ffffff',
                    isMe: Boolean(apiTask.assignee?.isMe),
                  },
                ]
              : [],
          })

          if (projectsData?.success && Array.isArray(projectsData.projects)) {
            const currentProject = projectsData.projects.find((p: any) => p.id === (apiTask?.projectId ?? ''))
            if (currentProject && Array.isArray(currentProject.members)) {
              setProjectMembers(currentProject.members.map((m: any) => ({
                id: m.userId || m.id,
                name: m.name || 'Unknown'
              })))
            }
          }
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
  }, [getToken, isLoaded, isSignedIn, resolvedParams.taskId])

  if (loading) {
    return (
      <main className="flex-1 p-8">
        <p className="text-sm text-muted-foreground">Loading task…</p>
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
        <p className="text-sm text-muted-foreground">{error || 'Task not found.'}</p>
      </main>
    )
  }

  async function handleStatusChange(s: TaskStatus) {
    if (!task) return

    try {
      const token = await getToken({ template: 'postman' })
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: s.toUpperCase() }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Unable to update task')
      }

      setTask((current) => (current ? { ...current, status: s } : current))
      setShowStatusMenu(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update task')
    }
  }

  async function handleEditTask(e: React.FormEvent) {
    e.preventDefault()
    if (!task) return
    setUpdating(true)
    setError(null)
    try {
      const token = await getToken({ template: 'postman' })
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim(),
          priority: editPriority.toUpperCase(),
          dueDate: editDueDate || null,
          assigneeId: editAssigneeId || null,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Unable to update task')
      }

      setTask((current) => current ? {
        ...current,
        title: editTitle.trim(),
        description: editDesc.trim(),
        priority: editPriority,
        dueDate: editDueDate ? new Date(editDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
        assignees: editAssigneeId ? [{
          id: editAssigneeId,
          name: projectMembers.find(m => m.id === editAssigneeId)?.name || 'User',
          initials: 'U',
          color: '#6366f1',
          text: '#ffffff'
        }] : []
      } : null)
      setShowEdit(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update task')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteTask() {
    if (!task) return
    setDeleting(true)
    setError(null)
    try {
      const token = await getToken({ template: 'postman' })
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Unable to delete task')
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
          <Link href="/projects" className="hover:text-foreground transition-colors">
            Projects
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
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditTitle(task.title)
              setEditDesc(task.description)
              setEditPriority(task.priority)
              // Convert to YYYY-MM-DD
              const dd = task.dueDate ? new Date(task.dueDate) : null
              setEditDueDate(dd && !isNaN(dd.getTime()) ? dd.toISOString().split('T')[0] : "")
              setEditAssigneeId(task.assignees[0]?.id || "")
              setShowEdit(true)
            }}
            className="text-xs shrink-0 rounded-lg border border-border text-muted-foreground"
          >
            Edit task
          </Button>
          <Link
            href={`/tasks/${task.id}`}
            className="text-xs font-medium text-primary hover:opacity-70 transition-opacity px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30"
          >
            View in My Tasks →
          </Link>
        </div>
      </div>

      {showEdit && (
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
            <form onSubmit={handleEditTask} className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
                Task title
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
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
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
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
          <Card style={{ border: '0.5px solid #e4e4e7' }}>
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
          <Card style={{ border: '0.5px solid #e4e4e7' }}>
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
                  <div key={a.id ?? a.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: a.color, color: a.text }}
                      >
                        {a.initials}
                      </div>
                      <span className="text-sm text-foreground font-medium">
                        {a.name}
                      </span>
                    </div>
                    {a.isMe && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
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
          <Card style={{ border: '0.5px solid #e4e4e7' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`w-full text-left text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${statusStyles[task.status]} cursor-pointer`}
              >
                {statusLabels[task.status]} ▾
              </button>
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
          <Card style={{ border: '0.5px solid #e4e4e7' }}>
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
                ← {task.projectName}
              </Link>
            </CardContent>
          </Card>

          {/* Due date */}
          <Card style={{ border: '0.5px solid #e4e4e7' }}>
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
          <Card style={{ border: '0.5px solid #e4e4e7' }}>
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

        </div>
      </div>

    </main>
  )
}