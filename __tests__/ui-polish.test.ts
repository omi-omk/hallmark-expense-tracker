import { chartOrderLabel } from '@/lib/dashboard/chart-order-label'
import { calculateEmployeeBalancesFromRows } from '@/lib/workers/balances'
import { createSubmitLock } from '@/lib/forms/submit-lock'

describe('chartOrderLabel', () => {
  it('shows human labels for chart order values', () => {
    expect(chartOrderLabel('category_first')).toBe('Category chart first')
    expect(chartOrderLabel('employee_first')).toBe('Employee chart first')
  })
})

describe('calculateEmployeeBalancesFromRows', () => {
  it('calculates credits minus debits per employee', () => {
    expect(
      calculateEmployeeBalancesFromRows([
        { worker_id: 'a', type: 'credit', amount: 1000 },
        { worker_id: 'a', type: 'debit', amount: 350 },
        { worker_id: 'b', type: 'debit', amount: 100 },
      ])
    ).toEqual({ a: 650, b: -100 })
  })
})

describe('createSubmitLock', () => {
  it('rejects a second acquire until released', () => {
    const lock = createSubmitLock()

    expect(lock.acquire()).toBe(true)
    expect(lock.acquire()).toBe(false)
    lock.release()
    expect(lock.acquire()).toBe(true)
  })
})
