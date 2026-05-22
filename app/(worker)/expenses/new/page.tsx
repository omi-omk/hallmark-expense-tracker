import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import type { Category } from '@/types'

export default async function NewExpensePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_global', true)
    .order('name')

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Add Expense</h2>
      <ExpenseForm categories={(categories ?? []) as Category[]} />
    </div>
  )
}
