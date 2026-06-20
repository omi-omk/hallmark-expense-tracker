import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, ImageIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CategorySpendPieChart } from '@/components/category-spend-pie-chart'
import { buildEmployeeSpend, type ReportEntry } from '@/lib/reports/analytics'
import { ownerExpenseDetailUrl } from '@/lib/transactions/urls'

interface ExpenseRow {
  id: string
  amount: number
  date: string
  comment: string | null
  image_url: string | null
  created_at: string
  worker_id: string
  profiles: { id?: string | null; name?: string | null; email?: string | null } | null
}

export default async function ExpenseCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [categoryRes, expensesRes] = await Promise.all([
    admin.from('categories').select('*').eq('id', id).single(),
    admin
      .from('expenses')
      .select('id, amount, date, comment, image_url, created_at, worker_id, profiles(id, name, email)')
      .eq('category_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!categoryRes.data) notFound()

  const category = categoryRes.data
  const expenses = (expensesRes.data ?? []) as ExpenseRow[]
  const totalSpend = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const employeeCount = new Set(expenses.map(expense => expense.worker_id)).size
  const analyticsEntries = expenses.map((expense): ReportEntry => ({
    id: expense.id,
    type: 'debit',
    amount: expense.amount,
    worker_id: expense.worker_id,
    profiles: expense.profiles,
  }))
  const employeeSpend = buildEmployeeSpend(analyticsEntries)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/owner/settings">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Settings
            </Button>
          </Link>
          <h1 className="mt-2 break-words text-2xl font-bold">{category.name}</h1>
          <p className="text-sm text-muted-foreground">
            Expense category detail and employee-wise spending.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Spend</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">₹{totalSpend.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Entries</p>
            <p className="mt-1 text-2xl font-semibold">{expenses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="mt-1 text-2xl font-semibold">{employeeCount}</p>
          </CardContent>
        </Card>
      </div>

      <CategorySpendPieChart
        title="Employee Spend"
        description={`Debit entries in ${category.name}, grouped by employee.`}
        categorySpend={employeeSpend}
        emptyMessage="No expenses in this category yet."
        filterKind="employee"
      />

      <Card>
        <CardHeader><CardTitle>Entries</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : expenses.map(expense => (
            <Link
              key={expense.id}
              href={ownerExpenseDetailUrl(expense.id)}
              className="block border-b py-2 last:border-0 hover:bg-muted/30"
            >
              <div className="flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{expense.profiles?.name ?? 'Employee'}</p>
                    {expense.image_url && (
                      <ImageIcon className="h-4 w-4 shrink-0 text-blue-600" aria-label="Receipt uploaded" />
                    )}
                  </div>
                  {expense.comment && <p className="truncate text-muted-foreground">{expense.comment}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div>
                    <p className="font-medium text-red-600">-₹{expense.amount.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">{expense.date}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
