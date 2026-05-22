'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Users, BarChart3, Settings, LayoutDashboard, LogOut } from 'lucide-react'

const links = [
  { href: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/owner/workers', label: 'Workers', icon: Users },
  { href: '/owner/reports', label: 'Reports', icon: BarChart3 },
  { href: '/owner/settings', label: 'Settings', icon: Settings },
]

export function OwnerNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:static md:border-r md:border-t-0 md:w-56 md:min-h-screen">
      <div className="flex justify-around items-center h-16 md:flex-col md:items-start md:justify-start md:h-full md:pt-8 md:gap-1 md:px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-muted-foreground hover:bg-gray-100 md:mt-auto md:mb-4"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </nav>
  )
}
