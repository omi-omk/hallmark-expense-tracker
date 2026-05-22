import { createClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  worker_id: z.string().uuid(),
  amount: z.number().int().positive(),
  note: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: targetWorker } = await supabase.from('profiles').select('role').eq('id', parsed.data.worker_id).single()
  if (!targetWorker || targetWorker.role !== 'worker') return NextResponse.json({ error: 'Invalid worker' }, { status: 400 })

  const { error } = await supabase.from('fund_transfers').insert(parsed.data)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
