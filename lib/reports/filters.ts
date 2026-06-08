export interface ReportFilters {
  worker_id: string
  category_id: string
  from: string
  to: string
}

export function paramsFromReportFilters(filters: ReportFilters) {
  return new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value) as [string, string][]
  )
}

export function buildReportFilterHref(
  filters: ReportFilters,
  key: 'worker_id' | 'category_id',
  value: string
): string {
  const nextFilters = { ...filters, [key]: value }
  const params = paramsFromReportFilters(nextFilters)
  const query = params.toString()
  return query ? `/owner/reports?${query}` : '/owner/reports'
}

export function getReportChartVisibility(filters: ReportFilters) {
  return {
    showCategoryChart: !filters.category_id,
    showEmployeeChart: !filters.worker_id,
  }
}

export function reportFilterLabel<T extends { id: string; name: string }>(
  value: string,
  options: T[],
  fallback: string
): string {
  if (!value) return fallback
  return options.find(option => option.id === value)?.name ?? 'Selected'
}
