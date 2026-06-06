import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OwnerNav } from '@/components/nav/owner-nav'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row-reverse md:flex-row">
      <OwnerNav />
      <main className="flex-1 p-4 pr-20 md:p-8 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
