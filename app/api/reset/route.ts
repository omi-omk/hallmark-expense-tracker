import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const resetSchema = z.object({
  confirmation: z.literal('RESET'),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Type RESET to confirm' }, { status: 400 })

  const admin = createAdminClient()
  const { data: workers, error: workersError } = await admin.from('profiles').select('id').eq('role', 'worker')
  if (workersError) return NextResponse.json({ error: workersError.message }, { status: 500 })

  const operations = [
    admin.from('expense_activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    admin.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    admin.from('fund_transfers').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    admin.from('push_subscriptions').delete().neq('endpoint', ''),
    admin.from('categories').delete().eq('is_system', false),
  ]

  for (const operation of operations) {
    const { error } = await operation
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const worker of workers ?? []) {
    const { error } = await admin.auth.admin.deleteUser(worker.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
