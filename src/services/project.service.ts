import { prisma } from "@/lib/prisma";
import type { Project, CreateProjectInput, UpdateProjectInput } from "@/types";
import { Prisma, ProjectMember, ProjectRole } from "@prisma/client";

export class ProjectService {
  // Create a new project and assign the owner as the first member.
  static async create(input: CreateProjectInput): Promise<Project> {
    const inviteCode = crypto.randomUUID().slice(0, 8);
    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name: input.name,
          description: input.description,
          inviteCode,
        },
      });
      console.log("INPUT:", input);
      console.log("OWNER ID:", input.ownerId);
      await tx.projectMember.create({
        data: {
          projectId: createdProject.id,
          userId: input.ownerId,
          role: "OWNER",
        },
      });
      return createdProject;
    });
    return project as Project;
  }

  // Get all projects where the user is a member.
  // Include member user info so the API can return member names and other details.
  static async getUserProjects(userId: string): Promise<any[]> {
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    // Normalize members to include top-level name/email/imageUrl to match frontend expectations
    return projects.map((p) => {
      const members = p.members.map((m: ProjectMember & { user: any }) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        name: m.user?.name ?? '',
        email: m.user?.email ?? '',
        imageUrl: m.user?.imageUrl ?? null,
      }));
      const currentMembership = members.find((m) => m.userId === userId);

      return {
        ...p,
        currentUserRole: currentMembership?.role ?? null,
        members,
      };
    });
  }

  // Get all members of a specific project, including user info.
  static async getProjectMembers(projectId: string): Promise<any[]> {
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      name: m.user?.name ?? '',
      email: m.user?.email ?? '',
      imageUrl: m.user?.imageUrl ?? null,
    }));
  }

  // Get a project by its ID.
  static async getProjectById(id: string): Promise<any | null> {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: { include: { user: true } } },
    });

    if (!project) return null;

    return {
      ...project,
      members: project.members.map((m: ProjectMember & { user: any }) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        name: m.user?.name ?? '',
        email: m.user?.email ?? '',
        imageUrl: m.user?.imageUrl ?? null,
      })),
    };
  }
  static async getUserRole(
    projectId: string,
    userId: string,
  ): Promise<ProjectRole | null> {
    const projectMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    return projectMembership?.role ?? null;
  }

  static async isUserAdminOrOwner(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    const role = await ProjectService.getUserRole(projectId, userId);
    return role === "ADMIN" || role === "OWNER";
  }

  // Check if a user is an admin of a project.
  static async isUserAdmin(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    const projectMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    if (!projectMembership) {
      return false;
    }
    if (projectMembership.role === "ADMIN") {
      return true;
    } else {
      return false;
    }
  }

  // Check if a user is the owner of a project.
  static async isUserOwner(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    const projectMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    if (!projectMembership) {
      return false;
    }
    if (projectMembership.role === "OWNER") {
      return true;
    } else {
      return false;
    }
  }

  // update a project by its ID.
  static async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Project not found");
    }

    const data: Prisma.ProjectUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }
    data.status = input.status ?? existing.status;
    data.updatedAt = new Date();
    return prisma.project.update({
      where: { id },
      data,
    });
  }

  // Add a member to a project with a specific role.
  static async addMember(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<ProjectMember> {
    // Check if already a member
    const existing = await ProjectService.isUserAlreadyMember(
      projectId,
      userId,
    );
    if (existing) {
      throw new Error("User is already a member of this project");
    }
    return await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
    });
  }

  // Check if a user is already a member of a project.
  static async isUserAlreadyMember(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    return existing ? true : false;
  }

  // Check if an invite code corresponds to a valid project.
  static async checkInviteCode(inviteCode: string): Promise<Project | null> {
    const project = await prisma.project.findUnique({
      where: { inviteCode },
    });
    return project ? project : null;
  }

  static async removeMember(
    projectId: string,
    targetUserId: string,
    requesterId: string,
  ): Promise<void> {
    const requesterRole = await ProjectService.getUserRole(
      projectId,
      requesterId,
    );
    const targetRole = await ProjectService.getUserRole(
      projectId,
      targetUserId,
    );

    if (!requesterRole || !targetRole) {
      throw new Error("Member not found in this project");
    }

    const isSelf = requesterId === targetUserId;

    if (isSelf) {
      if (targetRole === "OWNER") {
        throw new Error(
          "Project owners cannot leave until ownership is transferred",
        );
      }
    } else if (requesterRole === "OWNER") {
      if (targetRole === "OWNER") {
        throw new Error("Cannot remove the project owner");
      }
    } else if (requesterRole === "ADMIN") {
      if (targetRole !== "MEMBER") {
        throw new Error("Admins can only remove members");
      }
    } else {
      throw new Error("You do not have permission to remove members");
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId: targetUserId },
      },
    });
  }

  static async updateMemberRole(
    projectId: string,
    targetUserId: string,
    newRole: ProjectRole,
    requesterId: string,
  ): Promise<ProjectMember> {
    if (newRole === "OWNER") {
      throw new Error("Use a dedicated flow to transfer project ownership");
    }

    const requesterRole = await ProjectService.getUserRole(
      projectId,
      requesterId,
    );
    const targetRole = await ProjectService.getUserRole(
      projectId,
      targetUserId,
    );

    if (!requesterRole || !targetRole) {
      throw new Error("Member not found in this project");
    }

    if (requesterId === targetUserId) {
      throw new Error("You cannot change your own role");
    }

    if (targetRole === "OWNER") {
      throw new Error("Cannot change the project owner's role");
    }

    if (requesterRole === "OWNER") {
      // Owner can promote/demote admins and members.
    } else if (requesterRole === "ADMIN") {
      if (targetRole !== "MEMBER" || newRole !== "ADMIN") {
        throw new Error("Admins can only promote members to admin");
      }
    } else {
      throw new Error("You do not have permission to change member roles");
    }

    return prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId: targetUserId },
      },
      data: { role: newRole },
    });
  }

  // Delete a project by its ID with permission check.
  static async delete(projectId: string, requesterId: string): Promise<void> {
    // Only owner or admin can delete a project.
    const isOwner = await this.isUserOwner(projectId, requesterId);
    const isAdmin = await this.isUserAdmin(projectId, requesterId);
    if (!isOwner && !isAdmin) {
      throw new Error('Only project owners or admins can delete the project');
    }
    await prisma.project.delete({ where: { id: projectId } });
  }

  // Transfer project ownership to an existing member.
  static async transferOwnership(projectId: string, newOwnerId: string, requesterId: string): Promise<void> {
    // Verify requester is current owner.
    const currentOwner = await this.getUserRole(projectId, requesterId);
    if (currentOwner !== 'OWNER') {
      throw new Error('Only the current owner can transfer ownership');
    }
    // Verify new owner is an existing member.
    const newOwnerRole = await this.getUserRole(projectId, newOwnerId);
    if (!newOwnerRole) {
      throw new Error('New owner must be a member of the project');
    }
    // Perform the role swap within a transaction.
    await prisma.$transaction(async (tx) => {
      // Demote current owner to ADMIN (or MEMBER based on policy).
      await tx.projectMember.update({
        where: { projectId_userId: { projectId, userId: requesterId } },
        data: { role: 'ADMIN' },
      });
      // Promote new owner.
      await tx.projectMember.update({
        where: { projectId_userId: { projectId, userId: newOwnerId } },
        data: { role: 'OWNER' },
      });
    });
  }
}
