import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { ProjectService } from '@/services/project.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await AuthService.getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: projectId } = await params;

  // Verify requester is the current owner.
  const isOwner = await ProjectService.isUserOwner(projectId, user.id);
  if (!isOwner) {
    return NextResponse.json({ error: 'Only the current owner can transfer ownership' }, { status: 403 });
  }

  const { newOwnerId } = await request.json();
  if (!newOwnerId) {
    return NextResponse.json({ error: 'newOwnerId is required' }, { status: 400 });
  }

  try {
    await ProjectService.transferOwnership(projectId, newOwnerId, user.id);
    return NextResponse.json({ success: true, message: 'Ownership transferred' });
  } catch (error) {
    console.error('TRANSFER OWNERSHIP ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
