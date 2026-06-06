import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ExpenseDetailView } from '@/components/expense-detail-view'
import type { ExpenseWithCategory } from '@/types'

export default async function EmployeeExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data } = await admin
    .from('expenses')
    .select('*, categories(name)')
    .eq('id', id)
    .eq('worker_id', user.id)
    .single()

  if (!data) notFound()

  return (
    <ExpenseDetailView
      expense={data as ExpenseWithCategory}
      backHref="/expenses"
      backLabel="Transactions"
    />
  )
}
