'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Category, ExpenseWithCategory } from '@/types'

interface ExpenseListProps {
  expenses: ExpenseWithCategory[]
  categories: Category[]
}

export function ExpenseList({ expenses, categories }: ExpenseListProps) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selected, setSelected] = useState<ExpenseWithCategory | null>(null)

  const filtered = expenses.filter(e => {
    if (categoryFilter !== 'all' && e.category_id !== categoryFilter) return false
    if (fromDate && e.date < fromDate) return false
    if (toDate && e.date > toDate) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select onValueChange={(value) => setCategoryFilter(value ?? 'all')} defaultValue="all">
          <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses match your filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(expense => (
            <Card key={expense.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(expense)}>
              <CardContent className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{expense.categories.name}</p>
                  <p className="text-xs text-muted-foreground">{expense.date}</p>
                  {expense.comment && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{expense.comment}</p>}
                </div>
                <p className="font-semibold">₹{expense.amount.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.categories.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div><span className="text-sm text-muted-foreground">Amount: </span><span className="font-semibold">₹{selected.amount.toLocaleString('en-IN')}</span></div>
              <div><span className="text-sm text-muted-foreground">Date: </span><span>{selected.date}</span></div>
              {selected.comment && <div><span className="text-sm text-muted-foreground">Comment: </span><span>{selected.comment}</span></div>}
              {selected.image_url && (
                <img src={selected.image_url} alt="Receipt" className="w-full rounded-lg max-h-64 object-contain" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
