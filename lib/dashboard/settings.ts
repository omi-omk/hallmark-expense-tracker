export type DashboardChartOrder = 'category_first' | 'employee_first'

export interface DashboardSettings {
  owner_alert_email: string
  dashboard_show_category_spend: boolean
  dashboard_show_employee_spend: boolean
  dashboard_show_employee_cards: boolean
  dashboard_chart_order: DashboardChartOrder
}

export type DashboardSettingsInput = Partial<DashboardSettings> | null | undefined

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  owner_alert_email: '',
  dashboard_show_category_spend: true,
  dashboard_show_employee_spend: true,
  dashboard_show_employee_cards: true,
  dashboard_chart_order: 'category_first',
}

export function normalizeDashboardSettings(settings: DashboardSettingsInput): DashboardSettings {
  return {
    ...DEFAULT_DASHBOARD_SETTINGS,
    ...(settings ?? {}),
    dashboard_chart_order:
      settings?.dashboard_chart_order === 'employee_first' ? 'employee_first' : 'category_first',
  }
}
