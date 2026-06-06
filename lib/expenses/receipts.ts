const MAX_RECEIPT_SIZE = 5 * 1024 * 1024
const ALLOWED_RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export function validateReceiptFile(file: File): string | null {
  if (file.size > MAX_RECEIPT_SIZE) return 'Receipt photo must be 5 MB or smaller.'
  if (!ALLOWED_RECEIPT_TYPES.has(file.type)) return 'Receipt must be a JPG, PNG, WebP, HEIC, or HEIF image.'
  return null
}

export function receiptStoragePath(expenseId: string, file: File): string {
  const extension = extensionForReceipt(file)
  return `receipts/${expenseId}.${extension}`
}

function extensionForReceipt(file: File): string {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'
  return file.name.split('.').pop()?.toLowerCase() || 'jpg'
}
