type EmployeeBalanceRow = {
  worker_id?: string | null
  type: 'credit' | 'debit'
  amount: number
}

export function calculateEmployeeBalancesFromRows(rows: EmployeeBalanceRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((balances, row) => {
    if (!row.worker_id) return balances
    const current = balances[row.worker_id] ?? 0
    balances[row.worker_id] = current + (row.type === 'credit' ? row.amount : -row.amount)
    return balances
  }, {})
}
