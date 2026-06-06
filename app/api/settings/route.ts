import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeDashboardSettings } from '@/lib/dashboard/settings'

const settingsSchema = z.object({
  owner_alert_email: z.string().email().optional(),
  dashboard_show_category_spend: z.boolean().optional(),
  dashboard_show_employee_spend: z.boolean().optional(),
  dashboard_show_employee_cards: z.boolean().optional(),
  dashboard_chart_order: z.enum(['category_first', 'employee_first']).optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('settings').select('*').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(normalizeDashboardSettings(data))
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: 'No settings provided' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('settings').update(parsed.data).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
