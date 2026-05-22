import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  is_active: z.boolean().optional(),
  low_balance_threshold: z.number().int().nonnegative().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: target } = await admin.from('profiles').select('role').eq('id', id).single()
  if (!target || target.role !== 'worker') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { email, password, ...profileUpdates } = parsed.data

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin.from('profiles').update(profileUpdates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (email || password) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ...(email && { email }),
      ...(password && { password }),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (email) {
      await admin.from('profiles').update({ email }).eq('id', id)
    }
  }

  return NextResponse.json({ ok: true })
}
