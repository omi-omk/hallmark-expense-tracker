import {
  buildExpenseActivitySummary,
  buildExpenseSnapshot,
  diffExpenseValues,
} from '@/lib/expenses/activity-log'

describe('expense activity logging helpers', () => {
  const baseExpense = {
    id: 'expense-1',
    worker_id: 'worker-1',
    category_id: 'category-1',
    amount: 500,
    date: '2026-06-09',
    comment: 'Fuel',
    image_url: 'https://example.com/receipt.jpg',
    created_at: '2026-06-09T08:00:00.000Z',
    categories: { name: 'Fuel' },
  }

  it('builds a stable snapshot for audit rows', () => {
    expect(buildExpenseSnapshot(baseExpense)).toEqual({
      id: 'expense-1',
      worker_id: 'worker-1',
      category_id: 'category-1',
      category_name: 'Fuel',
      amount: 500,
      date: '2026-06-09',
      comment: 'Fuel',
      image_url: 'https://example.com/receipt.jpg',
    })
  })

  it('returns only fields that changed between two expense snapshots', () => {
    const nextExpense = {
      ...baseExpense,
      amount: 650,
      comment: 'Fuel and parking',
      categories: { name: 'Travel' },
      category_id: 'category-2',
    }

    expect(diffExpenseValues(baseExpense, nextExpense)).toEqual({
      amount: { from: 500, to: 650 },
      category_id: { from: 'category-1', to: 'category-2' },
      category_name: { from: 'Fuel', to: 'Travel' },
      comment: { from: 'Fuel', to: 'Fuel and parking' },
    })
  })

  it('summarizes edits and deletes for the admin activity list', () => {
    expect(buildExpenseActivitySummary('edited', {
      amount: { from: 500, to: 650 },
      date: { from: '2026-06-09', to: '2026-06-10' },
    })).toBe('Edited amount and date')

    expect(buildExpenseActivitySummary('deleted', buildExpenseSnapshot(baseExpense))).toBe('Deleted Fuel expense of ₹500')
  })
})
