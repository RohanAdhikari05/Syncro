import { NextResponse } from "next/server";
import { ProjectService } from "@/services/project.service";
import { AuthService } from "@/services/auth.service";

export async function POST(request: Request) {
  try {
    // Extract the project details sent by the client in the request body.
    // Example body:
    // {
    //   "name": "AI Dashboard",
    //   "description": "Dashboard for analytics"
    // }
    const { name, description } = await request.json();
    const user = await AuthService.getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "Project name must be at least 2 characters" },
        { status: 400 },
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Project name must be at most 100 characters" },
        { status: 400 },
      );
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description === "string" &&
      description.trim().length > 500
    ) {
      return NextResponse.json(
        { error: "Description must be at most 500 characters" },
        { status: 400 },
      );
    }

    // Create a new project.
    // The currently authenticated user becomes the owner of the project.
    const project = await ProjectService.create({
      name: name.trim(),
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : "No description provided yet.",
      ownerId: user.id,
    });

    // Return the newly created project to the client.
    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    // Catch any unexpected errors such as:
    // - Invalid/expired JWT
    // - Database connection issues
    // - Prisma errors
    // - Project creation failures

    console.error("PROJECT CREATE ERROR:", error);

    // Return a generic 500 Internal Server Error response.
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
export async function GET(request: Request) {
  try {
    //authorize user
    const user = await AuthService.getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    //get projects in which user as member
    const projects = await ProjectService.getUserProjects(user.id);

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.log("error in fetching projects :", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}