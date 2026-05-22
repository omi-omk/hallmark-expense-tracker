import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { BalanceCard } from '@/components/balance-card'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExpenseWithCategory } from '@/types'

export default async function WorkerDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [profileRes, transfersRes, allExpensesRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('fund_transfers').select('amount').eq('worker_id', user.id),
    admin
      .from('expenses')
      .select('*, categories(name)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const profile = profileRes.data
  const transfers = transfersRes.data ?? []
  const allExpenses = (allExpensesRes.data ?? []) as ExpenseWithCategory[]
  const recentExpenses = allExpenses.slice(0, 5)

  const balance = calculateBalance(transfers, allExpenses)

  return (
    <div className="space-y-6">
      <BalanceCard balance={balance} threshold={profile?.low_balance_threshold ?? 500} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Expenses</h2>
        <Link href="/expenses" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
          View all
        </Link>
      </div>

      {recentExpenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {recentExpenses.map(expense => (
            <Card key={expense.id}>
              <CardContent className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{expense.categories.name}</p>
                  <p className="text-xs text-muted-foreground">{expense.date}</p>
                </div>
                <p className="font-semibold">₹{expense.amount.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link href="/expenses/new" className={cn(buttonVariants(), 'w-full justify-center')}>
        + Add Expense
      </Link>
    </div>
  )
}
