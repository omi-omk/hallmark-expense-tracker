import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendBrevoEmail } from '@/lib/email/brevo'

const createWorkerSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  low_balance_threshold: z.number().int().nonnegative().default(500),
})

const EXPENSE_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://expense.hallmarkinteriorsolutions.in/'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('role', 'worker')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = createWorkerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, title, email, password, low_balance_threshold } = parsed.data
  const profileTitle = title?.trim() || null

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    name,
    title: profileTitle,
    email,
    role: 'worker',
    low_balance_threshold,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {})
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Send welcome email with credentials
  try {
    await sendBrevoEmail({
      to: email,
      subject: 'Your Expense Tracker account is ready',
      html: `
        <p>Hi ${name},</p>
        <p>Your employee Expense Tracker account has been created. Here are your login details:</p>
        <p><strong>Email:</strong> ${email}<br/>
        <strong>Password:</strong> ${password}</p>
        <p><strong>App link:</strong> <a href="${EXPENSE_APP_URL}">${EXPENSE_APP_URL}</a></p>
        <p>Please log in and change your password.</p>
      `,
    })
  } catch {
    // Email failure is non-blocking — account already created successfully
  }

  return NextResponse.json({ id: authUser.user.id }, { status: 201 })
}
