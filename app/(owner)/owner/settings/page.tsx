'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import type { Category } from '@/types'
import { PushNotificationSettings } from '@/components/settings/push-notification-settings'

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [alertEmail, setAlertEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    } else {
      toast.error('Failed to load settings')
    }
  }

  useEffect(() => {
    void Promise.resolve().then(fetchData)
  }, [])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (addLoading) return
    if (!newCategory.trim()) return
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
      setAddLoading(false)
    }
  }

  async function deleteCategory(id: string) {
    if (deletingId) return
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
      setDeletingId(null)
    }
  }

  async function saveAlertEmail(e: React.FormEvent) {
    e.preventDefault()
    if (emailLoading) return
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
      setEmailLoading(false)
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

      <PushNotificationSettings />

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
              <div key={cat.id} className="flex items-center justify-between py-2">
                <span className="text-sm">{cat.name}</span>
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
