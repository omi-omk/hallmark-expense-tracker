import { createClient, createAdminClient, isOwner } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'

const createWorkerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  low_balance_threshold: z.number().int().nonnegative().default(500),
})

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

  const { name, email, password, low_balance_threshold } = parsed.data

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    name,
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
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your Expense Tracker account is ready',
      html: `
        <p>Hi ${name},</p>
        <p>Your Expense Tracker account has been created. Here are your login details:</p>
        <p><strong>Email:</strong> ${email}<br/>
        <strong>Password:</strong> ${password}</p>
        <p>Please log in and change your password.</p>
      `,
    })
  } catch (_) {
    // Email failure is non-blocking — account already created successfully
  }

  return NextResponse.json({ id: authUser.user.id }, { status: 201 })
}
