'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export function ResetCredentialsForm({ workerId }: { workerId: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email && !password) return
    setLoading(true)

    const res = await fetch(`/api/workers/${workerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(email && { email }),
        ...(password && { password }),
      }),
    })

    if (res.ok) {
      toast.success('Credentials updated successfully')
      setEmail('')
      setPassword('')
    } else {
      toast.error('Failed to update credentials')
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Reset Credentials</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleReset} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">New Email (optional)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="new@email.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">New Password (optional)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 8 characters" minLength={8} />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={loading || (!email && !password)}>
            {loading ? 'Updating...' : 'Update'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
