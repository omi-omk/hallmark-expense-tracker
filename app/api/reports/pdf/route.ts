import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generatePDF } from '@/lib/export/pdf'
import type { ExpenseWithCategory } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return new NextResponse('Forbidden', { status: 403 })

  const { searchParams } = new URL(request.url)
  const worker_id = searchParams.get('worker_id')
  const category_id = searchParams.get('category_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('expenses')
    .select('*, categories(name)')
    .order('date', { ascending: false })

  if (worker_id) query = query.eq('worker_id', worker_id)
  if (category_id) query = query.eq('category_id', category_id)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data } = await query
  const title = [
    from && `From: ${from}`,
    to && `To: ${to}`,
  ].filter(Boolean).join('  |  ') || 'All time'

  const pdf = generatePDF((data ?? []) as ExpenseWithCategory[], title)

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  })
}
