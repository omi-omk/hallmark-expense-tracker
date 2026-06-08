'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Receipt, PlusCircle, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { startAppLoading, stopAppLoading } from '@/lib/loading/app-loading-events'

const links = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/expenses/new', label: 'Add', icon: PlusCircle },
  { href: '/expenses', label: 'History', icon: Receipt },
]

export function WorkerNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const currentLink = links.find(link => pathname === link.href) ?? links[0]

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    startAppLoading()
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
      setMenuOpen(false)
      router.push('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
      stopAppLoading()
    }
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Expense</p>
            <p className="truncate text-base font-semibold">{currentLink.label}</p>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="top-3 right-3 left-auto max-w-[18rem] translate-x-0 translate-y-0 gap-3 rounded-xl p-3">
          <DialogHeader>
            <DialogTitle>Navigation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    if (href !== pathname) startAppLoading()
                    setMenuOpen(false)
                  }}
                  className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                </Link>
              )
            })}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-2 flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-gray-100 disabled:opacity-50"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <nav className="sticky top-0 z-50 hidden border-b border-gray-200 bg-white md:block">
        <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              onClick={() => {
                if (href !== pathname) startAppLoading()
              }}
              className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
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
    </>
  )
}
