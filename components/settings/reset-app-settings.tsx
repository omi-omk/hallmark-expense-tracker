'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { canResetApp } from '@/lib/app-reset/confirmation'
import { createSubmitLock } from '@/lib/forms/submit-lock'
import { withAppLoading } from '@/lib/loading/app-loading-events'

export function ResetAppSettings() {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const resetLock = useRef(createSubmitLock())

  async function resetApp() {
    if (!canResetApp(confirmation)) {
      toast.error('Type RESET to confirm')
      return
    }
    if (!resetLock.current.acquire()) return
    if (!window.confirm('Reset Expense data? This clears employees, entries, transfers, custom categories, and push subscriptions.')) {
      resetLock.current.release()
      return
    }

    setBusy(true)
    try {
      await withAppLoading(async () => {
        const response = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error ?? 'Failed to reset app')
        toast.success('App reset complete')
        setConfirmation('')
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset app')
    } finally {
      resetLock.current.release()
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-base text-red-900">Reset App</h2>
        <p className="mt-1 text-sm text-red-800">
          Clears business data while keeping owner/admin accounts and the protected system category.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={confirmation}
          onChange={event => setConfirmation(event.target.value)}
          placeholder="Type RESET"
          className="bg-white"
        />
        <Button
          type="button"
          variant="destructive"
          disabled={busy || !canResetApp(confirmation)}
          onClick={resetApp}
        >
          {busy ? 'Resetting...' : 'Reset'}
        </Button>
      </div>
    </div>
  )
}
