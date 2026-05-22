jest.mock('resend', () => {
  const mockSend = jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null })
  const MockResend = jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  }))
  ;(MockResend as any).__mockSend = mockSend
  return { Resend: MockResend }
})

import { checkAndNotifyLowBalance } from '@/lib/notifications'
import { Resend } from 'resend'

const getMockSend = (): jest.Mock => (Resend as any).__mockSend

describe('checkAndNotifyLowBalance', () => {
  beforeEach(() => {
    getMockSend().mockClear()
  })

  it('sends email when balance is below threshold', async () => {
    await checkAndNotifyLowBalance('Ravi Kumar', 300, 500, 'owner@example.com')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Ravi Kumar'),
        html: expect.stringContaining('₹300'),
      })
    )
  })

  it('does not send email when balance equals threshold', async () => {
    await checkAndNotifyLowBalance('Ravi Kumar', 500, 500, 'owner@example.com')
    expect(getMockSend()).not.toHaveBeenCalled()
  })

  it('does not send email when balance is above threshold', async () => {
    await checkAndNotifyLowBalance('Ravi Kumar', 800, 500, 'owner@example.com')
    expect(getMockSend()).not.toHaveBeenCalled()
  })

  it('includes threshold amount in email', async () => {
    await checkAndNotifyLowBalance('Priya', 100, 1000, 'owner@example.com')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('₹1000'),
      })
    )
  })
})
