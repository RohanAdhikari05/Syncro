'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FieldError, StatusMessage } from '@/components/shared/StatusMessage'
import { apiFetch } from '@/lib/api-client'
import { useTaskStore } from '@/lib/taskStore'
import {
  validateInviteCode,
  validateProjectDescription,
  validateProjectName,
  type FieldErrors,
} from '@/lib/validation'

type Priority = 'high' | 'medium' | 'low'

type Status = 'active' | 'done' | 'paused'

const priorityStyles: Record<Priority, string> = {
  high: 'bg-red-500/15 text-red-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low: 'bg-green-500/15 text-green-300',
}

export default function ProjectsClient() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { projects, isLoading, error: storeError, createProject, refreshData } = useTaskStore()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<Status>('active')
  const [joinCode, setJoinCode] = useState('')
  const [joinMessage, setJoinMessage] = useState<string | null>(null)
  const [joinMessageType, setJoinMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [joining, setJoining] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState<string | null>(null)
  const [createMessageType, setCreateMessageType] = useState<'success' | 'error'>('error')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [joinFieldError, setJoinFieldError] = useState<string | null>(null)

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors: FieldErrors = {}
    const nameError = validateProjectName(name)
    const descError = validateProjectDescription(description)
    if (nameError) errors.name = nameError
    if (descError) errors.description = descError
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      setCreateMessageType('error')
      setCreateMessage('Please fix the errors below before creating the project.')
      return
    }

    setCreating(true)
    setCreateMessage(null)

    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || 'No description provided yet.',
      })

      setName('')
      setDescription('')
      setPriority('medium')
      setStatus('active')
      setFieldErrors({})
      setCreateMessageType('success')
      setCreateMessage('Project created successfully.')
      setShowCreate(false)
    } catch (error) {
      setCreateMessageType('error')
      setCreateMessage(
        error instanceof Error ? error.message : 'Unable to create project. Please try again.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinProject(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const codeError = validateInviteCode(joinCode)
    setJoinFieldError(codeError)
    if (codeError) {
      setJoinMessageType('error')
      setJoinMessage(codeError)
      return
    }

    setJoining(true)
    setJoinMessage(null)

    try {
      const token = await getToken({ template: 'postman' })
      const result = await apiFetch<{ success?: boolean; project?: { id?: string }; error?: string }>(
        `/api/v1/projects/join/${encodeURIComponent(joinCode.trim())}`,
        { method: 'POST', token, router },
      )

      if (!result.ok) {
        if (result.status === 404) {
          throw new Error('Invalid invite code — no project matches this code.')
        }
        if (result.status === 409) {
          throw new Error('You are already a member of this project.')
        }
        throw new Error(result.error)
      }

      setJoinCode('')
      setJoinFieldError(null)
      setJoinMessageType('success')
      setJoinMessage('You joined the project successfully.')
      await refreshData()

      if (result.data.project?.id) {
        router.push(`/projects/${result.data.project.id}`)
      }
    } catch (error) {
      setJoinMessageType('error')
      setJoinMessage(
        error instanceof Error ? error.message : 'Unable to join project. Please try again.',
      )
    } finally {
      setJoining(false)
    }
  }

  const recentProjects = projects.slice(0, 3)
  const projectCount = projects.length

  return (
    <main className="flex-1 p-8">
      <div className="flex flex-col gap-6 mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track all your team projects</p>
        </div>
        <Button onClick={() => setShowCreate((prev) => !prev)} className="text-sm font-medium rounded-lg">
          {showCreate ? 'Cancel' : '+ New project'}
        </Button>
      </div>

      {storeError && (
        <StatusMessage type="error" message={storeError} className="mb-4" />
      )}

      <section className="mb-8 rounded-[18px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Join a project</h2>
            <p className="text-sm text-muted-foreground mt-1">Use an invite code to join a team workspace quickly.</p>
          </div>
          <form onSubmit={handleJoinProject} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex flex-col">
              <input
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(event.target.value)
                  setJoinFieldError(null)
                }}
                placeholder="Enter invite code"
                className="rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <FieldError message={joinFieldError} />
            </div>
            <Button type="submit" className="rounded-lg" disabled={joining}>
              {joining ? 'Joining…' : 'Join'}
            </Button>
          </form>
        </div>
        {joinMessage && (
          <StatusMessage
            type={joinMessageType === 'success' ? 'success' : 'error'}
            message={joinMessage}
            className="mt-3"
          />
        )}
      </section>

      {showCreate && (
        <section className="mb-8 rounded-[18px] border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3">Create a new project</h2>
          {createMessage && (
            <StatusMessage
              type={createMessageType === 'success' ? 'success' : 'error'}
              message={createMessage}
              className="mb-4"
            />
          )}
          <form onSubmit={handleCreateProject} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col text-sm text-muted-foreground">
              Project name *
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, name: '' }))
                }}
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="E.g. Marketing launch"
              />
              <FieldError message={fieldErrors.name} />
            </label>
            <label className="flex flex-col text-sm text-muted-foreground">
              Description
              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, description: '' }))
                }}
                className="mt-2 min-h-30 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="Short summary of this project"
              />
              <FieldError message={fieldErrors.description} />
            </label>
            <label className="flex flex-col text-sm text-muted-foreground">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="flex flex-col text-sm text-muted-foreground">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Status)}
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
              </select>
            </label>
            <div className="sm:col-span-2 text-right">
              <Button type="submit" className="rounded-lg" disabled={creating}>
                {creating ? 'Creating…' : 'Create project'}
              </Button>
            </div>
          </form>
        </section>
      )}

      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {isLoading ? 'Loading projects…' : projectCount > 0 ? `All projects · ${projectCount}` : 'No projects yet'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {recentProjects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="rounded-[14px] flex flex-col gap-4 p-5 transition-colors border border-border bg-card hover:border-primary/30"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ background: project.color }}
                />
                <span className="text-sm font-semibold text-foreground leading-snug">
                  {project.name}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${priorityStyles[project.priority]}`}
              >
                {project.priority}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{project.description}</p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                {project.members.slice(0, 3).map((member, index) => (
                  <div
                    key={`${project.id}-${member.name}-${index}`}
                    title={member.name}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-background"
                    style={{ background: member.color, color: member.text, marginLeft: index === 0 ? 0 : -4 }}
                  >
                    {member.initials}
                  </div>
                ))}
                <span className="ml-2">{project.members.length} members</span>
              </div>
              <span>{project.status}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          className="flex flex-col items-center justify-center gap-2 min-h-50 rounded-[14px] border border-dashed border-border bg-muted text-muted-foreground transition hover:border-primary/30"
          onClick={() => setShowCreate(true)}
        >
          <span className="text-2xl">+</span>
          <span className="text-sm">Create a new project</span>
        </button>
      </div>
    </main>
  )
}
