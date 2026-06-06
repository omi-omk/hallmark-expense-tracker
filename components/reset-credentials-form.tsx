'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ResetCredentialsForm({ workerId, currentName }: { workerId: string; currentName: string }) {
  const [name, setName] = useState(currentName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const hasChanges = name !== currentName || !!email || !!password

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!hasChanges) return
    setLoading(true)

    const body: Record<string, string> = {}
    if (name !== currentName) body.name = name
    if (email) body.email = email
    if (password) body.password = password

    try {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('Employee updated successfully')
        setEmail('')
        setPassword('')
        router.refresh()
      } else {
        toast.error('Failed to update employee')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Edit Employee</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Employee name" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">New Email (optional)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="new@email.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">New Password (optional)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 8 characters" minLength={8} />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={loading || !hasChanges}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
