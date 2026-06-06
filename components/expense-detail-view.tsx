/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ArrowLeft, ImageIcon, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExpenseWithCategory } from '@/types'

interface ExpenseDetailViewProps {
  expense: ExpenseWithCategory
  backHref: string
  backLabel: string
  employee?: {
    name?: string | null
    email?: string | null
  } | null
}

export function ExpenseDetailView({ expense, backHref, backLabel, employee }: ExpenseDetailViewProps) {
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
