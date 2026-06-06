const OFFLINE_URL = '/offline.html'
const CACHE_NAME = 'hallmark-expense-offline-v1'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_URL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)))
})

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  const employeeName = data.employeeName ?? 'Employee'
  const balance = data.balance ?? 0
  const threshold = data.threshold ?? 0

  event.waitUntil(
    self.registration.showNotification('Low Balance Alert', {
      body: `${employeeName}'s balance is ₹${balance}, below the ₹${threshold} threshold.`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `low-balance-${data.employeeId ?? 'employee'}`,
      renotify: true,
      data: { url: '/owner/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/owner/dashboard'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      })
  )
})
