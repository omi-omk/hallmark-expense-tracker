export function calculateBalance(
  fundTransfers: { amount: number }[],
  expenses: { amount: number }[]
): number {
  const totalFunds = fundTransfers.reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  return totalFunds - totalExpenses
}

export function isLowBalance(balance: number, threshold: number): boolean {
  return balance < threshold
}
