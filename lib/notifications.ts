import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import { isLowBalance } from './balance'

export interface LowBalanceNotificationResult {
  emailAttempted: boolean
  pushAttempted: boolean
}

interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
  profiles: { role: string } | { role: string }[]
}

export async function checkAndNotifyLowBalance(
  workerName: string,
  balance: number,
  threshold: number,
  ownerAlertEmail: string
): Promise<LowBalanceNotificationResult> {
  if (!isLowBalance(balance, threshold)) {
    return { emailAttempted: false, pushAttempted: false }
  }

  await Promise.allSettled([
    sendLowBalanceEmail(workerName, balance, threshold, ownerAlertEmail),
    sendOwnerPushAlerts(workerName, balance, threshold),
  ])

  return {
    emailAttempted: !!ownerAlertEmail,
    pushAttempted: canSendPush(),
  }
}

async function sendLowBalanceEmail(
  employeeName: string,
  balance: number,
  threshold: number,
  ownerAlertEmail: string
): Promise<void> {
  if (!ownerAlertEmail) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: ownerAlertEmail,
    subject: `Low Balance Alert: ${employeeName}`,
    html: `
      <p>Hello,</p>
      <p><strong>${employeeName}</strong>'s balance has dropped to <strong>₹${balance}</strong>,
      which is below the threshold of <strong>₹${threshold}</strong>.</p>
      <p>Please add funds to their account.</p>
    `,
  })
}

function canSendPush(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  )
}

async function sendOwnerPushAlerts(
  employeeName: string,
  balance: number,
  threshold: number
): Promise<void> {
  if (!canSendPush()) return

  const admin = createAdminClient()
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, profiles!inner(role)')

  const eligible = ((subscriptions ?? []) as PushSubscriptionRow[]).filter(subscription => {
    const profile = Array.isArray(subscription.profiles)
      ? subscription.profiles[0]
      : subscription.profiles
    return profile?.role === 'owner' || profile?.role === 'admin'
  })
  if (!eligible.length) return

  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const payload = JSON.stringify({
    employeeName,
    balance,
    threshold,
  })

  await Promise.allSettled(
    eligible.map(async subscription => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { urgency: 'high', TTL: 86400 }
        )
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        }
      }
    })
  )
}
