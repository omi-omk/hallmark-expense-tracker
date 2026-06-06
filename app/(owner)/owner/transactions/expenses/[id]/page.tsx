import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ExpenseDetailView } from '@/components/expense-detail-view'
import type { ExpenseWithCategory } from '@/types'

interface OwnerExpenseRow extends ExpenseWithCategory {
  profiles?: {
    name?: string | null
    email?: string | null
  } | null
}

export default async function OwnerExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data } = await admin
    .from('expenses')
    .select('*, categories(name), profiles(name, email)')
    .eq('id', id)
    .single()

  if (!data) notFound()

  const expense = data as OwnerExpenseRow

  return (
    <ExpenseDetailView
      expense={expense}
      employee={expense.profiles}
      backHref={`/owner/workers/${expense.worker_id}`}
      backLabel="Employee"
    />
  )
}
