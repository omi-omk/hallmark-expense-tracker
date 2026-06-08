import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  buildExpenseSnapshot,
  diffExpenseValues,
  type ExpenseSnapshotSource,
} from '@/lib/expenses/activity-log'

const editSchema = z.object({
  category_id: z.string().uuid().optional(),
  amount: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  comment: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'No expense changes provided',
})

interface ActorProfile {
  role: 'owner' | 'admin' | 'worker'
  name?: string | null
}

interface ExpenseRow extends ExpenseSnapshotSource {
  created_at: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { actor, expense, errorResponse } = await loadAuthorizedExpense(admin, user.id, id)
  if (errorResponse) return errorResponse
  if (!actor || !expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, string | number | null> = {}
  if (parsed.data.category_id !== undefined) updates.category_id = parsed.data.category_id
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount
  if (parsed.data.date !== undefined) updates.date = parsed.data.date
  if (parsed.data.comment !== undefined) updates.comment = parsed.data.comment?.trim() || null
  if (parsed.data.image_url !== undefined) updates.image_url = parsed.data.image_url?.trim() || null

  const { data: updatedExpense, error } = await admin
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select('*, categories(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const changes = diffExpenseValues(expense, updatedExpense as ExpenseRow)
  if (Object.keys(changes).length > 0) {
    const { error: logError } = await admin.from('expense_activity_logs').insert({
      expense_id: id,
      worker_id: expense.worker_id,
      actor_id: user.id,
      actor_role: actor.role,
      action: 'edited',
      old_values: changes,
      new_values: buildExpenseSnapshot(updatedExpense as ExpenseRow),
    })
    if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expense: updatedExpense })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { actor, expense, errorResponse } = await loadAuthorizedExpense(admin, user.id, id)
  if (errorResponse) return errorResponse
  if (!actor || !expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error: logError } = await admin.from('expense_activity_logs').insert({
    expense_id: id,
    worker_id: expense.worker_id,
    actor_id: user.id,
    actor_role: actor.role,
    action: 'deleted',
    old_values: buildExpenseSnapshot(expense),
    new_values: null,
  })
  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  const { error } = await admin.from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

async function loadAuthorizedExpense(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  expenseId: string
): Promise<{ actor: ActorProfile | null; expense: ExpenseRow | null; errorResponse: NextResponse | null }> {
  const [{ data: actor, error: actorError }, { data: expense, error: expenseError }] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', userId).single(),
    admin.from('expenses').select('*, categories(name)').eq('id', expenseId).single(),
  ])

  if (actorError || !actor) {
    return { actor: null, expense: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (expenseError || !expense) {
    return { actor: actor as ActorProfile, expense: null, errorResponse: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }

  const profile = actor as ActorProfile
  const row = expense as ExpenseRow
  const allowed = profile.role === 'owner' || profile.role === 'admin' || row.worker_id === userId
  if (!allowed) {
    return { actor: profile, expense: row, errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { actor: profile, expense: row, errorResponse: null }
}
