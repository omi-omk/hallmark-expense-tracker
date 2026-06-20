'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { Category } from '@/types'
import { PushNotificationSettings } from '@/components/settings/push-notification-settings'
import { AdminManagement } from '@/components/settings/admin-management'
import { ExpenseActivityLogCard } from '@/components/settings/expense-activity-log'
import { ResetAppSettings } from '@/components/settings/reset-app-settings'
import type { DashboardChartOrder } from '@/lib/dashboard/settings'
import { chartOrderLabel } from '@/lib/dashboard/chart-order-label'
import { createSubmitLock } from '@/lib/forms/submit-lock'
import { startAppLoading } from '@/lib/loading/app-loading-events'

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [alertEmail, setAlertEmail] = useState('')
  const [showCategorySpend, setShowCategorySpend] = useState(true)
  const [showEmployeeSpend, setShowEmployeeSpend] = useState(true)
  const [showEmployeeCards, setShowEmployeeCards] = useState(true)
  const [chartOrder, setChartOrder] = useState<DashboardChartOrder>('category_first')
  const [emailLoading, setEmailLoading] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const emailLock = useRef(createSubmitLock())
  const dashboardLock = useRef(createSubmitLock())
  const categoryLock = useRef(createSubmitLock())
  const deleteCategoryLock = useRef(createSubmitLock())

  async function fetchData() {
    const [catRes, settingsRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/settings'),
    ])
    if (catRes.ok) {
      setCategories(await catRes.json())
    } else {
      toast.error('Failed to load categories')
    }
    if (settingsRes.ok) {
      const s = await settingsRes.json()
      setAlertEmail(s.owner_alert_email ?? '')
      setShowCategorySpend(s.dashboard_show_category_spend ?? true)
      setShowEmployeeSpend(s.dashboard_show_employee_spend ?? true)
      setShowEmployeeCards(s.dashboard_show_employee_cards ?? true)
      setChartOrder(s.dashboard_chart_order === 'employee_first' ? 'employee_first' : 'category_first')
    } else {
      toast.error('Failed to load settings')
    }
  }

  useEffect(() => {
    void Promise.resolve().then(fetchData)
  }, [])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryLock.current.acquire()) return
    if (!newCategory.trim()) {
      categoryLock.current.release()
      return
    }
    setAddLoading(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory.trim() }),
      })
      if (res.ok) {
        setNewCategory('')
        fetchData()
        toast.success('Category added')
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to add category')
      }
    } finally {
      categoryLock.current.release()
      setAddLoading(false)
    }
  }

  async function deleteCategory(id: string) {
    if (!deleteCategoryLock.current.acquire()) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        fetchData()
        toast.success('Category deleted')
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Cannot delete category')
      }
    } finally {
      deleteCategoryLock.current.release()
      setDeletingId(null)
    }
  }

  async function saveAlertEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!emailLock.current.acquire()) return
    setEmailLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_alert_email: alertEmail }),
      })
      if (res.ok) {
        toast.success('Alert email saved')
      } else {
        toast.error('Failed to save email')
      }
    } finally {
      emailLock.current.release()
      setEmailLoading(false)
    }
  }

  async function saveDashboardSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!dashboardLock.current.acquire()) return
    setDashboardLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_show_category_spend: showCategorySpend,
          dashboard_show_employee_spend: showEmployeeSpend,
          dashboard_show_employee_cards: showEmployeeCards,
          dashboard_chart_order: chartOrder,
        }),
      })
      if (res.ok) {
        toast.success('Dashboard settings saved')
      } else {
        toast.error('Failed to save dashboard settings')
      }
    } finally {
      dashboardLock.current.release()
      setDashboardLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Low Balance Alert Email</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveAlertEmail} className="flex gap-2">
            <Input
              type="email"
              value={alertEmail}
              onChange={e => setAlertEmail(e.target.value)}
              placeholder="owner@company.com"
              required
            />
            <Button type="submit" disabled={emailLoading}>
              {emailLoading ? 'Saving...' : 'Save'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            Alerts are sent to this email when an employee&apos;s balance drops below their threshold.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dashboard</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveDashboardSettings} className="space-y-4">
            <div className="grid gap-3">
              {[
                {
                  id: 'category-spend',
                  label: 'Show category spend chart',
                  checked: showCategorySpend,
                  onChange: setShowCategorySpend,
                },
                {
                  id: 'employee-spend',
                  label: 'Show employee-wise spend chart',
                  checked: showEmployeeSpend,
                  onChange: setShowEmployeeSpend,
                },
                {
                  id: 'employee-cards',
                  label: 'Show employee cards',
                  checked: showEmployeeCards,
                  onChange: setShowEmployeeCards,
                },
              ].map(option => (
                <label key={option.id} htmlFor={option.id} className="flex items-center gap-3 text-sm">
                  <input
                    id={option.id}
                    type="checkbox"
                    checked={option.checked}
                    onChange={e => option.onChange(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Chart Order</Label>
              <Select
                value={chartOrder}
                onValueChange={value => setChartOrder(value === 'employee_first' ? 'employee_first' : 'category_first')}
              >
                <SelectTrigger>
                  <span data-slot="select-value" className="flex min-w-0 flex-1 truncate text-left">
                    {chartOrderLabel(chartOrder)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category_first">Category chart first</SelectItem>
                  <SelectItem value="employee_first">Employee chart first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={dashboardLoading}>
              {dashboardLoading ? 'Saving...' : 'Save Dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PushNotificationSettings />

      <ResetAppSettings />

      <AdminManagement />

      <ExpenseActivityLogCard />

      <Card>
        <CardHeader><CardTitle>Global Categories</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addCategory} className="flex gap-2">
            <Input
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="New category name (e.g. Fuel)"
            />
            <Button type="submit" disabled={addLoading}>
              {addLoading ? 'Adding...' : 'Add'}
            </Button>
          </form>

          <div className="divide-y">
            {categories.map(cat => (
              <div key={cat.id} className="relative flex items-center justify-between py-2">
                <Link
                  href={`/owner/categories/${cat.id}`}
                  onClick={startAppLoading}
                  className="absolute inset-0 z-0"
                  aria-label={`Open ${cat.name}`}
                />
                <span className="relative z-10 text-sm">{cat.name}</span>
                <div className="relative z-10">
                  {cat.is_system ? (
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-gray-100 rounded">Protected</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCategory(cat.id)}
                      disabled={deletingId === cat.id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No categories yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
