'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export function ThresholdForm({ workerId, currentThreshold }: { workerId: string; currentThreshold: number }) {
  const [threshold, setThreshold] = useState(String(currentThreshold))
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
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
