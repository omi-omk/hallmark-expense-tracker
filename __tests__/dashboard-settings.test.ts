import { normalizeDashboardSettings } from '@/lib/dashboard/settings'

describe('normalizeDashboardSettings', () => {
  it('fills missing dashboard customization settings with visible defaults', () => {
    expect(normalizeDashboardSettings({ owner_alert_email: 'owner@example.com' })).toEqual({
      owner_alert_email: 'owner@example.com',
      dashboard_show_category_spend: true,
      dashboard_show_employee_spend: true,
      dashboard_show_employee_cards: true,
      dashboard_chart_order: 'category_first',
    })
  })

  it('keeps saved dashboard customization settings', () => {
    expect(normalizeDashboardSettings({
      owner_alert_email: '',
      dashboard_show_category_spend: false,
      dashboard_show_employee_spend: true,
      dashboard_show_employee_cards: false,
      dashboard_chart_order: 'employee_first',
    })).toEqual({
      owner_alert_email: '',
      dashboard_show_category_spend: false,
      dashboard_show_employee_spend: true,
      dashboard_show_employee_cards: false,
      dashboard_chart_order: 'employee_first',
    })
  })
})
