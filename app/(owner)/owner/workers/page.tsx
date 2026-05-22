'use client'

import { useEffect, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Profile } from '@/types'

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', low_balance_threshold: '500' })
  const [loading, setLoading] = useState(false)

  async function fetchWorkers() {
    const res = await fetch('/api/workers')
    const data = await res.json()
    setWorkers(data)
  }

  useEffect(() => { fetchWorkers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, low_balance_threshold: parseInt(form.low_balance_threshold) }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to create worker')
    } else {
      toast.success('Worker created successfully')
      setOpen(false)
      setForm({ name: '', email: '', password: '', low_balance_threshold: '500' })
      fetchWorkers()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={buttonVariants()}>+ Add Worker</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Worker</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Ravi Kumar' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'ravi@example.com' },
                { label: 'Temporary Password', key: 'password', type: 'password', placeholder: 'min 8 characters' },
                { label: 'Low Balance Threshold (₹)', key: 'low_balance_threshold', type: 'number', placeholder: '500' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Worker'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {workers.map(worker => (
          <Link key={worker.id} href={`/owner/workers/${worker.id}`}>
            <Card className="cursor-pointer hover:bg-gray-50">
              <CardContent className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{worker.name}</p>
                  <p className="text-sm text-muted-foreground">{worker.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${worker.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {worker.is_active ? 'Active' : 'Inactive'}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
        {workers.length === 0 && <p className="text-muted-foreground text-sm">No workers yet.</p>}
      </div>
    </div>
  )
}
