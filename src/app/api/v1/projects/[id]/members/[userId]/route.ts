import { AuthService } from '@/services/auth.service'
import { ProjectService } from '@/services/project.service'
import { NextResponse } from 'next/server'
import type { ProjectRole } from '@/types/project'

type RouteParams = { params: Promise<{ id: string; userId: string }> }

const VALID_ROLES: ProjectRole[] = ['ADMIN', 'MEMBER']

async function authorizeMemberAction(
  request: Request,
  projectId: string,
  targetUserId: string,
) {
  const user = await AuthService.getCurrentUser(request)
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const project = await ProjectService.getProjectById(projectId)
  if (!project) {
    return {
      error: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    }
  }

  const isMember = await ProjectService.isUserAlreadyMember(projectId, user.id)
  if (!isMember) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — you are not a member of this project' },
        { status: 403 },
      ),
    }
  }

  const targetIsMember = await ProjectService.isUserAlreadyMember(
    projectId,
    targetUserId,
  )
  if (!targetIsMember) {
    return {
      error: NextResponse.json(
        { error: 'Member not found in this project' },
        { status: 404 },
      ),
    }
  }

  return { user }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: projectId, userId: targetUserId } = await params
  const authResult = await authorizeMemberAction(request, projectId, targetUserId)
  if ('error' in authResult && authResult.error) {
    return authResult.error
  }

  const { user } = authResult

  try {
    const body = await request.json()
    const role = String(body?.role ?? '').toUpperCase() as ProjectRole

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'role must be ADMIN or MEMBER' },
        { status: 400 },
      )
    }

    const updatedMember = await ProjectService.updateMemberRole(
      projectId,
      targetUserId,
      role,
      user.id,
    )

    return NextResponse.json({ success: true, member: updatedMember })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes('permission') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: projectId, userId: targetUserId } = await params
  const authResult = await authorizeMemberAction(request, projectId, targetUserId)
  if ('error' in authResult && authResult.error) {
    return authResult.error
  }

  const { user } = authResult

  try {
    await ProjectService.removeMember(projectId, targetUserId, user.id)
    return NextResponse.json({ success: true, message: 'Member removed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes('permission') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
