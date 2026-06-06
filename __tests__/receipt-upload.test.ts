import { receiptStoragePath, validateReceiptFile } from '@/lib/expenses/receipts'

function imageFile(name: string, type: string, size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('receipt upload helpers', () => {
  it('accepts supported image files under 5 MB', () => {
    expect(validateReceiptFile(imageFile('receipt.png', 'image/png'))).toBeNull()
  })

  it('rejects files larger than 5 MB', () => {
    expect(validateReceiptFile(imageFile('receipt.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1))).toBe('Receipt photo must be 5 MB or smaller.')
  })

  it('rejects non-image receipt files', () => {
    expect(validateReceiptFile(new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' }))).toBe('Receipt must be a JPG, PNG, WebP, HEIC, or HEIF image.')
  })

  it('builds stable receipt storage paths from mime type', () => {
    expect(receiptStoragePath('expense-1', imageFile('bill.jpeg', 'image/jpeg'))).toBe('receipts/expense-1.jpg')
    expect(receiptStoragePath('expense-1', imageFile('bill.png', 'image/png'))).toBe('receipts/expense-1.png')
  })
})
