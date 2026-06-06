export type ReportEntryType = 'credit' | 'debit'

export interface ReportEntry {
  id: string
  type: ReportEntryType
  amount: number
  categories?: { name?: string | null } | null
}

export interface CategorySpend {
  name: string
  amount: number
  percent: number
}

export interface ReportAnalytics {
  totalCredits: number
  totalDebits: number
  netMovement: number
  topCategory: CategorySpend | null
  categorySpend: CategorySpend[]
}

export function buildReportAnalytics(entries: ReportEntry[]): ReportAnalytics {
  const totalCredits = entries
    .filter(entry => entry.type === 'credit')
    .reduce((sum, entry) => sum + entry.amount, 0)

  const debitEntries = entries.filter(entry => entry.type === 'debit')
  const totalDebits = debitEntries.reduce((sum, entry) => sum + entry.amount, 0)

  const grouped = new Map<string, number>()
  for (const entry of debitEntries) {
    const name = entry.categories?.name?.trim() || 'Uncategorized'
    grouped.set(name, (grouped.get(name) ?? 0) + entry.amount)
  }

  const maxAmount = Math.max(...grouped.values(), 0)
  const categorySpend = [...grouped.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      percent: maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))

  return {
    totalCredits,
    totalDebits,
    netMovement: totalCredits - totalDebits,
    topCategory: categorySpend[0] ?? null,
    categorySpend,
  }
}
