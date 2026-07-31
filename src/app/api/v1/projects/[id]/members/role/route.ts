import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { ProjectService } from '@/services/project.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await AuthService.getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: projectId } = await params;
  const { memberId, newRole } = await request.json();
  if (!memberId || !newRole) {
    return NextResponse.json({ error: 'memberId and newRole are required' }, { status: 400 });
  }
  try {
    const updatedMember = await ProjectService.updateMemberRole(projectId, memberId, newRole, user.id);
    return NextResponse.json({ success: true, member: updatedMember });
  } catch (error) {
    console.error('UPDATE MEMBER ROLE ERROR:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
