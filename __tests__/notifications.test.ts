const mockSendBrevoEmail = jest.fn().mockResolvedValue(undefined)

jest.mock('@/lib/email/brevo', () => ({
  sendBrevoEmail: (...args: unknown[]) => mockSendBrevoEmail(...args),
}))

const mockDeleteEq = jest.fn().mockResolvedValue({ error: null })
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }))
const mockSelect = jest.fn().mockResolvedValue({
  data: [
    {
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-key',
      auth: 'auth-key',
      profiles: { role: 'owner' },
    },
  ],
  error: null,
})
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  delete: mockDelete,
}))

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}))

const mockSendNotification = jest.fn().mockResolvedValue(undefined)
const mockSetVapidDetails = jest.fn()

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    sendNotification: mockSendNotification,
    setVapidDetails: mockSetVapidDetails,
  },
}))

import { checkAndNotifyLowBalance } from '@/lib/notifications'

describe('checkAndNotifyLowBalance', () => {
  beforeEach(() => {
    mockSendBrevoEmail.mockClear()
    mockSendNotification.mockClear()
    mockSetVapidDetails.mockClear()
    mockFrom.mockClear()
    mockSelect.mockClear()
    mockDelete.mockClear()
    mockDeleteEq.mockClear()
    process.env.VAPID_PUBLIC_KEY = 'public-key'
    process.env.VAPID_PRIVATE_KEY = 'private-key'
    process.env.VAPID_SUBJECT = 'mailto:owner@example.com'
  })

  it('sends email when balance is below threshold', async () => {
    const result = await checkAndNotifyLowBalance('Ravi Kumar', 300, 500, 'owner@example.com')
    expect(mockSendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Ravi Kumar'),
        html: expect.stringContaining('₹300'),
      })
    )
    expect(result.emailAttempted).toBe(true)
  })

  it('does not send email when balance equals threshold', async () => {
    const result = await checkAndNotifyLowBalance('Ravi Kumar', 500, 500, 'owner@example.com')
    expect(mockSendBrevoEmail).not.toHaveBeenCalled()
    expect(mockSendNotification).not.toHaveBeenCalled()
    expect(result).toEqual({ emailAttempted: false, pushAttempted: false })
  })

  it('does not send email when balance is above threshold', async () => {
    const result = await checkAndNotifyLowBalance('Ravi Kumar', 800, 500, 'owner@example.com')
    expect(mockSendBrevoEmail).not.toHaveBeenCalled()
    expect(mockSendNotification).not.toHaveBeenCalled()
    expect(result).toEqual({ emailAttempted: false, pushAttempted: false })
  })

  it('includes threshold amount in email', async () => {
    await checkAndNotifyLowBalance('Priya', 100, 1000, 'owner@example.com')
    expect(mockSendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('₹1000'),
      })
    )
  })

  it('sends push notifications to owner subscriptions when balance is below threshold', async () => {
    const result = await checkAndNotifyLowBalance('Priya', 100, 1000, 'owner@example.com')

    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      'mailto:owner@example.com',
      'public-key',
      'private-key'
    )
    expect(mockSendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      },
      expect.stringContaining('"employeeName":"Priya"'),
      { urgency: 'high', TTL: 86400 }
    )
    expect(result.pushAttempted).toBe(true)
  })
})
