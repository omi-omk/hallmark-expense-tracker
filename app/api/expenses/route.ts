import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkAndNotifyLowBalance } from '@/lib/notifications'
import { calculateBalance, isLowBalance } from '@/lib/balance'
import { z } from 'zod'

const schema = z.object({
  category_id: z.string().uuid(),
  amount: z.number().int().positive(),
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

  const { data: expense, error } = await supabase.from('expenses').insert({
    worker_id: user.id,
    ...parsed.data,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check balance and notify if low
  const [transfersRes, expensesRes, profileRes, settingsRes] = await Promise.all([
    admin.from('fund_transfers').select('amount').eq('worker_id', user.id),
    admin.from('expenses').select('amount').eq('worker_id', user.id),
    admin.from('profiles').select('name, low_balance_threshold').eq('id', user.id).single(),
    admin.from('settings').select('owner_alert_email').single(),
  ])

  const balance = calculateBalance(transfersRes.data ?? [], expensesRes.data ?? [])
  const threshold = profileRes.data?.low_balance_threshold ?? 500

  if (isLowBalance(balance, threshold) && settingsRes.data?.owner_alert_email) {
    await checkAndNotifyLowBalance(
      profileRes.data?.name ?? 'Worker',
      balance,
      threshold,
      settingsRes.data.owner_alert_email
    ).catch(() => {}) // email failure is non-blocking
  }

  return NextResponse.json(expense, { status: 201 })
}
