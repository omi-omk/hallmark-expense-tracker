import { OwnerNav } from '@/components/nav/owner-nav'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row pb-16 md:pb-0">
      <OwnerNav />
      <main className="flex-1 p-4 md:p-8 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
