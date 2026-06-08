'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit3, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createSubmitLock } from '@/lib/forms/submit-lock'
import type { Category, ExpenseWithCategory } from '@/types'

interface ExpenseActionsProps {
  expense: ExpenseWithCategory
  categories: Category[]
  deleteRedirectHref: string
}

export function ExpenseActions({ expense, categories, deleteRedirectHref }: ExpenseActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(expense.amount))
  const [date, setDate] = useState(expense.date)
  const [categoryId, setCategoryId] = useState(expense.category_id)
  const [comment, setComment] = useState(expense.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const saveLock = useRef(createSubmitLock())
  const deleteLock = useRef(createSubmitLock())
  const availableCategories = [...categories]
  if (!availableCategories.some(category => category.id === expense.category_id)) {
    availableCategories.push({
      id: expense.category_id,
      name: expense.categories.name,
      is_global: true,
      is_system: false,
      created_by: null,
      created_at: expense.created_at,
    })
  }
  availableCategories.sort((a, b) => a.name === 'Other' ? 1 : b.name === 'Other' ? -1 : a.name.localeCompare(b.name))

  async function saveExpense(event: React.FormEvent) {
    event.preventDefault()
    if (!saveLock.current.acquire()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          date,
          category_id: categoryId,
          comment,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error ?? 'Failed to update entry')
        return
      }
      toast.success('Entry updated')
      setOpen(false)
      router.refresh()
    } finally {
      saveLock.current.release()
      setSaving(false)
    }
  }

  async function deleteExpense() {
    if (!window.confirm('Delete this expense entry? This will update reports and balance.')) return
    if (!deleteLock.current.acquire()) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error ?? 'Failed to delete entry')
        return
      }
      toast.success('Entry deleted')
      router.push(deleteRedirectHref)
      router.refresh()
    } finally {
      deleteLock.current.release()
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={deleting}>
          <Edit3 className="h-4 w-4" />
          Edit
        </Button>
        <Button type="button" variant="destructive" onClick={deleteExpense} disabled={deleting || saving}>
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveExpense} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" min={1} value={amount} onChange={event => setAmount(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={event => setDate(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={categoryId}
                onChange={event => setCategoryId(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                {availableCategories
                  .map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Input value={comment} onChange={event => setComment(event.target.value)} placeholder="What was this for?" />
            </div>
            <Button type="submit" className="w-full" disabled={saving || deleting}>
              {saving ? 'Saving...' : 'Save Entry'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
