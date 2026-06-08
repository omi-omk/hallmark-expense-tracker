import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { calculateBalance } from '@/lib/balance'
import { CategorySpendPieChart } from '@/components/category-spend-pie-chart'
import { WorkerCard } from '@/components/worker-card'
import { normalizeDashboardSettings } from '@/lib/dashboard/settings'
import { buildEmployeeSpend, buildReportAnalytics, type ReportEntry } from '@/lib/reports/analytics'
import type { Profile, WorkerWithBalance } from '@/types'

interface ChartSection {
  key: string
  order: number
  node: ReactNode
}

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

  const [{ data: dashboardExpenses }, { data: settingsRow }] = await Promise.all([
    admin
      .from('expenses')
      .select('id, amount, worker_id, category_id, categories(id, name), profiles(id, name)'),
    admin
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle(),
  ])

  const settings = normalizeDashboardSettings(settingsRow)
  const dashboardEntries = (
    (dashboardExpenses ?? []) as {
      id: string
      amount: number
      worker_id?: string | null
      category_id?: string | null
      categories: { id?: string | null; name?: string | null } | null
      profiles: { id?: string | null; name?: string | null } | null
    }[]
  ).map((expense): ReportEntry => ({
    id: expense.id,
    type: 'debit',
    amount: expense.amount,
    worker_id: expense.worker_id,
    category_id: expense.category_id,
    categories: expense.categories,
    profiles: expense.profiles,
  }))
  const dashboardAnalytics = buildReportAnalytics(dashboardEntries)
  const employeeSpend = buildEmployeeSpend(dashboardEntries)

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
  const lowBalanceWorkers = workersWithBalance.filter(
    w => w.balance < w.low_balance_threshold
  )

  // Sort: low-balance employees first
  const sorted = [...workersWithBalance].sort((a, b) => {
    const aLow = a.balance < a.low_balance_threshold
    const bLow = b.balance < b.low_balance_threshold
    if (aLow && !bLow) return -1
    if (!aLow && bLow) return 1
    return 0
  })
  const charts: ChartSection[] = []
  if (settings.dashboard_show_category_spend) {
    charts.push({
      key: 'category',
      order: settings.dashboard_chart_order === 'category_first' ? 0 : 1,
      node: (
        <CategorySpendPieChart
          title="Overall Category Spend"
          description="All employee debit expenses grouped by category."
          categorySpend={dashboardAnalytics.categorySpend}
          emptyMessage="No employee expenses to chart yet."
          filterKind="category"
        />
      ),
    })
  }
  if (settings.dashboard_show_employee_spend) {
    charts.push({
      key: 'employee',
      order: settings.dashboard_chart_order === 'employee_first' ? 0 : 1,
      node: (
        <CategorySpendPieChart
          title="Employee Wise Spend"
          description="Debit expenses grouped by employee."
          categorySpend={employeeSpend}
          emptyMessage="No employee expenses to chart yet."
          filterKind="employee"
        />
      ),
    })
  }
  charts.sort((a, b) => a.order - b.order)
  const hasVisibleDashboardSection = charts.length > 0 || settings.dashboard_show_employee_cards

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {lowBalanceCount > 0 && (
          <Link href="#low-balance-employees" className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 px-3 py-1.5 rounded-full border border-red-200 hover:bg-red-100">
            <span>⚠️ {lowBalanceCount} employee{lowBalanceCount > 1 ? 's' : ''} with low balance</span>
          </Link>
        )}
      </div>

      {charts.map(chart => (
        <div key={chart.key}>{chart.node}</div>
      ))}

      {settings.dashboard_show_employee_cards && lowBalanceWorkers.length > 0 && (
        <section id="low-balance-employees" className="scroll-mt-20 space-y-3">
          <div>
            <h2 className="font-semibold text-red-700">Low Balance Employees</h2>
            <p className="text-sm text-muted-foreground">These employees are below their alert threshold.</p>
          </div>
          {lowBalanceWorkers.map(worker => (
            <WorkerCard key={`low-${worker.id}`} worker={worker} />
          ))}
        </section>
      )}

      {!hasVisibleDashboardSection ? (
        <p className="text-muted-foreground">All dashboard sections are hidden. Enable sections from Settings.</p>
      ) : settings.dashboard_show_employee_cards && sorted.length === 0 ? (
        <p className="text-muted-foreground">No employees yet. Add employees from the Employees page.</p>
      ) : settings.dashboard_show_employee_cards ? (
        <section className="space-y-3">
          <h2 className="font-semibold">All Employees</h2>
          {sorted.map(worker => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </section>
      ) : null}
    </div>
  )
}
