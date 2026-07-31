"use server";
import { NextResponse } from 'next/server';

// Define the shape of a dashboard statistic
interface DashboardStat {
  label: string;
  value: string;
  description: string;
  href?: string;
  cta?: string;
  accent?: string;
  border?: string;
}

// Mock data – replace with real service calls when available
const stats: DashboardStat[] = [
  {
    label: 'Projects',
    value: '5',
    description: 'Total projects in the system',
    href: '/projects',
    cta: 'View',
    accent: 'text-primary',
    border: 'border-primary',
  },
  {
    label: 'Tasks',
    value: '12',
    description: 'All tasks across projects',
    href: '/tasks',
    cta: 'View',
    accent: 'text-primary',
    border: 'border-primary',
  },
  {
    label: 'Overdue',
    value: '3',
    description: 'Tasks past due date',
    href: '/tasks?filter=overdue',
    cta: 'View',
    accent: 'text-destructive',
    border: 'border-destructive',
  },
  {
    label: 'Completed',
    value: '7',
    description: 'Completed tasks',
    href: '/tasks?filter=completed',
    cta: 'View',
    accent: 'text-success',
    border: 'border-success',
  },
];

export async function GET() {
  return NextResponse.json({ stats });
}
