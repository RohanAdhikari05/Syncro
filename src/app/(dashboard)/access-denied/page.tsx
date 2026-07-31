import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AccessDeniedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          403
        </p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Access denied</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          You do not have permission to view this page or perform this action.
          Contact a project owner or admin if you believe this is a mistake.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="rounded-lg">
            <Link href="/projects">Back to projects</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
