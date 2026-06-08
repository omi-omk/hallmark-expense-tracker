import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ExpenseDetailView } from '@/components/expense-detail-view'
import type { Category, ExpenseActivityLog, ExpenseWithCategory } from '@/types'

export default async function EmployeeExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [expenseRes, categoriesRes, activityRes] = await Promise.all([
    admin
      .from('expenses')
      .select('*, categories(id, name)')
      .eq('id', id)
      .eq('worker_id', user.id)
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

  return (
    <ExpenseDetailView
      expense={expenseRes.data as ExpenseWithCategory}
      backHref="/expenses"
      backLabel="Transactions"
      categories={(categoriesRes.data ?? []) as Category[]}
      canManage
      deleteRedirectHref="/expenses"
      activityLogs={(activityRes.data ?? []) as ExpenseActivityLog[]}
    />
  )
}
