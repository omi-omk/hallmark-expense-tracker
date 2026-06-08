/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ArrowLeft, Clock3, ImageIcon, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ExpenseActions } from '@/components/expense-actions'
import { buildExpenseActivitySummary, type ExpenseActivityAction, type ExpenseFieldDiff, type ExpenseSnapshot } from '@/lib/expenses/activity-log'
import { cn } from '@/lib/utils'
import type { Category, ExpenseActivityLog, ExpenseWithCategory } from '@/types'

interface ExpenseDetailViewProps {
  expense: ExpenseWithCategory
  backHref: string
  backLabel: string
  employee?: {
    name?: string | null
    email?: string | null
  } | null
  categories?: Category[]
  canManage?: boolean
  deleteRedirectHref?: string
  activityLogs?: ExpenseActivityLog[]
}

export function ExpenseDetailView({
  expense,
  backHref,
  backLabel,
  employee,
  categories = [],
  canManage = false,
  deleteRedirectHref = backHref,
  activityLogs = [],
}: ExpenseDetailViewProps) {
  const createdAt = new Date(expense.created_at)
  const createdDate = createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
  const createdTime = createdAt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })

  return (
    <div className="space-y-5">
      <Link href={backHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}>
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Receipt className="h-5 w-5 shrink-0" />
                <span className="truncate">{expense.categories.name}</span>
              </CardTitle>
              {employee?.name && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {employee.name}{employee.email ? ` · ${employee.email}` : ''}
                </p>
              )}
            </div>
            {expense.image_url && <ImageIcon className="h-5 w-5 shrink-0 text-blue-600" aria-label="Receipt uploaded" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {canManage && (
            <ExpenseActions
              expense={expense}
              categories={categories}
              deleteRedirectHref={deleteRedirectHref}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Amount" value={`-₹${expense.amount.toLocaleString('en-IN')}`} danger />
            <Detail label="Expense Date" value={expense.date} />
            <Detail label="Recorded" value={`${createdDate}, ${createdTime}`} />
            <Detail label="Category" value={expense.categories.name} />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Comment</p>
            <p className="rounded-md border bg-muted/20 p-3 text-sm">
              {expense.comment?.trim() || 'No comment added.'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receipt Photo</p>
              {expense.image_url && (
                <a href={expense.image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                  Open image
                </a>
              )}
            </div>
            {expense.image_url ? (
              <div className="overflow-hidden rounded-md border bg-muted/20">
                <img src={expense.image_url} alt="Receipt" className="max-h-[70vh] w-full object-contain" />
              </div>
            ) : (
              <div className="grid min-h-32 place-items-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
                No receipt uploaded
              </div>
            )}
          </div>

          <ActivityHistory logs={activityLogs} />
        </CardContent>
      </Card>
    </div>
  )
}

function Detail({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={danger ? 'mt-1 font-semibold text-red-600' : 'mt-1 font-semibold'}>{value}</p>
    </div>
  )
}

function ActivityHistory({ logs }: { logs: ExpenseActivityLog[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity History</p>
      {logs.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
          No edit or delete activity yet.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="rounded-md border bg-background p-3">
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
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {log.actor_role} action
                  </p>
                </div>
                <p className="shrink-0 text-right text-xs text-muted-foreground">
                  <Clock3 className="mr-1 inline h-3 w-3" />
                  {formatActivityTime(log.created_at)}
                </p>
              </div>
              {log.action === 'edited' && <ChangeList changes={log.old_values as ExpenseFieldDiff} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChangeList({ changes }: { changes: ExpenseFieldDiff }) {
  const entries = Object.entries(changes).filter(([field]) => field !== 'category_name')
  if (entries.length === 0) return null

  return (
    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
      {entries.map(([field, change]) => (
        <div key={field} className="flex justify-between gap-3">
          <span className="capitalize">{field.replace('_id', '').replace('_', ' ')}</span>
          <span className="min-w-0 truncate text-right">
            {formatActivityValue(change.from)} → {formatActivityValue(change.to)}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatActivityValue(value: string | number | null): string {
  if (value === null || value === '') return 'Blank'
  if (typeof value === 'number') return `₹${value.toLocaleString('en-IN')}`
  return value
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
