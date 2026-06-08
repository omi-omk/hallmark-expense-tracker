import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateAdminSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = updateAdminSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: 'No admin changes provided' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', id).single()
  if (!target || target.role !== 'admin') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, email, password } = parsed.data
  if (name || email) {
    const { error } = await admin.from('profiles').update({
      ...(name && { name }),
      ...(email && { email }),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (email || password) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ...(email && { email }),
      ...(password && { password }),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (id === user.id) return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', id).single()
  if (!target || target.role !== 'admin') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
