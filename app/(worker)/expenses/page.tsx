import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseList } from '@/components/expense-list'
import type { Category, ExpenseWithCategory } from '@/types'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [expensesRes, categoriesRes] = await Promise.all([
    admin
      .from('expenses')
      .select('*, categories(name)')
      .eq('worker_id', user.id)
      .order('date', { ascending: false }),
    admin.from('categories').select('*').eq('is_global', true).order('name'),
  ])

  const expenses = (expensesRes.data ?? []) as ExpenseWithCategory[]
  const categories = (categoriesRes.data ?? []) as Category[]

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Expense History</h2>
        <p className="text-sm text-muted-foreground">Total: ₹{total.toLocaleString('en-IN')}</p>
      </div>
      <ExpenseList expenses={expenses} categories={categories} />
    </div>
  )
}
