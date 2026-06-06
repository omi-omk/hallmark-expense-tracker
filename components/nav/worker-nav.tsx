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
    <nav className="fixed right-0 top-0 bottom-0 w-14 bg-white border-l border-gray-200 z-50">
      <div className="flex h-full flex-col items-center justify-start gap-2 pt-4">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          aria-label="Logout"
          title="Logout"
          disabled={loggingOut}
          className="mt-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-xs text-muted-foreground hover:bg-gray-100"
        >
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Logout</span>
        </button>
      </div>
    </nav>
  )
}
