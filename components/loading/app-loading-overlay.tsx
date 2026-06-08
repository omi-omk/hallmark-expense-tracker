'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function AppLoadingOverlay() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function start() {
      setPendingCount(count => count + 1)
    }

    function stop() {
      setPendingCount(count => Math.max(0, count - 1))
    }

    window.addEventListener('app-loading:start', start)
    window.addEventListener('app-loading:stop', stop)

    return () => {
      window.removeEventListener('app-loading:start', start)
      window.removeEventListener('app-loading:stop', stop)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setPendingCount(0), 0)
    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    if (pendingCount <= 0) {
      const timer = window.setTimeout(() => setVisible(false), 0)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => setVisible(true), 180)
    return () => window.clearTimeout(timer)
  }, [pendingCount])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-4 z-[100] mx-auto flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-sm font-medium text-gray-800 shadow-lg backdrop-blur"
    >
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      Loading...
    </div>
  )
}
