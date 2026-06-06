import { employeeExpenseDetailUrl, ownerExpenseDetailUrl } from '@/lib/transactions/urls'

describe('transaction detail urls', () => {
  it('builds employee expense detail urls', () => {
    expect(employeeExpenseDetailUrl('expense-123')).toBe('/expenses/expense-123')
  })

  it('builds owner expense detail urls', () => {
    expect(ownerExpenseDetailUrl('expense-123')).toBe('/owner/transactions/expenses/expense-123')
  })
})
