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
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white md:static md:min-h-screen md:w-56 md:border-b-0 md:border-r">
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 md:h-full md:flex-col md:items-start md:justify-start md:overflow-visible md:px-3 md:pt-8">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs md:w-full md:justify-start md:text-sm ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          aria-label="Logout"
          title="Logout"
          disabled={loggingOut}
          className="ml-auto flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs text-muted-foreground hover:bg-gray-100 disabled:opacity-50 md:mt-auto md:mb-4 md:ml-0 md:w-full md:justify-start md:text-sm"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  )
}
