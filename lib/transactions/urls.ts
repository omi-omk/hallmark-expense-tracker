export function employeeExpenseDetailUrl(id: string): string {
  return `/expenses/${id}`
}

export function ownerExpenseDetailUrl(id: string): string {
  return `/owner/transactions/expenses/${id}`
}
