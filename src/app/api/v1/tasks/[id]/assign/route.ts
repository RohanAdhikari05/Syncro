import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { TaskService } from '@/services/task.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await AuthService.getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: taskId } = await params;
  const { assigneeId } = await request.json();
  if (!assigneeId) {
    return NextResponse.json({ error: 'assigneeId is required' }, { status: 400 });
  }
  try {
    await TaskService.assignTask(taskId, assigneeId, user.id);
    return NextResponse.json({ success: true, message: 'Assignee set' });
  } catch (error) {
    console.error('ASSIGN TASK ERROR:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
