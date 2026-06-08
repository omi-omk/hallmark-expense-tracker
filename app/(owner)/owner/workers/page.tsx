'use client'

import { useEffect, useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Profile } from '@/types'
import { calculateEmployeeBalancesFromRows } from '@/lib/workers/balances'
import { createSubmitLock } from '@/lib/forms/submit-lock'

interface EmployeeBalanceReportRow {
  worker_id?: string | null
  type: 'credit' | 'debit'
  amount: number
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Profile[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [fetching, setFetching] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', email: '', password: '', low_balance_threshold: '500' })
  const [loading, setLoading] = useState(false)
  const createLock = useRef(createSubmitLock())

  async function fetchWorkers() {
    setFetching(true)
    const [workersRes, reportsRes] = await Promise.all([
      fetch('/api/workers'),
      fetch('/api/reports'),
    ])
    if (workersRes.ok) {
      const data = await workersRes.json()
      setWorkers(data)
    } else {
      toast.error('Failed to load employees')
    }
    if (reportsRes.ok) {
      const data = (await reportsRes.json()) as EmployeeBalanceReportRow[]
      setBalances(calculateEmployeeBalancesFromRows(data))
    }
    setFetching(false)
  }

  useEffect(() => {
    void Promise.resolve().then(fetchWorkers)
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createLock.current.acquire()) return
    setLoading(true)
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, low_balance_threshold: parseInt(form.low_balance_threshold) }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to create employee')
      } else {
        toast.success('Employee created successfully')
        setOpen(false)
        setForm({ name: '', title: '', email: '', password: '', low_balance_threshold: '500' })
        fetchWorkers()
      }
    } finally {
      createLock.current.release()
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={buttonVariants()}>+ Add Employee</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Ravi Kumar', required: true },
                { label: 'Title (optional)', key: 'title', type: 'text', placeholder: 'Site Supervisor', required: false },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'ravi@example.com', required: true },
                { label: 'Temporary Password', key: 'password', type: 'password', placeholder: 'min 8 characters', required: true },
                { label: 'Low Balance Threshold (₹)', key: 'low_balance_threshold', type: 'number', placeholder: '500', required: true },
              ].map(({ label, key, type, placeholder, required }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required={required}
                  />
                </div>
              ))}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Employee'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {fetching ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : workers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No employees yet.</p>
        ) : (
          workers.map(worker => (
            <Link key={worker.id} href={`/owner/workers/${worker.id}`}>
              <Card className="cursor-pointer hover:bg-gray-50">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{worker.name}</p>
                    {worker.title && <p className="text-sm text-muted-foreground">{worker.title}</p>}
                    <p className="truncate text-sm text-muted-foreground">{worker.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={(balances[worker.id] ?? 0) < worker.low_balance_threshold ? 'font-semibold text-red-600' : 'font-semibold'}>
                      ₹{(balances[worker.id] ?? 0).toLocaleString('en-IN')}
                    </p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs ${worker.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {worker.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
