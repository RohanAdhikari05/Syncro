"use client";

import { useState, use, FormEvent, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FieldError, StatusMessage } from "@/components/shared/StatusMessage";
import { apiFetch } from "@/lib/api-client";
import {
  filterTasks,
  type DueDateFilter,
  type TaskFilters,
} from "@/lib/task-filters";
import {
  canChangeMemberRole,
  canCreateTask,
  canDeleteProject,
  canManageMembers,
  canManageProject,
  canRemoveMember,
  roleLabel,
} from "@/lib/permissions";
import { useTaskStore } from "@/lib/taskStore";
import type { TaskStatus } from "@/lib/taskStore";
import type { ProjectRole } from "@/types/project";
import {
  validateDueDate,
  validateInviteCode,
  validateProjectName,
  validateTaskTitle,
  type FieldErrors,
} from "@/lib/validation";

type Priority = "high" | "medium" | "low";

type ProjectDetailItem = {
  id: string;
  name: string;
  description: string;
  color: string;
  priority: Priority;
  status: "active" | "done" | "paused";
  inviteCode?: string;
  lead: { initials: string; name: string; color: string; text: string };
  members: {
    id: string;
    userId: string;
    initials: string;
    color: string;
    text: string;
    name: string;
    role?: ProjectRole;
  }[];
};

type ProjectTaskItem = {
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

type ProjectMemberApiItem = {
  id?: string;
  userId?: string;
  name?: string;
  role?: string;
};

type ProjectApiItem = {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  inviteCode?: string;
  members?: ProjectMemberApiItem[];
};

type ProjectApiResponse = {
  success?: boolean;
  projects?: ProjectApiItem[];
};

type TaskApiItem = {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  projectId?: string;
  project?: { name?: string };
  tags?: Array<{ label?: string; color?: string }>;
  assignee?: {
    id?: string;
    name?: string;
    isMe?: boolean;
  };
};

type TaskApiResponse = {
  success?: boolean;
  tasks?: TaskApiItem[];
};

const priorityStyles: Record<Priority, string> = {
  high: "bg-red-500/15 text-red-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-green-500/15 text-green-300",
};

const colAccent: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  done: "bg-green-500/15 text-green-300",
};

const columns: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

// ── Create Task Modal ─────────────────────────────────────────────────────────

interface CreateTaskModalProps {
  projectId: string;
  projectName: string;
  defaultStatus: TaskStatus;
  members: ProjectDetailItem["members"];
  canCreate: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTaskModal({
  projectId,
  projectName,
  defaultStatus,
  members,
  canCreate,
  onClose,
  onSuccess,
}: CreateTaskModalProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors: FieldErrors = {};
    const titleError = validateTaskTitle(title);
    const dueDateError = validateDueDate(dueDate);
    if (titleError) errors.title = titleError;
    if (dueDateError) errors.dueDate = dueDateError;
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("Please fix the errors below before creating the task.");
      return;
    }

