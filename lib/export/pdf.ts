import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExpenseWithCategory } from '@/types'

export function generatePDF(expenses: ExpenseWithCategory[], title: string): ArrayBuffer {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text('Expense Report', 14, 22)
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(title, 14, 32)

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Category', 'Amount (Rs)', 'Comment']],
    body: expenses.map(e => [
      e.date,
      e.categories.name,
      `Rs ${e.amount.toLocaleString('en-IN')}`,
      e.comment ?? '',
    ]),
    foot: [['', 'Total', `Rs ${total.toLocaleString('en-IN')}`, '']],
  })

  return doc.output('arraybuffer')
}
