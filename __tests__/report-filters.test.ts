import {
  buildReportFilterHref,
  getReportChartVisibility,
  reportFilterLabel,
} from '@/lib/reports/filters'

describe('report filter helpers', () => {
  it('preserves other filters when a chart slice sets category or employee', () => {
    const filters = {
      worker_id: 'worker-1',
      category_id: '',
      from: '2026-06-01',
      to: '2026-06-09',
    }

    expect(buildReportFilterHref(filters, 'category_id', 'food-1')).toBe(
      '/owner/reports?worker_id=worker-1&category_id=food-1&from=2026-06-01&to=2026-06-09'
    )
    expect(buildReportFilterHref({ ...filters, category_id: 'food-1' }, 'worker_id', 'worker-2')).toBe(
      '/owner/reports?worker_id=worker-2&category_id=food-1&from=2026-06-01&to=2026-06-09'
    )
  })

  it('hides the chart that is already constrained to one selected value', () => {
    expect(getReportChartVisibility({ worker_id: '', category_id: '', from: '', to: '' })).toEqual({
      showCategoryChart: true,
      showEmployeeChart: true,
    })
    expect(getReportChartVisibility({ worker_id: '', category_id: 'food-1', from: '', to: '' })).toEqual({
      showCategoryChart: false,
      showEmployeeChart: true,
    })
    expect(getReportChartVisibility({ worker_id: 'worker-1', category_id: '', from: '', to: '' })).toEqual({
      showCategoryChart: true,
      showEmployeeChart: false,
    })
    expect(getReportChartVisibility({ worker_id: 'worker-1', category_id: 'food-1', from: '', to: '' })).toEqual({
      showCategoryChart: false,
      showEmployeeChart: false,
    })
  })

  it('returns readable selected labels instead of ids', () => {
    expect(reportFilterLabel('', [], 'All employees')).toBe('All employees')
    expect(reportFilterLabel('worker-1', [{ id: 'worker-1', name: 'Aayushi' }], 'All employees')).toBe('Aayushi')
    expect(reportFilterLabel('missing', [{ id: 'worker-1', name: 'Aayushi' }], 'All employees')).toBe('Selected')
  })
})
