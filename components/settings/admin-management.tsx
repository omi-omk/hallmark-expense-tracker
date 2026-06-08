'use client'

import { useEffect, useRef, useState } from 'react'
import { Save, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buttonVariants } from '@/components/ui/button'
import type { Profile } from '@/types'
import { buildAdminUpdatePayload, type AdminFormValues } from '@/lib/admins/payloads'
import { createSubmitLock } from '@/lib/forms/submit-lock'

interface AdminsResponse {
  admins: Profile[]
  current_user_id: string
}

const emptyAdminForm: AdminFormValues = { name: '', email: '', password: '' }

export function AdminManagement() {
  const [admins, setAdmins] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [edits, setEdits] = useState<Record<string, AdminFormValues>>({})
  const [newAdmin, setNewAdmin] = useState(emptyAdminForm)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const createLock = useRef(createSubmitLock())
  const saveLock = useRef(createSubmitLock())
  const deleteLock = useRef(createSubmitLock())

  async function fetchAdmins() {
    setLoading(true)
    const response = await fetch('/api/admins')
    if (!response.ok) {
      toast.error('Failed to load admins')
      setLoading(false)
      return
    }

    const data = (await response.json()) as AdminsResponse
    setAdmins(data.admins)
    setCurrentUserId(data.current_user_id)
    setEdits(Object.fromEntries(
      data.admins.map(admin => [admin.id, { name: admin.name, email: admin.email, password: '' }])
    ))
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(fetchAdmins)
  }, [])

  async function createAdmin(event: React.FormEvent) {
    event.preventDefault()
    if (!createLock.current.acquire()) return
    setCreating(true)
    try {
      const payload = buildAdminUpdatePayload(newAdmin)
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, password: newAdmin.password.trim() }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to create admin')
      }
      toast.success('Admin created')
      setOpen(false)
      setNewAdmin(emptyAdminForm)
      await fetchAdmins()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create admin')
    } finally {
      createLock.current.release()
      setCreating(false)
    }
  }

  async function saveAdmin(adminId: string) {
    if (!saveLock.current.acquire()) return
    setSavingId(adminId)
    try {
      const payload = buildAdminUpdatePayload(edits[adminId] ?? emptyAdminForm)
      const response = await fetch(`/api/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to save admin')
      }
      toast.success('Admin saved')
      await fetchAdmins()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save admin')
    } finally {
      saveLock.current.release()
      setSavingId(null)
    }
  }

  async function deleteAdmin(adminId: string, name: string) {
    if (!deleteLock.current.acquire()) return
    const confirmed = window.confirm(`Delete admin ${name}? This permanently removes their login.`)
    if (!confirmed) {
      deleteLock.current.release()
      return
    }

    setDeletingId(adminId)
    try {
      const response = await fetch(`/api/admins/${adminId}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to delete admin')
      }
      toast.success('Admin deleted')
      await fetchAdmins()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete admin')
    } finally {
      deleteLock.current.release()
      setDeletingId(null)
    }
  }

  function updateEdit(adminId: string, key: keyof AdminFormValues, value: string) {
    setEdits(current => ({
      ...current,
      [adminId]: { ...(current[adminId] ?? emptyAdminForm), [key]: value },
    }))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Admins</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={buttonVariants({ size: 'sm' })}>
            <UserPlus className="h-4 w-4" />
            Add Admin
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Admin</DialogTitle>
            </DialogHeader>
            <form onSubmit={createAdmin} className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={newAdmin.name} onChange={event => setNewAdmin(current => ({ ...current, name: event.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={newAdmin.email} onChange={event => setNewAdmin(current => ({ ...current, email: event.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input type="password" minLength={8} value={newAdmin.password} onChange={event => setNewAdmin(current => ({ ...current, password: event.target.value }))} required />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Create Admin'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading admins...</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admins yet.</p>
        ) : (
          admins.map(admin => {
            const edit = edits[admin.id] ?? { name: admin.name, email: admin.email, password: '' }
            const isSelf = admin.id === currentUserId
            return (
              <div key={admin.id} className="rounded-lg border p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value={edit.name} onChange={event => updateEdit(admin.id, 'name', event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={edit.email} onChange={event => updateEdit(admin.id, 'email', event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>New Password</Label>
                    <Input type="password" minLength={8} value={edit.password} onChange={event => updateEdit(admin.id, 'password', event.target.value)} placeholder="Leave blank" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={savingId === admin.id} onClick={() => saveAdmin(admin.id)}>
                      <Save className="h-4 w-4" />
                      {savingId === admin.id ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isSelf || deletingId === admin.id}
                      onClick={() => deleteAdmin(admin.id, admin.name)}
                      title={isSelf ? 'You cannot delete your own admin account' : 'Delete admin'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isSelf && <p className="mt-2 text-xs text-muted-foreground">Signed in as this admin.</p>}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
