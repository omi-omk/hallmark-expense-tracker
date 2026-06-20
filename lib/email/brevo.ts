interface BrevoEmailInput {
  fromEmail?: string
  fromName?: string
  to: string
  subject: string
  html: string
}

export function brevoSenderFromEnv() {
  return {
    email: process.env.BREVO_FROM_EMAIL ?? 'no-reply@hallmarkinteriorsolutions.in',
    name: process.env.BREVO_FROM_NAME ?? 'Hallmark Interior Solutions',
  }
}

export function buildBrevoEmailPayload(input: BrevoEmailInput) {
  const sender = {
    email: input.fromEmail ?? brevoSenderFromEnv().email,
    name: input.fromName ?? brevoSenderFromEnv().name,
  }

  return {
    sender,
    to: [{ email: input.to }],
    subject: input.subject,
    htmlContent: input.html,
  }
}

export async function sendBrevoEmail(input: BrevoEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(buildBrevoEmailPayload(input)),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => 'Brevo email failed')
    throw new Error(message || 'Brevo email failed')
  }
}
