import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { TaskService } from '@/services/task.service';
import { ProjectService } from '@/services/project.service';

// ── GET /api/v1/tasks/[id] ────────────────────────────────────────────────────
//
// Fetch a single task by its ID.
// The authenticated user must be a member of the task's project.
//
// Response 200:
//   { success: true, task: Task }
//
// Response 401 / 403 / 404 as appropriate.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────────────────
    const user = await AuthService.getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // ── 2. Fetch task with relations ──────────────────────────────────────────
    const task = await TaskService.getByIdWithRelations(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // ── 3. Authorise — user must be a member of the task's project ────────────
    const membership = await ProjectService.isUserAlreadyMember(task.projectId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden — you are not a member of this project' },
        { status: 403 },
      );
    }
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('TASK GET BY ID ERROR:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// ── PATCH /api/v1/tasks/[id] ──────────────────────────────────────────────────
//
// Partially update a task (PATCH semantics — only supplied fields change).
//
// Request body (JSON) — all fields optional:
//   {
//     "title":       string
//     "description": string
//     "status":      "todo" | "in_progress" | "done"
//     "assigneeId":  string | null   (null to unassign)
//     "dueDate":     ISO-8601 string | null
//     "order":       number
//   }
//
// Only the task creator, the current assignee, or a project ADMIN/OWNER
// may update a task (least-privilege check).
//
// Response 200:
//   { success: true, task: Task }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────────────────
    const user = await AuthService.getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // ── 2. Fetch existing task ────────────────────────────────────────────────
    const existing = await TaskService.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // ── 3. Authorise ──────────────────────────────────────────────────────────
    // Rule: the user must be either:
    //   (a) the task creator,
    //   (b) the current assignee, OR
    //   (c) a project OWNER / ADMIN
    const membership = await ProjectService.isUserAlreadyMember(existing.projectId, user.id);

    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden — you are not a member of this project' },
        { status: 403 },
      );
    }

    const isAdmin = await ProjectService.isUserAdmin(existing.projectId, user.id);
    const isOwner = await ProjectService.isUserOwner(existing.projectId, user.id);
    const isCreator = existing.createdById === user.id;
    const isAssignee = existing.assigneeId === user.id;

    if (!isCreator && !isAssignee && !isAdmin && !isOwner) {
      return NextResponse.json(
        {
          error:
            'Forbidden — only the task creator, assignee, or a project admin/owner can update this task',
        },
        { status: 403 },
      );
    }

    // ── 4. Parse body ─────────────────────────────────────────────────────────
    const body = await request.json();
    const { title, description, status, assigneeId, dueDate, order } = body;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json(
          { error: 'title cannot be empty' },
          { status: 400 },
        );
      }
      if (title.trim().length > 200) {
        return NextResponse.json(
          { error: 'title must be at most 200 characters' },
          { status: 400 },
        );
      }
    }

    if (assigneeId !== undefined && assigneeId !== null) {
      const assigneeIsMember = await ProjectService.isUserAlreadyMember(
        existing.projectId,
        String(assigneeId),
      );
      if (!assigneeIsMember) {
        return NextResponse.json(
          { error: 'Assignee must be a member of the project' },
          { status: 400 },
        );
      }
    }

    let parsedDueDate: Date | null | undefined = undefined;
    if (dueDate !== undefined) {
      if (dueDate === null) {
        parsedDueDate = null;
      } else {
        const date = new Date(dueDate);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'Invalid due date' },
            { status: 400 },
          );
        }
        date.setHours(23, 59, 59, 999);
        parsedDueDate = date;
      }
    }

    const updatedTask = await TaskService.update(id, {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(description !== undefined && {
        description: description === null ? null : String(description).trim(),
      }),
      ...(status !== undefined && { status: status.toUpperCase() }),
      // assigneeId === null → unassign; assigneeId === string → reassign
      ...(assigneeId !== undefined && {
        assigneeId: assigneeId === null ? null : String(assigneeId),
      }),
      ...(parsedDueDate !== undefined && { dueDate: parsedDueDate }),
      ...(order !== undefined && { order: Number(order) }),
    });

    // Fetch the updated task with related data for the response
    const fullTask = await TaskService.getByIdWithRelations(updatedTask.id);

    return NextResponse.json({ success: true, task: fullTask });
  } catch (error) {
    console.error('TASK UPDATE ERROR:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// ── DELETE /api/v1/tasks/[id] ─────────────────────────────────────────────────
//
// Hard-delete a task.
// Only the task creator or a project OWNER / ADMIN may delete a task.
//
// Response 200:
//   { success: true, message: "Task deleted" }

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────────────────
    const user = await AuthService.getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // ── 2. Fetch task ─────────────────────────────────────────────────────────
    const existing = await TaskService.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // ── 3. Authorise ──────────────────────────────────────────────────────────
    // Only the task creator or a project OWNER / ADMIN can delete.
    const membership = await ProjectService.isUserAlreadyMember(existing.projectId, user.id);

    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden — you are not a member of this project' },
        { status: 403 },
      );
    }

    const isOwner = await ProjectService.isUserOwner(existing.projectId, user.id);
    const isAdmin = await ProjectService.isUserAdmin(existing.projectId, user.id);
    const isCreator = existing.createdById === user.id;

    if (!isCreator && !isAdmin && !isOwner) {
      return NextResponse.json(
        {
          error: 'Forbidden — only the task creator or a project admin/owner can delete this task',
        },
        { status: 403 },
      );
    }

    // ── 4. Delete ─────────────────────────────────────────────────────────────
    await TaskService.delete(id);

    return NextResponse.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('TASK DELETE ERROR:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
