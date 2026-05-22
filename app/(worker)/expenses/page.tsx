import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseList } from '@/components/expense-list'
import type { Category, ExpenseWithCategory, FundTransfer } from '@/types'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [expensesRes, categoriesRes, transfersRes] = await Promise.all([
    admin.from('expenses').select('*, categories(name)').eq('worker_id', user.id).order('date', { ascending: false }),
    admin.from('categories').select('*').eq('is_global', true).order('name'),
    admin.from('fund_transfers').select('*').eq('worker_id', user.id).order('created_at', { ascending: false }),
  ])

  const expenses = (expensesRes.data ?? []) as ExpenseWithCategory[]
  const categories = (categoriesRes.data ?? []) as Category[]
  const transfers = (transfersRes.data ?? []) as FundTransfer[]

  const totalDebits = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalCredits = transfers.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Transactions</h2>
        <div className="text-right text-xs text-muted-foreground">
          <p className="text-green-600 font-medium">+₹{totalCredits.toLocaleString('en-IN')} credited</p>
          <p className="text-red-600 font-medium">-₹{totalDebits.toLocaleString('en-IN')} spent</p>
        </div>
      </div>
      <ExpenseList expenses={expenses} categories={categories} transfers={transfers} />
    </div>
  )
}
