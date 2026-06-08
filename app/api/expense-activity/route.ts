import { createAdminClient, createClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ExpenseActivityLog, Profile } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: logs, error } = await admin
    .from('expense_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (logs ?? []) as ExpenseActivityLog[]
  const profileIds = [...new Set(rows.flatMap(row => [row.actor_id, row.worker_id]).filter(Boolean) as string[])]
  const { data: profiles } = profileIds.length > 0
    ? await admin.from('profiles').select('id, name, email, role').in('id', profileIds)
    : { data: [] }

  const profileMap = new Map((profiles as Pick<Profile, 'id' | 'name' | 'email' | 'role'>[] ?? []).map(profile => [profile.id, profile]))

  return NextResponse.json({
    logs: rows.map(row => ({
      ...row,
      actor: row.actor_id ? profileMap.get(row.actor_id) ?? null : null,
      employee: profileMap.get(row.worker_id) ?? null,
    })),
  })
}
