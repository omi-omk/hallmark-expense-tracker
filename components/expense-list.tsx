'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { employeeExpenseDetailUrl } from '@/lib/transactions/urls'
import type { Category, ExpenseWithCategory, FundTransfer } from '@/types'

interface ExpenseListProps {
  expenses: ExpenseWithCategory[]
  categories: Category[]
  transfers?: FundTransfer[]
}

type CombinedEntry =
  | { kind: 'expense'; data: ExpenseWithCategory; date: string }
  | { kind: 'transfer'; data: FundTransfer; date: string }

export function ExpenseList({ expenses, categories, transfers = [] }: ExpenseListProps) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const filteredExpenses = expenses.filter(e => {
    if (categoryFilter !== 'all' && e.category_id !== categoryFilter) return false
    if (fromDate && e.date < fromDate) return false
    if (toDate && e.date > toDate) return false
    return true
  })

  const filteredTransfers = transfers.filter(t => {
    const date = t.created_at.split('T')[0]
    if (fromDate && date < fromDate) return false
    if (toDate && date > toDate) return false
    return true
  })

  const combined: CombinedEntry[] = [
    ...filteredExpenses.map(e => ({ kind: 'expense' as const, data: e, date: e.date })),
    ...filteredTransfers.map(t => ({ kind: 'transfer' as const, data: t, date: t.created_at.split('T')[0] })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select onValueChange={val => setCategoryFilter(val ?? 'all')} defaultValue="all">
          <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All transactions</SelectItem>
            <SelectItem value="__credits__">Credits only</SelectItem>
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

      {combined.length === 0 && (
        <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
      )}

      <div className="space-y-2">
        {combined
          .filter(entry => {
            if (categoryFilter === '__credits__') return entry.kind === 'transfer'
            if (categoryFilter !== 'all') return entry.kind === 'expense'
            return true
          })
          .map(entry => {
            if (entry.kind === 'transfer') {
              const t = entry.data
              return (
                <Card key={`t-${t.id}`} className="border-green-200 bg-green-50">
                  <CardContent className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-green-700">Funds Added</p>
                      <p className="text-xs text-muted-foreground">{entry.date}</p>
                      {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                    </div>
                    <p className="font-semibold text-green-700">+₹{t.amount.toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
              )
            }

            const e = entry.data
            return (
              <Link key={`e-${e.id}`} href={employeeExpenseDetailUrl(e.id)} className="block">
                <Card className="cursor-pointer hover:bg-gray-50">
                  <CardContent className="py-3 flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-sm">{e.categories.name}</p>
                        {e.image_url && <ImageIcon className="h-4 w-4 shrink-0 text-blue-600" aria-label="Receipt uploaded" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{e.date}</p>
                      {e.comment && <p className="truncate text-xs text-muted-foreground">{e.comment}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="font-semibold text-red-600">-₹{e.amount.toLocaleString('en-IN')}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
      </div>
    </div>
  )
}
