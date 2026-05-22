import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  let query = admin
    .from('expenses')
    .select('*, categories(name), profiles(name)')
    .order('date', { ascending: false })

  if (worker_id) query = query.eq('worker_id', worker_id)
  if (category_id) query = query.eq('category_id', category_id)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
