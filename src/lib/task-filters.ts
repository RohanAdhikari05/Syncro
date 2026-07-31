import type { TaskStatus } from "@/lib/taskStore";

export type TaskFilters = {
  status?: "" | "all" | "todo" | "in_progress" | "done";
  assigneeId?: string; // '' means all, 'unassigned' means no assignee
  dueDate?: "" | "all" | "overdue" | "today" | "upcoming" | "none";
  search?: string;
};

export function filterTasks(tasks: any[], filters: TaskFilters): any[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  return tasks.filter((t) => {
    // Status filter
    if (
      filters.status &&
      filters.status !== "all" &&
      t.status !== filters.status
    ) {
      return false;
    }

    // Assignee filter
    if (filters.assigneeId && filters.assigneeId !== "") {
      if (filters.assigneeId === "unassigned") {
        if (t.assignees && t.assignees.length > 0) return false;
      } else {
        if (!t.assignees?.some((a: any) => a.id === filters.assigneeId))
          return false;
      }
    }

    // Due date filter
    if (filters.dueDate && filters.dueDate !== "all") {
      if (filters.dueDate === "none") {
        if (t.dueDate) return false;
      } else {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        if (filters.dueDate === "overdue" && due >= now) return false;
        if (
          filters.dueDate === "today" &&
          (due < startOfToday || due >= endOfToday)
        )
          return false;
        if (filters.dueDate === "upcoming" && due <= now) return false;
      }
    }

    // Search filter
    if (filters.search && filters.search.trim() !== "") {
      const term = filters.search.trim().toLowerCase();
      const inTitle = t.title?.toLowerCase().includes(term);
      const inDesc = t.description?.toLowerCase().includes(term);
      if (!inTitle && !inDesc) return false;
    }

    return true;
  });
}

export type DueDateFilter =
  | ""
  | "all"
  | "overdue"
  | "today"
  | "upcoming"
  | "none";
