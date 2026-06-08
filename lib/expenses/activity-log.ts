export type ExpenseActivityAction = 'created' | 'edited' | 'deleted'

export interface ExpenseSnapshotSource {
  id: string
  worker_id: string
  category_id: string
  amount: number
  date: string
  comment?: string | null
  image_url?: string | null
  categories?: { name?: string | null } | null
}

export interface ExpenseSnapshot {
  id: string
  worker_id: string
  category_id: string
  category_name: string | null
  amount: number
  date: string
  comment: string | null
  image_url: string | null
}

export type ExpenseFieldDiff = Record<string, { from: string | number | null; to: string | number | null }>

const TRACKED_FIELDS: (keyof ExpenseSnapshot)[] = [
  'amount',
  'date',
  'category_id',
  'category_name',
  'comment',
  'image_url',
]

const FIELD_LABELS: Record<string, string> = {
  amount: 'amount',
  date: 'date',
  category_id: 'category',
  category_name: 'category name',
  comment: 'comment',
  image_url: 'receipt',
}

export function buildExpenseSnapshot(expense: ExpenseSnapshotSource): ExpenseSnapshot {
  return {
    id: expense.id,
    worker_id: expense.worker_id,
    category_id: expense.category_id,
    category_name: expense.categories?.name ?? null,
    amount: expense.amount,
    date: normalizeDate(expense.date),
    comment: normalizeOptionalText(expense.comment),
    image_url: normalizeOptionalText(expense.image_url),
  }
}

export function diffExpenseValues(
  beforeExpense: ExpenseSnapshotSource,
  afterExpense: ExpenseSnapshotSource
): ExpenseFieldDiff {
  const before = buildExpenseSnapshot(beforeExpense)
  const after = buildExpenseSnapshot(afterExpense)

  return TRACKED_FIELDS.reduce<ExpenseFieldDiff>((diff, field) => {
    if (before[field] !== after[field]) {
      diff[field] = { from: before[field], to: after[field] }
    }
    return diff
  }, {})
}

export function buildExpenseActivitySummary(
  action: ExpenseActivityAction,
  values: ExpenseSnapshot | ExpenseFieldDiff | null | undefined
): string {
  if (action === 'deleted') {
    const snapshot = values as ExpenseSnapshot | null | undefined
    const category = snapshot?.category_name ?? 'Uncategorized'
    const amount = snapshot?.amount ?? 0
    return `Deleted ${category} expense of ₹${amount.toLocaleString('en-IN')}`
  }

  if (action === 'created') return 'Created expense'

  const diff = values as ExpenseFieldDiff | null | undefined
  const fields = Object.keys(diff ?? {})
    .filter(field => field !== 'category_name')
    .map(field => FIELD_LABELS[field] ?? field)

  if (fields.length === 0) return 'Edited expense'
  if (fields.length === 1) return `Edited ${fields[0]}`
  return `Edited ${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`
}

function normalizeDate(date: string): string {
  return date.includes('T') ? date.split('T')[0] : date
}

function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
