import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { FundForm } from '@/components/fund-form'
import { ResetCredentialsForm } from '@/components/reset-credentials-form'
import { ThresholdForm } from '@/components/threshold-form'
import { CategorySpendPieChart } from '@/components/category-spend-pie-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildReportAnalytics, type ReportEntry } from '@/lib/reports/analytics'
import type { ExpenseWithCategory, FundTransfer } from '@/types'

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [workerRes, transfersRes, expensesRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', id).single(),
    admin.from('fund_transfers').select('*').eq('worker_id', id).order('created_at', { ascending: false }),
    admin.from('expenses').select('*, categories(name)').eq('worker_id', id).order('created_at', { ascending: false }),
  ])

  if (!workerRes.data) notFound()
  if (workerRes.data.role !== 'worker') notFound()

  const worker = workerRes.data
  const transfers = (transfersRes.data ?? []) as FundTransfer[]
  const expenses = (expensesRes.data ?? []) as ExpenseWithCategory[]
  const balance = calculateBalance(transfers, expenses)
  const isLow = balance < worker.low_balance_threshold
  const employeeAnalytics = buildReportAnalytics(
    expenses.map((expense): ReportEntry => ({
      id: expense.id,
      type: 'debit',
      amount: expense.amount,
      categories: expense.categories,
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{worker.name}</h1>
          <p className="text-muted-foreground">{worker.email}</p>
        </div>
        <FundForm workerId={worker.id} />
      </div>

      <Card className={isLow ? 'border-red-300 bg-red-50' : ''}>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className={`text-3xl font-bold ${isLow ? 'text-red-600' : ''}`}>
            ₹{balance.toLocaleString('en-IN')}
          </p>
          <ThresholdForm workerId={worker.id} currentThreshold={worker.low_balance_threshold} />
        </CardContent>
      </Card>

      <ResetCredentialsForm workerId={worker.id} currentName={worker.name} />

      <CategorySpendPieChart
        title="Employee Category Spend"
        description="This employee's debit expenses grouped by category."
        categorySpend={employeeAnalytics.categorySpend}
        emptyMessage="No expenses to chart for this employee yet."
      />

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {transfers.length === 0 && expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            [
              ...transfers.map(t => ({ type: 'credit' as const, sortKey: t.created_at, entry: t })),
              ...expenses.map(e => ({ type: 'debit' as const, sortKey: e.created_at, entry: e })),
            ]
              .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
              .map(item => {
                const ts = new Date(item.entry.created_at)
                const dateStr = ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
                return item.type === 'credit' ? (
                  <div key={`t-${item.entry.id}`} className="flex justify-between text-sm py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-green-700">Funds Added</p>
                      {(item.entry as FundTransfer).note && (
                        <p className="text-muted-foreground">{(item.entry as FundTransfer).note}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-green-700">+₹{item.entry.amount.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-muted-foreground">{dateStr}, {timeStr}</p>
                    </div>
                  </div>
                ) : (
                  <div key={`e-${item.entry.id}`} className="py-2 border-b last:border-0">
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="font-medium">{(item.entry as ExpenseWithCategory).categories.name}</p>
                        {(item.entry as ExpenseWithCategory).comment && (
                          <p className="text-muted-foreground">{(item.entry as ExpenseWithCategory).comment}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-red-600">-₹{item.entry.amount.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-muted-foreground">{dateStr}, {timeStr}</p>
                      </div>
                    </div>
                    {(item.entry as ExpenseWithCategory).image_url && (
                      <a href={(item.entry as ExpenseWithCategory).image_url!} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        View receipt
                      </a>
                    )}
                  </div>
                )
              })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
