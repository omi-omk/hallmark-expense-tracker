'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Users, BarChart3, Settings, LayoutDashboard, LogOut } from 'lucide-react'

const links = [
  { href: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/owner/workers', label: 'Employees', icon: Users },
  { href: '/owner/reports', label: 'Reports', icon: BarChart3 },
  { href: '/owner/settings', label: 'Settings', icon: Settings },
]

export function OwnerNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <nav className="fixed right-0 top-0 bottom-0 w-14 bg-white border-l border-gray-200 z-50 md:static md:w-56 md:min-h-screen md:border-l-0 md:border-r">
      <div className="flex h-full flex-col items-center justify-start gap-2 pt-4 md:items-start md:pt-8 md:px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm md:w-full md:justify-start md:gap-3 md:px-3 md:py-2 ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          aria-label="Logout"
          title="Logout"
          disabled={loggingOut}
          className="mt-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-gray-100 md:w-full md:justify-start md:gap-3 md:px-3 md:py-2"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </nav>
  )
}
