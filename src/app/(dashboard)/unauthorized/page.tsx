'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          401
        </p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Session expired</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          You need to sign in to access this page. Your session may have expired
          or you are not authenticated.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="rounded-lg">
            <Link href="/register">Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