    if (!canCreate) {
      setError("You do not have permission to create tasks in this project.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        "/api/v1/tasks",
        {
          method: "POST",
          token,
          router,
          body: {
            title: title.trim(),
            description: description.trim(),
            projectId,
            status: status.toUpperCase(),
            dueDate: dueDate || undefined,
            assigneeId: assigneeId || undefined,
          },
        },
      );

      if (!result.ok) {
        throw new Error(result.error);
      }

      setSuccess("Task created successfully.");
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create task. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="w-full max-w-lg rounded-2xl bg-card shadow-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            New task in <span className="text-primary">{projectName}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <StatusMessage type="error" message={error} className="mb-3" />
        )}
        {success && (
          <StatusMessage type="success" message={success} className="mb-3" />
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
            Task title *
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldErrors((prev) => ({ ...prev, title: "" }));
              }}
              autoFocus
              placeholder="What needs to be done?"
              className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <FieldError message={fieldErrors.title} />
          </label>

          <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details…"
              rows={2}
              className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
            />
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

          <label className="flex flex-col text-sm text-muted-foreground">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
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
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
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

          <div className="sm:col-span-2 flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <Button
              type="submit"
              className="rounded-lg text-sm"
              disabled={submitting || !canCreate}
            >
              {submitting ? "Creating…" : "Create task"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { tasks, projects, isLoading, addTask, updateTaskStatus, refreshData } =
    useTaskStore();
  const [project, setProject] = useState<ProjectDetailItem>({
    id: projectId,
    name: "Loading project…",
    description: "",
    color: "#6366f1",
    priority: "medium",
    status: "active",
    inviteCode: "",
    lead: {
      initials: "PR",
      name: "Project owner",
      color: "#6366f1",
      text: "#ffffff",
    },
    members: [],
  });
  const [projectTasks, setProjectTasks] = useState<ProjectTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dragging, setDragging] = useState<{
    task: ProjectTaskItem;
    from: TaskStatus;
  } | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Create-task modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");

  // Edit project modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "done" | "paused">(
    "active",
  );
  const [updating, setUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<ProjectRole | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [joinFieldError, setJoinFieldError] = useState<string | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [memberMessageType, setMemberMessageType] = useState<
    "success" | "error"
  >("success");
  const [accessDenied, setAccessDenied] = useState(false);

  const [taskFilters, setTaskFilters] = useState<TaskFilters>({
    search: "",
    status: "",
    assigneeId: "",
    dueDate: "",
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    async function loadProjectData() {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken({ template: "postman" });

        const [userResult, projectsResponse, tasksResponse] = await Promise.all(
          [
            fetch("/api/v1/auth", { cache: "no-store" }),
            apiFetch<ProjectApiResponse>("/api/v1/projects", { token, router }),
            apiFetch<TaskApiResponse>(`/api/v1/tasks?projectId=${projectId}`, {
              token,
              router,
              redirectOn403: true,
            }),
          ],
        );

        if (
          (!projectsResponse.ok && projectsResponse.unauthorized) ||
          (!tasksResponse.ok && tasksResponse.unauthorized)
        ) {
          return;
        }

        if (!tasksResponse.ok && tasksResponse.forbidden) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        const userData = await userResult.json().catch(() => null);
        const projectsData = projectsResponse.ok ? projectsResponse.data : null;
        const tasksData = tasksResponse.ok ? tasksResponse.data : null;

        if (!projectsResponse.ok) {
          throw new Error(projectsResponse.error);
        }
        if (!tasksResponse.ok) {
          throw new Error(tasksResponse.error);
        }

        if (!cancelled && userData?.id) {
          setCurrentUserId(userData.id);
        }

        if (!cancelled) {
          const matchedProject =
            projectsData?.success && Array.isArray(projectsData.projects)
              ? projectsData.projects.find(
                  (item: ProjectApiItem) => item?.id === projectId,
                )
              : null;

          if (!matchedProject) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }

          if (matchedProject) {
            const normalizedStatus = String(
              matchedProject.status ?? "ACTIVE",
            ).toLowerCase();

            // helper to build initials and a deterministic color from a name
            const buildInitials = (name = "") =>
              name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("") || "PR";

            const toColor = (name = "") => {
              const palette = [
                "#6366f1",
                "#0f766e",
                "#f59e0b",
                "#ef4444",
                "#8b5cf6",
              ];
              const hash = Array.from(name).reduce(
                (acc, char) => acc + char.charCodeAt(0),
                0,
              );
              return palette[hash % palette.length];
            };

            const members = Array.isArray(matchedProject.members)
              ? matchedProject.members.map((m: ProjectMemberApiItem) => ({
                  id: m?.id || "",
                  userId: m?.userId || m?.id || "",
                  name: m?.name ?? "Unknown User",
                  initials: buildInitials(m?.name ?? "Unknown User"),
                  color: toColor(m?.name ?? "Unknown User"),
                  text: "#ffffff",
                  role: (m?.role ?? "MEMBER") as ProjectRole,
                }))
              : [];

            const currentRole =
              (
                matchedProject as ProjectApiItem & {
                  currentUserRole?: ProjectRole;
                }
              ).currentUserRole ??
              members.find((m) => m.userId === userData?.id)?.role ??
              null;
            setCurrentUserRole(currentRole);

            const owner = matchedProject.members?.find(
              (m: ProjectMemberApiItem) => m?.role === "OWNER",
            );
            const leadName =
              owner?.name ?? matchedProject.name ?? "Project owner";

            setProject({
              id: matchedProject.id ?? projectId,
              name: matchedProject.name ?? "Untitled project",
              description: matchedProject.description ?? "",
              color: "#6366f1",
              priority: "medium",
              status:
                normalizedStatus === "completed" || normalizedStatus === "done"
                  ? "done"
                  : normalizedStatus === "archived" ||
                      normalizedStatus === "paused"
                    ? "paused"
                    : "active",
              inviteCode: matchedProject.inviteCode ?? "",
              lead: {
                initials: buildInitials(leadName),
                name: leadName,
                color: toColor(leadName),
                text: "#ffffff",
              },
              members,
            });
          }

          if (tasksData?.success && Array.isArray(tasksData.tasks)) {
            setProjectTasks(
              tasksData.tasks.map((task: TaskApiItem) => ({
                id: task?.id ?? "",
                title: task?.title ?? "Untitled task",
                description: task?.description ?? "",
                status: ((task?.status ?? "TODO").toUpperCase() === "DONE"
                  ? "done"
                  : (task?.status ?? "TODO").toUpperCase() === "IN_PROGRESS"
                    ? "in_progress"
                    : "todo") as TaskStatus,
                priority: (["high", "medium", "low"].includes(
                  (task?.priority ?? "medium").toLowerCase(),
                )
                  ? (task?.priority ?? "medium").toLowerCase()
                  : "medium") as Priority,
                dueDate: task?.dueDate
                  ? new Date(task.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : undefined,
                projectId: task?.projectId ?? projectId,
                projectName: task?.project?.name ?? projectId,
                tags:
                  Array.isArray(task?.tags) && task.tags.length > 0
                    ? task.tags.map((tag) => ({
                        label: tag?.label ?? "Tag",
                        color: tag?.color ?? "bg-muted text-muted-foreground",
                      }))
                    : [],
                assignees: task?.assignee
                  ? [
                      {
                        id: task.assignee?.id ?? "",
                        name: task.assignee?.name ?? "Unassigned",
                        initials:
                          (task.assignee?.name ?? "Unassigned")
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
              })),
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load project data",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProjectData();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, projectId, router]);

  function openCreate(status: TaskStatus = "todo") {
    setCreateStatus(status);
    setShowCreate(true);
  }

  async function copyInviteCode() {
    if (!project.inviteCode) return;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `${project.name} invite`,
          text: `Use invite code ${project.inviteCode} to join ${project.name}`,
        });
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(project.inviteCode);
      }
      setInviteMessage("Invite code copied and ready to share.");
    } catch {
      setInviteMessage("Unable to share the invite right now.");
    }
  }

  async function handleJoinByCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const codeError = validateInviteCode(joinCode);
    setJoinFieldError(codeError);
    if (codeError) {
      setJoinMessage(codeError);
      return;
    }

    setJoining(true);
    setJoinMessage(null);

    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{
        success?: boolean;
        project?: { id?: string };
        error?: string;
      }>(`/api/v1/projects/join/${encodeURIComponent(joinCode.trim())}`, {
        method: "POST",
        token,
        router,
      });

      if (!result.ok) {
        if (result.status === 404) {
          throw new Error(
            "Invalid invite code — no project matches this code.",
          );
        }
        if (result.status === 409) {
          throw new Error("You are already a member of this project.");
        }
        throw new Error(result.error);
      }

      setJoinCode("");
      setJoinFieldError(null);
      setJoinMessage("You joined the project successfully.");
      if (result.data.project?.id) {
        router.push(`/projects/${result.data.project.id}`);
      }
    } catch (err) {
      setJoinMessage(
        err instanceof Error ? err.message : "Unable to join this project",
      );
    } finally {
      setJoining(false);
    }
  }

  async function handleMemberRoleChange(
    targetUserId: string,
    newRole: ProjectRole,
  ) {
    setMemberActionId(targetUserId);
    setMemberMessage(null);

    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/v1/projects/${projectId}/members/${targetUserId}`,
        { method: "PATCH", token, router, body: { role: newRole } },
      );

      if (!result.ok) {
        throw new Error(result.error);
      }

      setMemberMessageType("success");
      setMemberMessage("Member role updated successfully.");
      await refreshData();
      window.location.reload();
    } catch (err) {
      setMemberMessageType("error");
      setMemberMessage(
        err instanceof Error ? err.message : "Unable to update member role.",
      );
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleRemoveMember(targetUserId: string) {
    if (!confirm("Remove this member from the project?")) return;

    setMemberActionId(targetUserId);
    setMemberMessage(null);

    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/v1/projects/${projectId}/members/${targetUserId}`,
        { method: "DELETE", token, router },
      );

      if (!result.ok) {
        throw new Error(result.error);
      }

      setMemberMessageType("success");
      setMemberMessage("Member removed successfully.");
      await refreshData();
      window.location.reload();
    } catch (err) {
      setMemberMessageType("error");
      setMemberMessage(
        err instanceof Error ? err.message : "Unable to remove member.",
      );
    } finally {
      setMemberActionId(null);
    }
  }

  async function onDragStart(task: ProjectTaskItem, from: TaskStatus) {
    setDragging({ task, from });
  }

  async function onDrop(to: TaskStatus) {
    if (!dragging || dragging.from === to) {
      setDragging(null);
      setDragOver(null);
      return;
    }

    try {
      const token = await getToken({ template: "postman" });
      const response = await fetch(`/api/v1/tasks/${dragging.task.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: to.toUpperCase() }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to update task");
      }

      setProjectTasks((current) =>
        current.map((task) =>
          task.id === dragging.task.id ? { ...task, status: to } : task,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setDragging(null);
      setDragOver(null);
    }
  }

  async function handleEditProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors: FieldErrors = {};
    const nameError = validateProjectName(editName);
    if (nameError) errors.name = nameError;
    setEditFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the errors below before saving.");
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/v1/projects/${projectId}`,
        {
          method: "PATCH",
          token,
          router,
          body: {
            name: editName.trim(),
            description: editDesc.trim(),
            status: editStatus.toUpperCase(),
          },
        },
      );

      if (!result.ok) {
        throw new Error(result.error);
      }

      await refreshData();
      window.location.reload();
      setShowEdit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update project");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteProject() {
    setIsDeleting(true);
    setError(null);
    try {
      const token = await getToken({ template: "postman" });
      const result = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/v1/projects/${projectId}`,
        { method: "DELETE", token, router },
      );

      if (!result.ok) {
        throw new Error(result.error);
      }

      await refreshData();
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete project");
      setIsDeleting(false);
    }
  }

  const filteredTasks = useMemo(
    () => filterTasks(projectTasks, taskFilters),
    [projectTasks, taskFilters],
  );

  // Group live tasks by status for display
  const tasksByStatus: Record<TaskStatus, ProjectTaskItem[]> = {
    todo: filteredTasks.filter((t) => t.status === "todo"),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
    done: filteredTasks.filter((t) => t.status === "done"),
  };

  const totalTasks = projectTasks.length;
  const doneTasks = projectTasks.filter((t) => t.status === "done").length;
  const canCreate = canCreateTask(currentUserRole);
  const canEdit = canManageProject(currentUserRole);
  const canDelete = canDeleteProject(currentUserRole);
  const canManageTeam = canManageMembers(currentUserRole);

  if (accessDenied) {
    router.push("/access-denied");
    return (
      <main className="flex-1 p-8">
        <StatusMessage type="loading" message="Redirecting…" />
      </main>
    );
  }

  return (
    <main key={projectId} className="flex-1 p-8">
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {/* Create Task Modal */}
      {showCreate && (
        <CreateTaskModal
          projectId={projectId}
          projectName={project.name}
          defaultStatus={createStatus}
          members={project.members}
          canCreate={canCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {/* Edit Project Modal */}
      {showEdit && canEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}
        >
          <section className="w-full max-w-lg rounded-2xl bg-card shadow-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Edit <span className="text-primary">{project.name}</span>
              </h2>
              <button
                onClick={() => setShowEdit(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={handleEditProject}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
                Project name *
                <input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditFieldErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  autoFocus
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <FieldError message={editFieldErrors.name} />
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
              <label className="flex flex-col text-sm text-muted-foreground sm:col-span-2">
                Status
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <div className="sm:col-span-2 flex items-center justify-between gap-2 mt-2">
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to delete this project? This action cannot be undone.",
                        )
                      ) {
                        handleDeleteProject();
                      }
                    }}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
                  >
                    {isDeleting ? "Deleting..." : "Delete project"}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEdit(false)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    className="rounded-lg text-sm"
                    disabled={updating}
                  >
                    {updating ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Back button + Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted/50"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/projects"
            className="hover:text-foreground transition-colors"
          >
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{project.name}</span>
        </div>
      </div>

      {/* Project header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg shrink-0 mt-0.5"
            style={{
              background: project.color + "20",
              border: `1.5px solid ${project.color}40`,
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center text-sm font-bold"
              style={{ color: project.color }}
            >
              {project.name[0]}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                {project.name}
              </h1>
              <span
                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${priorityStyles[project.priority]}`}
              >
                {project.priority}
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              {project.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => {
                setEditName(project.name);
                setEditDesc(project.description);
                setEditStatus(project.status);
                setShowEdit(true);
              }}
              className="text-sm font-medium rounded-lg"
            >
              Edit project
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => openCreate("todo")}
              className="text-sm font-medium rounded-lg"
            >
              + New task
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] mb-6">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Team members
              </p>
              <h2 className="text-sm font-semibold text-foreground">
                People working on this project
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {project.members.length} members
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {memberMessage && (
              <StatusMessage
                type={memberMessageType === "success" ? "success" : "error"}
                message={memberMessage}
              />
            )}
            {project.members.length > 0 ? (
              project.members.map((member) => {
                const memberRole = (member.role ?? "MEMBER") as ProjectRole;
                const isSelf = member.userId === currentUserId;
                const canChangeRole =
                  canManageTeam &&
                  canChangeMemberRole(currentUserRole, memberRole) &&
                  !isSelf;
                const canRemove =
                  currentUserId &&
                  canRemoveMember(currentUserRole, memberRole, isSelf);

                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{ background: member.color, color: member.text }}
                      >
                        {member.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                          {isSelf ? " (you)" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabel(memberRole)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canChangeRole && memberRole !== "OWNER" && (
                        <select
                          value={memberRole}
                          disabled={memberActionId === member.userId}
                          onChange={(e) =>
                            handleMemberRoleChange(
                              member.userId,
                              e.target.value as ProjectRole,
                            )
                          }
                          className="rounded-lg border border-border bg-background text-foreground px-2 py-1 text-xs outline-none"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          disabled={memberActionId === member.userId}
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          {memberActionId === member.userId
                            ? "Removing…"
                            : isSelf
                              ? "Leave"
                              : "Remove"}
                        </button>
                      )}
                      {!canChangeRole && !canRemove && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {roleLabel(memberRole)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Invite people
          </p>
          <h2 className="text-sm font-semibold text-foreground">
            Share an invite code or join with one
          </h2>
          <div className="mt-4 rounded-xl border border-border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">Invite code</p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <span className="font-mono text-sm font-semibold text-foreground">
                {project.inviteCode || "No code yet"}
              </span>
              <Button
                type="button"
                onClick={copyInviteCode}
                className="rounded-lg text-xs px-3 py-2"
              >
                Share code
              </Button>
            </div>
            {inviteMessage && (
              <p className="mt-2 text-xs text-emerald-500">{inviteMessage}</p>
            )}
          </div>

          <form onSubmit={handleJoinByCode} className="mt-4 space-y-3">
            <label className="flex flex-col text-sm text-muted-foreground">
              Join with invite code
              <input
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(event.target.value);
                  setJoinFieldError(null);
                }}
                placeholder="Enter a project code"
                className="mt-2 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <FieldError message={joinFieldError} />
            </label>
            <Button type="submit" className="rounded-lg" disabled={joining}>
              {joining ? "Joining…" : "Join project"}
            </Button>
            {joinMessage && (
              <p className="text-xs text-muted-foreground">{joinMessage}</p>
            )}
          </form>
        </section>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-6 px-4 py-3 rounded-xl mb-6 flex-wrap bg-muted/70 border border-border">
        {/* Lead */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Lead
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{
                background: project.lead.color,
                color: project.lead.text,
              }}
            >
              {project.lead.initials}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {project.lead.name}
            </span>
          </div>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Members */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Team
          </span>
          <div className="flex items-center">
            {project.members.map((m, i) => (
              <div
                key={`${m.name}-${i}`}
                title={m.name}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white"
                style={{
                  background: m.color,
                  color: m.text,
                  marginLeft: i === 0 ? 0 : -4,
                }}
              >
                {m.initials}
              </div>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {project.members.length} members
            </span>
          </div>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Progress */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Progress
          </span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: totalTasks
                    ? `${(doneTasks / totalTasks) * 100}%`
                    : "0%",
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {doneTasks}/{totalTasks} tasks
            </span>
          </div>
        </div>
      </div>

      {loading && (
        <StatusMessage
          type="loading"
          message="Loading project board…"
          className="mb-4"
        />
      )}

      <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Filter tasks
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col text-xs text-muted-foreground md:col-span-2">
            Search
            <input
              value={taskFilters.search}
              onChange={(e) =>
                setTaskFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Search by title or description"
              className="mt-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Status
            <select
              value={taskFilters.status}
              onChange={(e) =>
                setTaskFilters((prev) => ({
                  ...prev,
                  status: e.target.value as TaskFilters["status"],
                }))
              }
              className="mt-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All statuses</option>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Assignee
            <select
              value={taskFilters.assigneeId}
              onChange={(e) =>
                setTaskFilters((prev) => ({
                  ...prev,
                  assigneeId: e.target.value,
                }))
              }
              className="mt-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {project.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-muted-foreground md:col-span-2">
            Due date
            <select
              value={taskFilters.dueDate}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setTaskFilters((prev) => ({
                  ...prev,
                  dueDate: e.target.value as DueDateFilter,
                }))
              }
              className="mt-1 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">Due this week</option>
              <option value="none">No due date</option>
            </select>
          </label>
          <div className="flex items-end md:col-span-2">
            <button
              type="button"
              onClick={() =>
                setTaskFilters({
                  search: "",
                  status: "",
                  assigneeId: "",
                  dueDate: "",
                })
              }
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {filteredTasks.length} of {projectTasks.length} tasks
        </p>
      </section>

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

            <div className="flex flex-col gap-2 min-h-20">
              {tasksByStatus[key].map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${projectId}/tasks/${task.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    onDragStart(task, key);
                  }}
                  onClick={(e) => dragging && e.preventDefault()}
                  className="block rounded-[10px] border border-border bg-card p-3 cursor-grab active:cursor-grabbing select-none hover:border-primary/30 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground mb-2 leading-snug">
                    {task.title}
                  </p>
                  <div className="flex items-center justify-between gap-2">
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
                    <div className="flex items-center gap-1 shrink-0">
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground mr-1">
                          {task.dueDate}
                        </span>
                      )}
                      <div className="flex">
                        {task.assignees.map((a, i) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-background"
                            style={{
                              background: a.color,
                              color: a.text,
                              marginLeft: i === 0 ? 0 : -4,
                            }}
                          >
                            {a.initials}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Column-level add task button — pre-fills status */}
            {canCreate && (
              <button
                onClick={() => openCreate(key)}
                className="w-full mt-2 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors text-left px-2"
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
