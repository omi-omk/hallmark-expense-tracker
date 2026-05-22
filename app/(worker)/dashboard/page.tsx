import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { BalanceCard } from '@/components/balance-card'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExpenseWithCategory, FundTransfer } from '@/types'

export default async function WorkerDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [profileRes, transfersRes, allExpensesRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('fund_transfers').select('*').eq('worker_id', user.id),
    admin
      .from('expenses')
      .select('*, categories(name)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const profile = profileRes.data
  const transfers = (transfersRes.data ?? []) as FundTransfer[]
  const allExpenses = (allExpensesRes.data ?? []) as ExpenseWithCategory[]

  const balance = calculateBalance(transfers, allExpenses)

  // Build combined recent transactions (5 most recent)
  type RecentEntry =
    | { kind: 'expense'; data: ExpenseWithCategory; sortKey: string }
    | { kind: 'transfer'; data: FundTransfer; sortKey: string }

  const recentCombined: RecentEntry[] = [
    ...allExpenses.map(e => ({ kind: 'expense' as const, data: e, sortKey: e.created_at })),
    ...transfers.map(t => ({ kind: 'transfer' as const, data: t, sortKey: t.created_at })),
  ]
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <BalanceCard balance={balance} threshold={profile?.low_balance_threshold ?? 500} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Transactions</h2>
        <Link href="/expenses" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
          View all
        </Link>
      </div>

      {recentCombined.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <div className="space-y-2">
          {recentCombined.map(entry => {
            if (entry.kind === 'transfer') {
              const t = entry.data
              return (
                <Card key={`t-${t.id}`} className="border-green-200 bg-green-50">
                  <CardContent className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-green-700">Funds Added</p>
                      <p className="text-xs text-muted-foreground">{t.created_at.split('T')[0]}</p>
                      {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                    </div>
                    <p className="font-semibold text-green-700">+₹{t.amount.toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
              )
            }
            const e = entry.data as ExpenseWithCategory
            return (
              <Card key={`e-${e.id}`}>
                <CardContent className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{e.categories.name}</p>
                    <p className="text-xs text-muted-foreground">{e.date}</p>
                  </div>
                  <p className="font-semibold text-red-600">-₹{e.amount.toLocaleString('en-IN')}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Link href="/expenses/new" className={cn(buttonVariants(), 'w-full justify-center')}>
        + Add Expense
      </Link>
    </div>
  )
}
