import { buildEmployeeSpend, buildPieSlices, buildReportAnalytics } from '@/lib/reports/analytics'

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

describe('buildPieSlices', () => {
  it('turns category spend into svg pie slices with hover labels', () => {
    const slices = buildPieSlices([
      { name: 'Food', amount: 300, percent: 100 },
      { name: 'Travel', amount: 100, percent: 33 },
    ])

    expect(slices).toHaveLength(2)
    expect(slices[0]).toEqual(
      expect.objectContaining({
        name: 'Food',
        amount: 300,
        percentage: 75,
        tooltip: 'Food: ₹300',
      })
    )
    expect(slices[0].path).toMatch(/^M 50 50 L /)
    expect(slices[1]).toEqual(
      expect.objectContaining({
        name: 'Travel',
        amount: 100,
        percentage: 25,
        tooltip: 'Travel: ₹100',
      })
    )
  })

  it('returns no slices when there is no category spend', () => {
    expect(buildPieSlices([])).toEqual([])
  })

  it('renders a full pie when all spend is in one category', () => {
    const slices = buildPieSlices([{ name: 'Fuel', amount: 500, percent: 100 }])

    expect(slices).toHaveLength(1)
    expect(slices[0]).toEqual(expect.objectContaining({
      name: 'Fuel',
      percentage: 100,
      tooltip: 'Fuel: ₹500',
    }))
    expect(slices[0].path).toContain('A 42 42 0 1 0')
  })
})

describe('buildEmployeeSpend', () => {
  it('groups debit spend by employee and ignores credits', () => {
    const employeeSpend = buildEmployeeSpend([
      { id: '1', type: 'debit', amount: 400, profiles: { name: 'Aayushi' } },
      { id: '2', type: 'debit', amount: 100, profiles: { name: 'Omkar' } },
      { id: '3', type: 'debit', amount: 250, profiles: { name: 'Aayushi' } },
      { id: '4', type: 'credit', amount: 2000, profiles: { name: 'Omkar' } },
    ])

    expect(employeeSpend).toEqual([
      { name: 'Aayushi', amount: 650, percent: 100 },
      { name: 'Omkar', amount: 100, percent: 15 },
    ])
  })

  it('uses Unknown Employee for debit entries without employee name', () => {
    const employeeSpend = buildEmployeeSpend([
      { id: '1', type: 'debit', amount: 75, profiles: null },
    ])

    expect(employeeSpend).toEqual([
      { name: 'Unknown Employee', amount: 75, percent: 100 },
    ])
  })
})
