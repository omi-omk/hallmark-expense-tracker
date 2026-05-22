import { Resend } from 'resend'
import { isLowBalance } from './balance'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function checkAndNotifyLowBalance(
  workerName: string,
  balance: number,
  threshold: number,
  ownerAlertEmail: string
): Promise<void> {
  if (!isLowBalance(balance, threshold)) return

  await resend.emails.send({
    from: 'alerts@expensetracker.app',
    to: ownerAlertEmail,
    subject: `Low Balance Alert: ${workerName}`,
    html: `
      <p>Hello,</p>
      <p><strong>${workerName}</strong>'s balance has dropped to <strong>₹${balance}</strong>,
      which is below the threshold of <strong>₹${threshold}</strong>.</p>
      <p>Please add funds to their account.</p>
    `,
  })
}
