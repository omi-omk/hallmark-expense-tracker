import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { FundForm } from '@/components/fund-form'
import { ResetCredentialsForm } from '@/components/reset-credentials-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExpenseWithCategory, FundTransfer } from '@/types'

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [workerRes, transfersRes, expensesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('fund_transfers').select('*').eq('worker_id', id).order('created_at', { ascending: false }),
    supabase.from('expenses').select('*, categories(name)').eq('worker_id', id).order('date', { ascending: false }),
  ])

  if (!workerRes.data) notFound()

  const worker = workerRes.data
  const transfers = (transfersRes.data ?? []) as FundTransfer[]
  const expenses = (expensesRes.data ?? []) as ExpenseWithCategory[]
  const balance = calculateBalance(transfers, expenses)
  const isLow = balance < worker.low_balance_threshold

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
          <p className="text-xs text-muted-foreground mt-1">
            Alert threshold: ₹{worker.low_balance_threshold.toLocaleString('en-IN')}
          </p>
        </CardContent>
      </Card>

      <ResetCredentialsForm workerId={worker.id} />

      <Card>
        <CardHeader><CardTitle>Fund History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfers yet.</p>
          ) : transfers.map(t => (
            <div key={t.id} className="flex justify-between text-sm py-1 border-b last:border-0">
              <div>
                <p className="font-medium text-green-700">+₹{t.amount.toLocaleString('en-IN')}</p>
                {t.note && <p className="text-muted-foreground">{t.note}</p>}
              </div>
              <p className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses yet.</p>
          ) : expenses.map(e => (
            <div key={e.id} className="flex justify-between text-sm py-1 border-b last:border-0">
              <div>
                <p className="font-medium">{e.categories.name}</p>
                <p className="text-muted-foreground">{e.date}{e.comment ? ` — ${e.comment}` : ''}</p>
              </div>
              <p className="text-red-600">-₹{e.amount.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
