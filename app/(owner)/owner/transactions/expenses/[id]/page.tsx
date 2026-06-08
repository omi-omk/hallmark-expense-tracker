import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ExpenseDetailView } from '@/components/expense-detail-view'
import type { Category, ExpenseActivityLog, ExpenseWithCategory } from '@/types'

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
  const [expenseRes, categoriesRes, activityRes] = await Promise.all([
    admin
      .from('expenses')
      .select('*, categories(id, name), profiles(name, email)')
      .eq('id', id)
      .single(),
    admin
      .from('categories')
      .select('*')
      .eq('is_global', true)
      .order('name'),
    admin
      .from('expense_activity_logs')
      .select('*')
      .eq('expense_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!expenseRes.data) notFound()

  const expense = expenseRes.data as OwnerExpenseRow

  return (
    <ExpenseDetailView
      expense={expense}
      employee={expense.profiles}
      backHref={`/owner/workers/${expense.worker_id}`}
      backLabel="Employee"
      categories={(categoriesRes.data ?? []) as Category[]}
      canManage
      deleteRedirectHref={`/owner/workers/${expense.worker_id}`}
      activityLogs={(activityRes.data ?? []) as ExpenseActivityLog[]}
    />
  )
}
