'use client'

import { useEffect, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import type { Category, Profile } from '@/types'

export default function ReportsPage() {
  const [workers, setWorkers] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [filters, setFilters] = useState({ worker_id: '', category_id: '', from: '', to: '' })
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  useEffect(() => {
    fetch('/api/workers').then(r => r.ok ? r.json() : []).then(setWorkers)
    fetch('/api/categories').then(r => r.ok ? r.json() : []).then(setCategories)
  }, [])

  async function runReport() {
    setLoading(true)
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v) as [string, string][]
      )
      const res = await fetch(`/api/reports?${params}`)
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
      setLoading(false)
    }
  }

  function updateFilter(key: string, value: string) {
    setFilters(f => ({ ...f, [key]: value }))
    setExpenses([])
    setHasRun(false)
  }

  function exportUrl(format: 'csv' | 'pdf') {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v) as [string, string][]
    )
    return `/api/reports/${format}?${params}`
  }

  const totalCredits = expenses.filter((e: any) => e.type === 'credit').reduce((s: number, e: any) => s + e.amount, 0)
  const totalDebits = expenses.filter((e: any) => e.type === 'debit').reduce((s: number, e: any) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Worker</Label>
              <Select onValueChange={(v: string | null) => updateFilter('worker_id', v && v !== 'all' ? v : '')}>
                <SelectTrigger><SelectValue placeholder="All workers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workers</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select onValueChange={(v: string | null) => updateFilter('category_id', v && v !== 'all' ? v : '')}>
                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" onChange={e => updateFilter('from', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" onChange={e => updateFilter('to', e.target.value)} />
            </div>
          </div>
          <Button onClick={runReport} disabled={loading} className="w-full">
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
              <span className="text-green-600">+₹{totalCredits.toLocaleString('en-IN')} credited</span>{' · '}
              <span className="text-red-600">-₹{totalDebits.toLocaleString('en-IN')} spent</span>
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

          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b text-left">
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Worker</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Comment</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e: any) => (
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
