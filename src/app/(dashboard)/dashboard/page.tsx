import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import DashboardCards from "@/components/dashboard/DashboardCards";

async function fetchApi<T>(path: string, token: string | null): Promise<T | null> {
  const headers: HeadersInit = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || vercelUrl || "http://localhost:3000";
  
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers, cache: "no-store" });
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`[fetchApi] Error fetching ${path}:`, error);
    return null;
  }
}

const quickActions = [
  {
    label: "New Project",
    description: "Start a new project for your team",
    href: "/projects",
  },
  {
    label: "New Task",
    description: "Add a task to an existing project",
    href: "/tasks",
  },
];

function formatDueDate(date: Date): { label: string; urgent: boolean } {
  const now = new Date();
  const diff = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diff === 0) return { label: "Due today", urgent: true };
  if (diff === 1) return { label: "Due tomorrow", urgent: true };
  if (diff <= 3) return { label: `Due in ${diff} days`, urgent: true };
  return {
    label: `Due ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    urgent: false,
  };
}

export default async function DashboardPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const firstName = user?.firstName ?? "there";
  const token = await getToken({ template: "postman" });

  const [projectsResponse, tasksResponse] = await Promise.all([
    fetchApi<{ success: boolean; projects?: Array<any> }>('/api/v1/projects', token),
    fetchApi<{ success: boolean; tasks?: Array<any> }>('/api/v1/tasks', token),
  ]);

  const projects = Array.isArray(projectsResponse?.projects) ? projectsResponse.projects : [];
  const tasks = Array.isArray(tasksResponse?.tasks) ? tasksResponse.tasks : [];
  const projectNameById = new Map<string, string>(
    projects.map((project: any) => [project?.id ?? '', project?.name ?? 'Untitled project']),
  );
  const resolveProjectName = (task: any) =>
    projectNameById.get(task?.projectId ?? task?.project?.id ?? '') ??
    task?.project?.name ??
    task?.projectName ??
    'Unknown project';

  const totalProjectsCount = projects.length;
  const openTasksCount = tasks.filter((task) => task?.status !== 'DONE' && task?.status !== 'done').length;
  const recentProjects = projects.slice(0, 3);
  const recentTasks = tasks
    .filter((task) => task?.status !== 'DONE' && task?.status !== 'done')
    .slice(0, 3)
    .map((task) => ({
      ...task,
      resolvedProjectName: resolveProjectName(task),
    }));
  const deadlines = tasks
    .filter((task) => task?.dueDate && task?.status !== 'DONE' && task?.status !== 'done')
    .map((task) => {
      const parsedDate = new Date(task.dueDate);
      return {
        id: task.id,
        title: task.title,
        project: resolveProjectName(task),
        projectId: task.projectId,
        dueDate: parsedDate,
        projectHref: `/projects/${task.projectId}`,
        taskHref: `/tasks/${task.id}`,
      };
    })
    .filter((item) => !Number.isNaN(item.dueDate.getTime()));

  const stats = [
    {
      label: "Total Projects",
      value: String(totalProjectsCount),
      description: totalProjectsCount === 1 ? "1 project active" : `${totalProjectsCount} projects active`,
      href: "/projects",
      cta: "View projects →",
      accent: "text-blue-600",
      border: "border-blue-100",
    },
    {
      label: "Open Tasks",
      value: String(openTasksCount),
      description: openTasksCount === 1 ? "1 task open" : `${openTasksCount} tasks open`,
      href: "/tasks",
      cta: "View tasks →",
      accent: "text-sky-600",
      border: "border-sky-100",
    },
  ];

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="flex-1 p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-muted-foreground font-medium mb-1">{greeting}</p>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {firstName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here is what is happening in your workspace today.
        </p>
      </div>

      <Separator className="mb-8" />

      {/* Stats + Deadlines row */}
      <section className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Overview
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Stat cards */}
          <DashboardCards />

          {/* Upcoming deadlines card */}
          <Card className="border border-border row-span-1">
            <CardHeader className="pb-2">
              <CardDescription>Upcoming Deadlines</CardDescription>
              <CardTitle className="text-sm font-semibold text-foreground">
                {deadlines.length} upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col divide-y divide-border">
                {deadlines.slice(0, 3).map((item) => {
                  const { label, urgent } = formatDueDate(item.dueDate);
                  return (
                    <Link
                      key={item.id}
                      href={item.taskHref}
                      className="py-2.5 first:pt-0 last:pb-0 block hover:opacity-70 transition-opacity"
                    >
                      <p className="text-xs font-medium text-foreground leading-snug mb-0.5 truncate">
                        {item.title}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {item.project}
                        </span>
                        <span
                          className={`text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full ${
                            urgent
                              ? "bg-red-50 text-red-500"
                              : "bg-muted/60 text-muted-foreground"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {deadlines.length > 3 && (
                <>
                  <Separator className="my-2" />
                  <Link
                    href="/projects"
                    className="flex items-center justify-center gap-1 w-full pt-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>+{deadlines.length - 3} more</span>
                    <span>→</span>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Quick Actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map(({ label, description, href }) => (
            <Card
              key={label}
              className="border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-150"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                <CardDescription className="text-xs">
                  {description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  size="sm"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Link href={href}>+ {label}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
