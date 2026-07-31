import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { ProjectService } from '@/services/project.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await AuthService.getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: projectId } = await params;

  // Ensure requester is a member of the project.
  const isMember = await ProjectService.isUserAlreadyMember(projectId, user.id);
  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden — you are not a member of this project' }, { status: 403 });
  }

  // Generate (or retrieve existing) invite code.
  const project = await ProjectService.getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Invite code is already stored on the project; just return it.
  return NextResponse.json({ success: true, inviteCode: project.inviteCode });
}
