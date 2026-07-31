"use client"
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/ToastProvider';

interface DashboardStat {
  label: string;
  value: string;
  description: string;
  href?: string;
  cta?: string;
  accent?: string;
  border?: string;
}

export default function DashboardCards() {
  const { addToast } = useToast();
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load dashboard stats');
        const data = await res.json();
        // Expect data.stats as array matching DashboardStat shape
        setStats(data.stats ?? []);
      } catch (e: any) {
        addToast(e.message ?? 'Error loading dashboard', 'error');
      } finally {
        setLoading(false);
      }
    }
    void fetchStats();
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading dashboard...</p>;
  }

  if (!stats.length) {
    return <p className="text-muted-foreground">No dashboard data available.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label} className={`border ${stat.border ?? 'border-border'}`}>
          <CardHeader className="pb-2">
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-4xl font-bold tabular-nums">{stat.value}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{stat.description}</span>
              {stat.href && stat.cta && (
                <a
                  href={stat.href}
                  className={`text-xs font-medium ${stat.accent ?? 'text-primary'} hover:opacity-70 transition-opacity`}
                >
                  {stat.cta}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
