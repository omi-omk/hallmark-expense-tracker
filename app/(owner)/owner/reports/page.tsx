'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { CategorySpendPieChart } from '@/components/category-spend-pie-chart'
import { toast } from 'sonner'
import { buildEmployeeSpend, buildReportAnalytics, type ReportEntry } from '@/lib/reports/analytics'
import { withAppLoading } from '@/lib/loading/app-loading-events'
import type { Category, Profile } from '@/types'

interface ReportRow extends ReportEntry {
  worker_id?: string
  category_id?: string
  date?: string
  comment?: string
  note?: string
  profiles?: { id?: string | null; name?: string | null } | null
  categories?: { id?: string | null; name?: string | null } | null
}

export default function ReportsPage() {
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const [workers, setWorkers] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<ReportRow[]>([])
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams))
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    fetch('/api/workers').then(r => r.ok ? r.json() : []).then(setWorkers)
    fetch('/api/categories').then(r => r.ok ? r.json() : []).then(setCategories)
  }, [])

  const runReport = useCallback(async (reportFilters: ReportFilters) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const params = paramsFromFilters(reportFilters)
      const res = await withAppLoading(() => fetch(`/api/reports?${params}`))
      if (res.ok) {
        const data = await res.json()
        setExpenses(data)
        setHasRun(true)
      } else {
        toast.error('Failed to load report')
      }
    } catch {
      toast.error('Failed to load report')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const nextFilters = filtersFromSearchKey(searchKey)
    const hasUrlFilters = Object.values(nextFilters).some(Boolean)
    const timer = window.setTimeout(() => {
      setFilters(nextFilters)
      setExpenses([])
      setHasRun(false)
      if (hasUrlFilters) {
        void runReport(nextFilters)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [searchKey, runReport])

  function updateFilter(key: string, value: string) {
    setFilters(f => ({ ...f, [key]: value }))
    setExpenses([])
    setHasRun(false)
  }

  function exportUrl(format: 'csv' | 'pdf') {
    const params = paramsFromFilters(filters)
    return `/api/reports/${format}?${params}`
  }

  const analytics = buildReportAnalytics(expenses)
  const employeeSpend = buildEmployeeSpend(expenses)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Employee</Label>
              <Select value={filters.worker_id || 'all'} onValueChange={(v: string | null) => updateFilter('worker_id', v && v !== 'all' ? v : '')}>
                <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={filters.category_id || 'all'} onValueChange={(v: string | null) => updateFilter('category_id', v && v !== 'all' ? v : '')}>
                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={filters.from} onChange={e => updateFilter('from', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={filters.to} onChange={e => updateFilter('to', e.target.value)} />
            </div>
          </div>
          <Button onClick={() => runReport(filters)} disabled={loading} className="w-full">
            {loading ? 'Loading...' : 'Run Report'}
          </Button>
        </CardContent>
      </Card>

      {hasRun && expenses.length === 0 && (
        <p className="text-sm text-muted-foreground">No entries match the selected filters.</p>
      )}

      {expenses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium">
              {expenses.length} entries ·{' '}
              <span className="text-green-600">+₹{analytics.totalCredits.toLocaleString('en-IN')} credited</span>{' · '}
              <span className="text-red-600">-₹{analytics.totalDebits.toLocaleString('en-IN')} spent</span>
            </p>
            <div className="flex gap-2">
              <a href={exportUrl('csv')} download className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Export CSV
              </a>
              <a href={exportUrl('pdf')} download className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Export PDF
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Credited</p>
                <p className="mt-1 text-xl font-semibold text-green-600">₹{analytics.totalCredits.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="mt-1 text-xl font-semibold text-red-600">₹{analytics.totalDebits.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Net Movement</p>
                <p className={analytics.netMovement >= 0 ? 'mt-1 text-xl font-semibold text-green-600' : 'mt-1 text-xl font-semibold text-red-600'}>
                  {analytics.netMovement >= 0 ? '+' : '-'}₹{Math.abs(analytics.netMovement).toLocaleString('en-IN')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Top Category</p>
                <p className="mt-1 truncate text-xl font-semibold">{analytics.topCategory?.name ?? '—'}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CategorySpendPieChart
              title="Category Spend"
              description="Debit entries only. Credits are excluded from this chart."
              categorySpend={analytics.categorySpend}
              emptyMessage="No category spend to chart for these filters."
              filterKind="category"
            />
            <CategorySpendPieChart
              title="Employee Wise Spend"
              description="Debit entries grouped by employee."
              categorySpend={employeeSpend}
              emptyMessage="No employee spend to chart for these filters."
              filterKind="employee"
            />
          </div>

          <div className="space-y-3 md:hidden">
            {expenses.map(e => (
              <Card key={e.id}>
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.profiles?.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{e.date}</p>
                    </div>
                    <span className={e.type === 'credit' ? 'shrink-0 text-sm font-medium text-green-600' : 'shrink-0 text-sm font-medium text-red-600'}>
                      {e.type === 'credit' ? 'Credit' : 'Debit'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Category</span>
                      <span className="min-w-0 truncate text-right">{e.categories?.name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Amount</span>
                      <span className={e.type === 'credit' ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                        {e.type === 'credit' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  {(e.comment || e.note) && (
                    <p className="break-words text-sm text-muted-foreground">{e.comment ?? e.note}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b text-left">
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Employee</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Comment</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <span className={e.type === 'credit' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {e.type === 'credit' ? 'Credit' : 'Debit'}
                      </span>
                    </td>
                    <td className="py-2 px-3">{e.profiles?.name ?? '—'}</td>
                    <td className="py-2 px-3">{e.date}</td>
                    <td className="py-2 px-3">{e.categories?.name ?? '—'}</td>
                    <td className="py-2 px-3">
                      <span className={e.type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                        {e.type === 'credit' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{e.comment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

type ReportFilters = {
  worker_id: string
  category_id: string
  from: string
  to: string
}

function filtersFromSearchParams(searchParams: URLSearchParams): ReportFilters {
  return {
    worker_id: searchParams.get('worker_id') ?? '',
    category_id: searchParams.get('category_id') ?? '',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  }
}

function filtersFromSearchKey(searchKey: string): ReportFilters {
  return filtersFromSearchParams(new URLSearchParams(searchKey))
}

function paramsFromFilters(filters: ReportFilters) {
  return new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  )
}
