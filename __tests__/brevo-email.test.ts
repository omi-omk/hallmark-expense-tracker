import { buildBrevoEmailPayload, brevoSenderFromEnv } from '@/lib/email/brevo'

describe('Brevo email helper', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('builds a Brevo transactional email payload', () => {
    expect(buildBrevoEmailPayload({
      fromEmail: 'no-reply@hallmarkinteriorsolutions.in',
      fromName: 'Hallmark Interior Solutions',
      to: 'owner@example.com',
      subject: 'Low Balance',
      html: '<p>Hello</p>',
    })).toEqual({
      sender: {
        email: 'no-reply@hallmarkinteriorsolutions.in',
        name: 'Hallmark Interior Solutions',
      },
      to: [{ email: 'owner@example.com' }],
      subject: 'Low Balance',
      htmlContent: '<p>Hello</p>',
    })
  })

  it('uses the Hallmark domain sender by default', () => {
    delete process.env.BREVO_FROM_EMAIL
    delete process.env.BREVO_FROM_NAME

    expect(brevoSenderFromEnv()).toEqual({
      email: 'no-reply@hallmarkinteriorsolutions.in',
      name: 'Hallmark Interior Solutions',
    })
  })
})
