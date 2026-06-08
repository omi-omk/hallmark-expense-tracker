'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { createSubmitLock } from '@/lib/forms/submit-lock'

export function ThresholdForm({ workerId, currentThreshold }: { workerId: string; currentThreshold: number }) {
  const [threshold, setThreshold] = useState(String(currentThreshold))
  const [loading, setLoading] = useState(false)
  const submitLock = useRef(createSubmitLock())
  const router = useRouter()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!submitLock.current.acquire()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ low_balance_threshold: parseInt(threshold) }),
      })
      if (res.ok) {
        toast.success('Threshold updated')
        router.refresh()
      } else {
        toast.error('Failed to update threshold')
      }
    } finally {
      submitLock.current.release()
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-2 mt-2">
      <span className="text-xs text-muted-foreground">Alert threshold: ₹</span>
      <Input
        type="number"
        min={0}
        value={threshold}
        onChange={e => setThreshold(e.target.value)}
        className="w-24 h-7 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={loading} className="h-7 text-xs">
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </form>
  )
}
