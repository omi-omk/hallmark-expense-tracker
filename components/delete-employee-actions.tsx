'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { buildDeleteEmployeePayload, type DeleteEmployeeMode } from '@/lib/workers/delete-actions'

interface DeleteEmployeeActionsProps {
  workerId: string
  workerName: string
  isActive: boolean
}

export function DeleteEmployeeActions({ workerId, workerName, isActive }: DeleteEmployeeActionsProps) {
  const router = useRouter()
  const [pendingMode, setPendingMode] = useState<DeleteEmployeeMode | null>(null)

  async function removeEmployee(mode: DeleteEmployeeMode) {
    if (pendingMode) return

    const confirmed =
      mode === 'soft'
        ? window.confirm(`Remove ${workerName}? Their login will be disabled, but history will stay available.`)
        : window.confirm(
            `Hard delete ${workerName}? This removes the employee account and linked data permanently. This cannot be undone.`
          )

    if (!confirmed) return

    setPendingMode(mode)
    try {
      const response = await fetch(`/api/workers/${workerId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDeleteEmployeePayload(mode)),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to remove employee')
      }

      toast.success(mode === 'soft' ? 'Employee removed' : 'Employee hard deleted')
      router.push('/owner/workers')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove employee')
    } finally {
      setPendingMode(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">Remove employee</p>
        <p className="text-xs text-muted-foreground">
          Soft remove disables login. Hard delete permanently removes the account.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isActive || pendingMode !== null}
          onClick={() => removeEmployee('soft')}
        >
          <UserX className="h-4 w-4" />
          {pendingMode === 'soft' ? 'Removing...' : isActive ? 'Soft Remove' : 'Removed'}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pendingMode !== null}
          onClick={() => removeEmployee('hard')}
        >
          <Trash2 className="h-4 w-4" />
          {pendingMode === 'hard' ? 'Deleting...' : 'Hard Delete'}
        </Button>
      </div>
    </div>
  )
}
