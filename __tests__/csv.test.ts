import { generateCSV } from '@/lib/export/csv'
import type { ExpenseWithCategory } from '@/types'

const makeExpense = (overrides: Partial<ExpenseWithCategory> = {}): ExpenseWithCategory => ({
  id: '1',
  worker_id: 'w1',
  category_id: 'c1',
  amount: 500,
  date: '2026-05-22',
  comment: 'Lunch',
  image_url: null,
  created_at: '',
  categories: { name: 'Food' },
  ...overrides,
})

describe('generateCSV', () => {
  it('includes header row', () => {
    const csv = generateCSV([])
    expect(csv).toContain('Date')
    expect(csv).toContain('Category')
    expect(csv).toContain('Amount (Rs)')
    expect(csv).toContain('Comment')
  })

  it('generates a row for each expense', () => {
    const csv = generateCSV([makeExpense()])
    expect(csv).toContain('2026-05-22')
    expect(csv).toContain('Food')
    expect(csv).toContain('500')
    expect(csv).toContain('Lunch')
  })

  it('replaces null comment with empty string', () => {
    const csv = generateCSV([makeExpense({ comment: null })])
    expect(csv).not.toContain('null')
  })

  it('handles multiple rows', () => {
    const csv = generateCSV([
      makeExpense({ id: '1', amount: 100, date: '2026-05-01' }),
      makeExpense({ id: '2', amount: 200, date: '2026-05-02' }),
    ])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })
})
