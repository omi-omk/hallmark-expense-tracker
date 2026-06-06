import { buildReportAnalytics } from '@/lib/reports/analytics'

describe('buildReportAnalytics', () => {
  it('groups only debit entries by category and ignores credits', () => {
    const analytics = buildReportAnalytics([
      { id: '1', type: 'debit', amount: 250, categories: { name: 'Food' } },
      { id: '2', type: 'debit', amount: 150, categories: { name: 'Travel' } },
      { id: '3', type: 'debit', amount: 50, categories: { name: 'Food' } },
      { id: '4', type: 'credit', amount: 1000, categories: { name: 'Funds' } },
    ])

    expect(analytics.totalCredits).toBe(1000)
    expect(analytics.totalDebits).toBe(450)
    expect(analytics.netMovement).toBe(550)
    expect(analytics.topCategory?.name).toBe('Food')
    expect(analytics.categorySpend).toEqual([
      { name: 'Food', amount: 300, percent: 100 },
      { name: 'Travel', amount: 150, percent: 50 },
    ])
  })

  it('uses Uncategorized for debit entries without a category', () => {
    const analytics = buildReportAnalytics([
      { id: '1', type: 'debit', amount: 75, categories: null },
    ])

    expect(analytics.categorySpend).toEqual([
      { name: 'Uncategorized', amount: 75, percent: 100 },
    ])
  })
})
