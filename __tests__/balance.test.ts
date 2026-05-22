import { calculateBalance, isLowBalance } from '@/lib/balance'

describe('calculateBalance', () => {
  it('returns 0 when no transfers and no expenses', () => {
    expect(calculateBalance([], [])).toBe(0)
  })

  it('returns total funds when no expenses', () => {
    expect(calculateBalance([{ amount: 1000 }, { amount: 500 }], [])).toBe(1500)
  })

  it('deducts expenses from funds', () => {
    expect(calculateBalance([{ amount: 1000 }], [{ amount: 300 }])).toBe(700)
  })

  it('returns negative when expenses exceed funds', () => {
    expect(calculateBalance([{ amount: 200 }], [{ amount: 500 }])).toBe(-300)
  })

  it('handles multiple transfers and multiple expenses', () => {
    expect(
      calculateBalance(
        [{ amount: 1000 }, { amount: 500 }],
        [{ amount: 200 }, { amount: 150 }]
      )
    ).toBe(1150)
  })
})

describe('isLowBalance', () => {
  it('returns true when balance is below threshold', () => {
    expect(isLowBalance(400, 500)).toBe(true)
  })

  it('returns false when balance equals threshold', () => {
    expect(isLowBalance(500, 500)).toBe(false)
  })

  it('returns false when balance is above threshold', () => {
    expect(isLowBalance(600, 500)).toBe(false)
  })

  it('returns true for negative balance with positive threshold', () => {
    expect(isLowBalance(-100, 500)).toBe(true)
  })
})
