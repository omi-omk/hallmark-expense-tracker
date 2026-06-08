'use client'

import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  buildExpenseActivitySummary,
  type ExpenseActivityAction,
  type ExpenseFieldDiff,
  type ExpenseSnapshot,
} from '@/lib/expenses/activity-log'
import type { ExpenseActivityLog, Profile } from '@/types'

interface EnrichedExpenseActivityLog extends ExpenseActivityLog {
  actor?: Pick<Profile, 'name' | 'email' | 'role'> | null
  employee?: Pick<Profile, 'name' | 'email' | 'role'> | null
}

export function ExpenseActivityLogCard() {
  const [logs, setLogs] = useState<EnrichedExpenseActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function loadLogs() {
      try {
        const response = await fetch('/api/expense-activity')
        if (!response.ok) return
        const data = await response.json()
        if (active) setLogs(data.logs ?? [])
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadLogs()
    return () => {
      active = false
    }
  }, [])

  return (
    <Card>
      <CardHeader><CardTitle>Entry Activity</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading activity...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entry edits or deletes yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {buildExpenseActivitySummary(
                        log.action as ExpenseActivityAction,
                        log.action === 'edited'
                          ? (log.old_values as ExpenseFieldDiff)
                          : (log.old_values ?? log.new_values) as ExpenseSnapshot
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.actor?.name ?? capitalize(log.actor_role)} → {log.employee?.name ?? 'Employee'}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-muted-foreground">
                    <Clock3 className="mr-1 inline h-3 w-3" />
                    {formatActivityTime(log.created_at)}
                  </p>
                </div>
                {log.action === 'edited' && <ChangeSummary changes={log.old_values as ExpenseFieldDiff} />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChangeSummary({ changes }: { changes: ExpenseFieldDiff }) {
  const entries = Object.entries(changes).filter(([field]) => field !== 'category_name')
  if (entries.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {entries.map(([field]) => (
        <span key={field} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {field.replace('_id', '').replace('_', ' ')}
        </span>
      ))}
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatActivityTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}
