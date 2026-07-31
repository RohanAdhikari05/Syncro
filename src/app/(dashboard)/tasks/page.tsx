"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FieldError, StatusMessage } from "@/components/shared/StatusMessage";
import { apiFetch } from "@/lib/api-client";
import { canCreateTask } from "@/lib/permissions";
import type { TaskStatus } from "@/lib/taskStore";
import type { ProjectRole } from "@/types/project";
import {
  validateDueDate,
  validateProjectSelection,
  validateTaskTitle,
  type FieldErrors,
} from "@/lib/validation";
import { type TaskFilters, filterTasks } from "@/lib/task-filters";
// ── Types ─────────────────────────────────────────────────────────────────────

type TaskListItem = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  projectId: string;
  projectName: string;
  tags: { label: string; color: string }[];
  assignees: {
    id: string;
    name: string;
    initials: string;
    color: string;
    text: string;
    isMe?: boolean;
  }[];
};

type ProjectOption = {
  id: string;
  name: string;
  color: string;
  currentUserRole?: ProjectRole | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const columns: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const colAccent: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  done: "bg-green-500/15 text-green-300",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTaskStatus(status?: string): TaskStatus {
  const value = (status ?? "").toUpperCase();
  if (value === "DONE") return "done";
  if (value === "IN_PROGRESS" || value === "INPROGRESS") return "in_progress";
  return "todo";
}

function mapApiTask(
  task: any,
  projectNameByIdOrFallback?: Map<string, string> | string,
  fallbackProjectName = "Unknown project",
): TaskListItem {
  const projectId = task?.projectId ?? task?.project?.id ?? "";
  const resolvedProjectName =
    typeof projectNameByIdOrFallback === "string"
      ? projectNameByIdOrFallback
      : (projectNameByIdOrFallback?.get(projectId) ??
        task?.project?.name ??
        fallbackProjectName);

  return {
    id: task?.id ?? "",
    title: task?.title ?? "Untitled task",
    description: task?.description ?? "",
    status: normalizeTaskStatus(task?.status),
    priority: (task?.priority ?? "medium").toLowerCase(),
    dueDate: task?.dueDate
      ? new Date(task.dueDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : undefined,
    projectId,
    projectName: resolvedProjectName,
    tags:
      Array.isArray(task?.tags) && task.tags.length > 0
        ? task.tags
        : [
            {
              label:
                normalizeTaskStatus(task?.status) === "done"
                  ? "Done"
                  : normalizeTaskStatus(task?.status) === "in_progress"
                    ? "In Progress"
                    : "Todo",
              color:
                normalizeTaskStatus(task?.status) === "done"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : normalizeTaskStatus(task?.status) === "in_progress"
                    ? "bg-sky-500/15 text-sky-300"
                    : "bg-muted/20 text-muted-foreground",
            },
          ],
    assignees: task?.assignee
      ? [
          {
            id: task.assignee?.id ?? "",
            name: task.assignee?.name ?? "Unknown User",
            initials:
              (task.assignee?.name ?? "Unknown User")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part: string) => part[0]?.toUpperCase() ?? "")
                .join("") || "U",
            color: "#6366f1",
            text: "#ffffff",
            isMe: Boolean(task.assignee?.isMe),
          },
        ]
      : [],
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dragging, setDragging] = useState<{
    task: TaskListItem;
    from: TaskStatus;
  } | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  // ── Filters State ─────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TaskFilters>({
    status: "all",
    assigneeId: "",
    dueDate: "all",
    search: "",
  });

  const filterUI = (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      {/* Search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Search
        </label>
        <input
          value={filters.search ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              search: e.target.value,
            }))
          }
          placeholder="Search tasks..."
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        />
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Status
        </label>
        <select
          value={filters.status ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              status: e.target.value as TaskFilters["status"],
            }))
          }
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      {/* Due Date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Due Date
        </label>
        <select
          value={filters.dueDate ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              dueDate: e.target.value as TaskFilters["dueDate"],
            }))
          }
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="none">No Due Date</option>
        </select>
      </div>

      {/* Clear */}
      <Button
        variant="outline"
        className="h-9"
        onClick={() =>
          setFilters({
            status: "all",
            assigneeId: "",
            dueDate: "all",
            search: "",
          })
        }
      >
        Clear
      </Button>
    </div>
  );
  // Unique assignee options derived from tasks
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      t.assignees?.forEach((a) => {
        if (a.id && a.name) {
          map.set(a.id, a.name);
        }
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // Apply filters to tasks list
  const filteredTasks = useMemo(
    () => filterTasks(tasks, filters),
    [tasks, filters],
  );

  // Group filtered tasks by status
  const tasksByStatus = useMemo<Record<TaskStatus, TaskListItem[]>>(
    () => ({
      todo: filteredTasks.filter((t) => t.status === "todo"),
      in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
      done: filteredTasks.filter((t) => t.status === "done"),
    }),
    [filteredTasks],
  );

  // Handlers for filter UI
  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setFilters((prev) => ({
      ...prev,
      status: e.target.value as TaskFilters["status"],
    }));
  };
  const handleAssigneeFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setFilters((prev) => ({ ...prev, assigneeId: e.target.value }));
  };
  const handleDueDateFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setFilters((prev) => ({
      ...prev,
      dueDate: e.target.value as TaskFilters["dueDate"],
    }));
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  };
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken({ template: "postman" });

        const [projectsResponse, tasksResponse] = await Promise.all([
          apiFetch<{ success?: boolean; projects?: any[]; error?: string }>(
            "/api/v1/projects",
            { token, router },
          ),
          apiFetch<{ success?: boolean; tasks?: any[]; error?: string }>(
            "/api/v1/tasks",
            { token, router },
          ),
        ]);

        if (
          (!projectsResponse.ok && projectsResponse.unauthorized) ||
          (!tasksResponse.ok && tasksResponse.unauthorized)
        ) {
          return;
        }

        if (!projectsResponse.ok) {
          throw new Error(projectsResponse.error);
        }
        if (!tasksResponse.ok) {
          throw new Error(tasksResponse.error);
        }

        const projectsData = projectsResponse.data;
        const tasksData = tasksResponse.data;

        if (!cancelled) {
          const nextProjects = Array.isArray(projectsData?.projects)
            ? projectsData.projects.map((project: any) => ({
                id: project?.id ?? "",
                name: project?.name ?? "Untitled project",
                color: project?.color ?? "#6366f1",
                currentUserRole: project?.currentUserRole ?? null,
              }))
            : [];
          const projectNameById = new Map<string, string>(
            nextProjects.map((project: { id: string; name: string }) => [
              project.id,
              project.name,
            ]),
          );

          setProjectOptions(nextProjects);
          setProjectId((current) => current || nextProjects[0]?.id || "");
          setTasks(
            Array.isArray(tasksData?.tasks)
              ? tasksData.tasks.map((task: any) =>
                  mapApiTask(task, projectNameById),
                )
              : [],
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load tasks");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, router]);

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function onDragStart(task: TaskListItem, from: TaskStatus) {
    setDragging({ task, from });
  }

  async function onDrop(to: TaskStatus) {
    if (!dragging || dragging.from === to) {
      setDragging(null);
      setDragOver(null);
      return;
    }

    setUpdatingTaskId(dragging.task.id);

    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/v1/tasks/${dragging.task.id}`,
        {
          method: "PATCH",
          token,
          router,
          body: { status: to.toUpperCase() },
        },
      );

      if (!result.ok) {
        throw new Error(result.error);
      }

      setTasks((current) =>
        current.map((task) =>
          task.id === dragging.task.id ? { ...task, status: to } : task,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setUpdatingTaskId(null);
      setDragging(null);
      setDragOver(null);
    }
  }

  const creatableProjects = useMemo(
    () => projectOptions.filter((p) => canCreateTask(p.currentUserRole)),
    [projectOptions],
  );

  const selectedProjectRole = projectOptions.find(
    (p) => p.id === projectId,
  )?.currentUserRole;
  const canCreateInSelectedProject = canCreateTask(selectedProjectRole);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors: FieldErrors = {};
    const titleError = validateTaskTitle(title);
    const projectError = validateProjectSelection(projectId);
    const dueDateError = validateDueDate(dueDate);
    if (titleError) errors.title = titleError;
    if (projectError) errors.projectId = projectError;
    if (dueDateError) errors.dueDate = dueDateError;
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setCreateMessage("Please fix the errors below before creating the task.");
      return;
    }

    if (!canCreateInSelectedProject) {
      setCreateMessage(
        "You do not have permission to create tasks in this project.",
      );
      return;
    }

    setCreating(true);
    setCreateMessage(null);
    setError(null);

    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{
        success?: boolean;
        task?: any;
        error?: string;
      }>("/api/v1/tasks", {
        method: "POST",
        token,
        router,
        body: {
          title: title.trim(),
          description: "",
          projectId,
          status: status.toUpperCase(),
          dueDate: dueDate || undefined,
        },
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      const project = projectOptions.find((item) => item.id === projectId);
      setTasks((current) => [
        mapApiTask(result.data.task, project?.name ?? "Unknown project"),
        ...current,
      ]);

      setTitle("");
      setDueDate("");
      setStatus("todo");
      setProjectId(creatableProjects[0]?.id || "");
      setFieldErrors({});
      setShowCreate(false);
    } catch (err) {
      setCreateMessage(
        err instanceof Error ? err.message : "Unable to create task",
      );
    } finally {
      setCreating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            My Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tasks assigned to you across all projects
          </p>
        </div>
        <Button
          onClick={() => setShowCreate((prev) => !prev)}
          className="text-sm font-medium rounded-lg"
          disabled={creatableProjects.length === 0}
        >
          {showCreate ? "Cancel" : "+ New task"}
        </Button>
      </div>
      {filterUI}
      {creatableProjects.length === 0 && !loading && (
        <StatusMessage
          type="info"
          message="You can only create tasks in projects where you are an owner or admin."
          className="mb-4"
        />
      )}

      {/* Create task form */}
      {showCreate && creatableProjects.length > 0 && (
        <section className="mb-6 rounded-[18px] border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Add a new task
          </h2>
          {createMessage && (
            <StatusMessage
              type="error"
              message={createMessage}
              className="mb-4"
            />
          )}
          <form
            onSubmit={handleCreateTask}
            className="grid gap-4 md:grid-cols-2"
          >
            <label className="flex flex-col text-sm text-muted-foreground">
              Task title *
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, title: "" }));
                }}
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="Task name"
              />
              <FieldError message={fieldErrors.title} />
            </label>
            <label className="flex flex-col text-sm text-muted-foreground">
              Project *
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, projectId: "" }));
                }}
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                {creatableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.projectId} />
            </label>
            <label className="flex flex-col text-sm text-muted-foreground">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, dueDate: "" }));
                }}
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <FieldError message={fieldErrors.dueDate} />
            </label>
            <label className="flex flex-col text-sm text-muted-foreground">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </label>
            <div className="md:col-span-2 text-right">
              <Button type="submit" className="rounded-lg" disabled={creating}>
                {creating ? "Creating…" : "Create task"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Info note */}
      <p className="text-xs text-muted-foreground mb-6">
        Drag tasks between columns to update status — changes sync to the
        project board automatically.
      </p>

      {error && <StatusMessage type="error" message={error} className="mb-4" />}

      {updatingTaskId && (
        <StatusMessage
          type="loading"
          message="Updating task status…"
          className="mb-4"
        />
      )}

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(({ key, label }) => (
          <div
            key={key}
            className={`rounded-xl p-3 transition-colors ${
              dragOver === key
                ? "bg-primary/10 border border-primary/30"
                : "bg-muted/50 border border-border"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(key);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => onDrop(key)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colAccent[key]}`}
              >
                {tasksByStatus[key].length}
              </span>
            </div>

            {/* Task cards */}
            <div className="flex flex-col gap-2 min-h-20">
              {loading && tasks.length === 0 && (
                <StatusMessage type="loading" message="Loading tasks…" />
              )}
              {tasksByStatus[key].map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    onDragStart(task, key);
                  }}
                  className="block rounded-[10px] p-3 cursor-grab active:cursor-grabbing select-none hover:border-primary/30 transition-colors bg-card border border-border"
                  onClick={(e) => dragging && e.preventDefault()}
                >
                  <p className="text-sm font-medium text-foreground mb-2 leading-snug">
                    {task.title}
                  </p>

                  {/* Project name */}
                  <p className="text-[11px] text-muted-foreground mb-2 truncate">
                    📁 {task.projectName}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span
                          key={tag.label}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tag.color}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>

                    {/* Due date */}
                    {task.dueDate && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {task.dueDate}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {creatableProjects.length > 0 && (
              <button
                className="w-full mt-2 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors text-left px-2"
                onClick={() => {
                  setStatus(key);
                  setShowCreate(true);
                }}
              >
                + Add task
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
