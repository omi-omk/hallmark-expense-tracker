'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(character => character.charCodeAt(0)))
}

type PermissionState = NotificationPermission | 'unsupported' | 'loading'

export function PushNotificationSettings() {
  const [permission, setPermission] = useState<PermissionState>('loading')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.resolve().then(async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        setPermission('unsupported')
        return
      }

      setPermission(Notification.permission)
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setSubscribed(!!subscription)
    }).catch(() => setSubscribed(false))
  }, [])

  async function handleEnable() {
    if (busy) return
    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return

      const response = await fetch('/api/push/vapid-public-key')
      if (!response.ok) throw new Error('VAPID key unavailable')
      const { publicKey } = await response.json()

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })

      const subscribeResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!subscribeResponse.ok) throw new Error('Failed to save subscription')

      setSubscribed(true)
      toast.success('Push notifications enabled on this device')
    } catch {
      toast.error('Failed to enable push notifications')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    if (busy) return
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }

      setSubscribed(false)
      toast.success('Push notifications disabled')
    } catch {
      toast.error('Failed to disable push notifications')
    } finally {
      setBusy(false)
    }
  }

  if (permission === 'loading') return null

  return (
    <section className="rounded-lg border bg-white p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold text-base">Push Notifications</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Get notified on this device when an employee balance goes low.
          </p>
        </div>
      </div>

      {permission === 'unsupported' && (
        <p className="text-sm text-muted-foreground">Push notifications are not supported in this browser.</p>
      )}

      {permission === 'denied' && (
        <p className="text-sm text-red-600">
          Notifications are blocked. Enable them in your browser or device settings, then reload.
        </p>
      )}

      {permission !== 'unsupported' && permission !== 'denied' && (
        subscribed ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-green-700">Enabled on this device</span>
            <Button variant="outline" size="sm" onClick={handleDisable} disabled={busy}>
              {busy ? 'Disabling...' : 'Disable'}
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleEnable} disabled={busy}>
            {busy ? 'Enabling...' : 'Enable Push Notifications'}
          </Button>
        )
      )}

      <p className="text-xs text-muted-foreground">
        On iPhone, install the app from Safari with Share, Add to Home Screen before enabling notifications.
      </p>
    </section>
  )
}
