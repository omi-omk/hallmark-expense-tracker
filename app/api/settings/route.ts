import { createClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { owner_alert_email: '' })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = z.object({ owner_alert_email: z.string().email() }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  const { owner_alert_email } = parsed.data
  const { error } = await supabase.from('settings').update({ owner_alert_email }).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
