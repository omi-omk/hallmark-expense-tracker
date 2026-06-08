import type { DashboardChartOrder } from '@/lib/dashboard/settings'

export function chartOrderLabel(order: DashboardChartOrder): string {
  return order === 'employee_first' ? 'Employee chart first' : 'Category chart first'
}
