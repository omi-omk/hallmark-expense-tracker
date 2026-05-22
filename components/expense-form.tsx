'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types'

const schema = z.object({
  amount: z.number().int().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  category_id: z.string().uuid('Please select a category'),
  comment: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ExpenseFormProps {
  categories: Category[]
}

export function ExpenseForm({ categories }: ExpenseFormProps) {
  const [image, setImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: today },
  })

  async function uploadImage(file: File, expenseId: string): Promise<string | null> {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `receipts/${expenseId}.${ext}`
    const { error } = await supabase.storage.from('expense-images').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('expense-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function onSubmit(data: FormData) {
    setUploading(true)

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, image_url: null }),
    })

    if (!res.ok) {
      toast.error('Failed to save expense.')
      setUploading(false)
      return
    }

    const expense = await res.json()

    if (expense.low_balance_notified) {
      toast.warning('Your balance is low — your manager has been notified.')
    }

    if (image) {
      const image_url = await uploadImage(image, expense.id)
      if (image_url) {
        await fetch(`/api/expenses/${expense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url }),
        })
      } else {
        toast.error('Expense saved but image upload failed.')
      }
    }

    setUploading(false)
    toast.success('Expense added successfully')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label>Amount (₹)</Label>
        <Input type="number" min={1} placeholder="500" {...register('amount', { valueAsNumber: true })} />
        {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <Input type="date" max={today} {...register('date')} />
        {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          defaultValue=""
          onChange={e => setValue('category_id', e.target.value, { shouldValidate: true })}
        >
          <option value="" disabled>Select a category</option>
          {categories
            .sort((a, b) => a.name === 'Other' ? 1 : b.name === 'Other' ? -1 : a.name.localeCompare(b.name))
            .map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
        </select>
        {errors.category_id && <p className="text-xs text-red-500">{errors.category_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Comment (optional)</Label>
        <Input placeholder="What was this for?" {...register('comment')} />
      </div>

      <div className="space-y-2">
        <Label>Receipt Photo (optional)</Label>
        <Input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => setImage(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">Max 5 MB. Photo of bill or receipt.</p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || uploading}>
        {isSubmitting || uploading ? 'Saving...' : 'Add Expense'}
      </Button>
    </form>
  )
}
