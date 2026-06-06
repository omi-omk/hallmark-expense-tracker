import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
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
      .select('id, amount, categories(name), profiles(name)'),
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
      categories: { name?: string | null } | null
      profiles: { name?: string | null } | null
    }[]
  ).map((expense): ReportEntry => ({
    id: expense.id,
    type: 'debit',
    amount: expense.amount,
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
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
            <span>⚠️ {lowBalanceCount} employee{lowBalanceCount > 1 ? 's' : ''} with low balance</span>
          </div>
        )}
      </div>

      {charts.map(chart => (
        <div key={chart.key}>{chart.node}</div>
      ))}

      {!hasVisibleDashboardSection ? (
        <p className="text-muted-foreground">All dashboard sections are hidden. Enable sections from Settings.</p>
      ) : settings.dashboard_show_employee_cards && sorted.length === 0 ? (
        <p className="text-muted-foreground">No employees yet. Add employees from the Employees page.</p>
      ) : settings.dashboard_show_employee_cards ? (
        <div className="space-y-3">
          {sorted.map(worker => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
