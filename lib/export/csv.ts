import Papa from 'papaparse'
import type { ExpenseWithCategory } from '@/types'

export function generateCSV(expenses: ExpenseWithCategory[]): string {
  const rows = expenses.map(e => ({
    Date: e.date,
    Category: e.categories.name,
    'Amount (Rs)': e.amount,
    Comment: e.comment ?? '',
  }))
  return Papa.unparse({
    fields: ['Date', 'Category', 'Amount (Rs)', 'Comment'],
    data: rows,
  })
}
