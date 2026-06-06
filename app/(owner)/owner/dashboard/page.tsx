import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { WorkerCard } from '@/components/worker-card'
import type { Profile, WorkerWithBalance } from '@/types'

export default async function OwnerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: workers } = await admin
    .from('profiles')
    .select('*')
    .eq('role', 'worker')
    .eq('is_active', true)
    .order('name')

  const workersWithBalance: WorkerWithBalance[] = await Promise.all(
    (workers as Profile[] ?? []).map(async (worker: Profile) => {
      const [transfersRes, expensesRes] = await Promise.all([
        admin.from('fund_transfers').select('amount').eq('worker_id', worker.id),
        admin.from('expenses').select('amount').eq('worker_id', worker.id),
      ])
      const balance = calculateBalance(transfersRes.data ?? [], expensesRes.data ?? [])
      return { ...worker, balance }
    })
  )

  const lowBalanceCount = workersWithBalance.filter(
    w => w.balance < w.low_balance_threshold
  ).length

  // Sort: low-balance employees first
  const sorted = [...workersWithBalance].sort((a, b) => {
    const aLow = a.balance < a.low_balance_threshold
    const bLow = b.balance < b.low_balance_threshold
    if (aLow && !bLow) return -1
    if (!aLow && bLow) return 1
    return 0
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {lowBalanceCount > 0 && (
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
            <span>⚠️ {lowBalanceCount} employee{lowBalanceCount > 1 ? 's' : ''} with low balance</span>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground">No employees yet. Add employees from the Employees page.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map(worker => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </div>
  )
}
