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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <OwnerNav />
      <main className="w-full flex-1 p-4 md:max-w-5xl md:p-8">
        {children}
      </main>
    </div>
  )
}
