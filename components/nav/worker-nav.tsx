'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Receipt, PlusCircle, LogOut } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/expenses/new', label: 'Add', icon: PlusCircle },
  { href: '/expenses', label: 'History', icon: Receipt },
]

export function WorkerNav() {
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
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          aria-label="Logout"
          title="Logout"
          disabled={loggingOut}
          className="ml-auto flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs text-muted-foreground hover:bg-gray-100 disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  )
}
