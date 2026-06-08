import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface ExpenseReportRow {
  id: string
  worker_id: string
  category_id: string
  amount: number
  date: string
  comment: string | null
  image_url?: string | null
  created_at: string
  categories: { id?: string | null; name: string } | null
  profiles: { id?: string | null; name: string } | null
}

interface TransferReportRow {
  id: string
  worker_id: string
  amount: number
  note: string | null
  created_at: string
  profiles: { id?: string | null; name: string } | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const worker_id = searchParams.get('worker_id')
  const category_id = searchParams.get('category_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const admin = createAdminClient()

  let expenseQuery = admin
    .from('expenses')
    .select('*, categories(id, name), profiles(id, name)')
    .order('date', { ascending: false })
  if (worker_id) expenseQuery = expenseQuery.eq('worker_id', worker_id)
  if (category_id) expenseQuery = expenseQuery.eq('category_id', category_id)
  if (from) expenseQuery = expenseQuery.gte('date', from)
  if (to) expenseQuery = expenseQuery.lte('date', to)

  let transferQuery = admin
    .from('fund_transfers')
    .select('*, profiles(id, name)')
    .order('created_at', { ascending: false })
  if (worker_id) transferQuery = transferQuery.eq('worker_id', worker_id)
  if (from) transferQuery = transferQuery.gte('created_at', from)
  if (to) transferQuery = transferQuery.lte('created_at', to + 'T23:59:59')

  // Don't filter transfers by category
  if (category_id) {
    // if filtering by category, omit transfers (they have no category)
    const { data: expenses, error } = await expenseQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(((expenses ?? []) as ExpenseReportRow[]).map(e => ({ ...e, type: 'debit' })))
  }

  const [expensesRes, transfersRes] = await Promise.all([expenseQuery, transferQuery])
  if (expensesRes.error) return NextResponse.json({ error: expensesRes.error.message }, { status: 500 })
  if (transfersRes.error) return NextResponse.json({ error: transfersRes.error.message }, { status: 500 })

  const expenses = ((expensesRes.data ?? []) as ExpenseReportRow[]).map(e => ({
    ...e,
    type: 'debit',
    date: e.date,
  }))
  const transfers = ((transfersRes.data ?? []) as TransferReportRow[]).map(t => ({
    ...t,
    type: 'credit',
    date: t.created_at.split('T')[0],
    categories: { name: '—' },
    comment: t.note ?? null,
  }))

  const combined = [...expenses, ...transfers].sort((a, b) =>
    b.date.localeCompare(a.date)
  )

  return NextResponse.json(combined)
}
