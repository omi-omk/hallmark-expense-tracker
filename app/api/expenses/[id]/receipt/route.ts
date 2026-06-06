import { createAdminClient, createClient } from '@/lib/supabase/server'
import { receiptStoragePath, validateReceiptFile } from '@/lib/expenses/receipts'
import { NextResponse } from 'next/server'

const RECEIPT_BUCKET = 'expense-images'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: expense, error: expenseError } = await admin
    .from('expenses')
    .select('id, worker_id')
    .eq('id', id)
    .single()

  if (expenseError || !expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  if (expense.worker_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('receipt')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Receipt file is required' }, { status: 400 })

  const validationError = validateReceiptFile(file)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  await ensureReceiptBucket()

  const path = receiptStoragePath(id, file)
  const { error: uploadError } = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = admin.storage.from(RECEIPT_BUCKET).getPublicUrl(path)
  const image_url = data.publicUrl

  const { error: updateError } = await admin
    .from('expenses')
    .update({ image_url })
    .eq('id', id)
    .eq('worker_id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ image_url })
}

async function ensureReceiptBucket() {
  const admin = createAdminClient()
  const { data: bucket } = await admin.storage.getBucket(RECEIPT_BUCKET)
  if (bucket) return

  await admin.storage.createBucket(RECEIPT_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  })
}
