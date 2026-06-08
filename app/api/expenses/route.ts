import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkAndNotifyLowBalance } from '@/lib/notifications'
import { calculateBalance, isLowBalance } from '@/lib/balance'
import { buildExpenseSnapshot } from '@/lib/expenses/activity-log'
import { z } from 'zod'

const schema = z.object({
  category_id: z.string().uuid(),
  amount: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comment: z.string().optional(),
  image_url: z.string().url().optional().nullable(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: expense, error } = await admin.from('expenses').insert({
    worker_id: user.id,
    ...parsed.data,
  }).select('*, categories(name)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('expense_activity_logs').insert({
    expense_id: expense.id,
    worker_id: user.id,
    actor_id: user.id,
    actor_role: 'worker',
    action: 'created',
    old_values: null,
    new_values: buildExpenseSnapshot(expense),
  })

  // Check balance and notify if low
  const [transfersRes, expensesRes, profileRes, settingsRes] = await Promise.all([
    admin.from('fund_transfers').select('amount').eq('worker_id', user.id),
    admin.from('expenses').select('amount').eq('worker_id', user.id),
    admin.from('profiles').select('name, low_balance_threshold').eq('id', user.id).single(),
    admin.from('settings').select('owner_alert_email').single(),
  ])

  const balance = calculateBalance(transfersRes.data ?? [], expensesRes.data ?? [])
  const threshold = profileRes.data?.low_balance_threshold ?? 500

  let low_balance_notified = false
  if (isLowBalance(balance, threshold) && settingsRes.data?.owner_alert_email) {
    await checkAndNotifyLowBalance(
      profileRes.data?.name ?? 'Employee',
      balance,
      threshold,
      settingsRes.data.owner_alert_email
    ).catch(() => {}) // email failure is non-blocking
    low_balance_notified = true
  }

  return NextResponse.json({ ...expense, low_balance_notified }, { status: 201 })
}
