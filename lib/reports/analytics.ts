export type ReportEntryType = 'credit' | 'debit'

export interface ReportEntry {
  id: string
  type: ReportEntryType
  amount: number
  categories?: { name?: string | null } | null
  profiles?: { name?: string | null } | null
}

export interface CategorySpend {
  name: string
  amount: number
  percent: number
}

export type EmployeeSpend = CategorySpend

export interface ReportAnalytics {
  totalCredits: number
  totalDebits: number
  netMovement: number
  topCategory: CategorySpend | null
  categorySpend: CategorySpend[]
}

export interface PieSlice {
  name: string
  amount: number
  percentage: number
  path: string
  color: string
  tooltip: string
}

const PIE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
]

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

export function buildPieSlices(categorySpend: CategorySpend[]): PieSlice[] {
  const total = categorySpend.reduce((sum, category) => sum + category.amount, 0)
  if (total <= 0) return []

  let startAngle = -90

  return categorySpend.map((category, index) => {
    const angle = (category.amount / total) * 360
    const endAngle = startAngle + angle
    const path = describeArc(50, 50, 42, startAngle, endAngle)
    const percentage = Math.round((category.amount / total) * 100)
    const slice = {
      name: category.name,
      amount: category.amount,
      percentage,
      path,
      color: PIE_COLORS[index % PIE_COLORS.length],
      tooltip: `${category.name}: ₹${category.amount.toLocaleString('en-IN')}`,
    }
    startAngle = endAngle
    return slice
  })
}

export function buildEmployeeSpend(entries: ReportEntry[]): EmployeeSpend[] {
  const debitEntries = entries.filter(entry => entry.type === 'debit')
  const grouped = new Map<string, number>()

  for (const entry of debitEntries) {
    const name = entry.profiles?.name?.trim() || 'Unknown Employee'
    grouped.set(name, (grouped.get(name) ?? 0) + entry.amount)
  }

  const maxAmount = Math.max(...grouped.values(), 0)
  return [...grouped.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      percent: maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  if (endAngle - startAngle >= 360) {
    return [
      `M ${cx} ${cy}`,
      `L ${cx} ${cy - radius}`,
      `A ${radius} ${radius} 0 1 0 ${cx} ${cy + radius}`,
      `A ${radius} ${radius} 0 1 0 ${cx} ${cy - radius}`,
      'Z',
    ].join(' ')
  }

  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  }
}
