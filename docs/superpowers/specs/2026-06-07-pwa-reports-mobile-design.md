# Expense Tracker PWA, Reports, and Mobile UX Design

## Goal

Make Hallmark Expense Tracker installable as a browser PWA, send browser push notifications to owner/admin devices when an employee balance goes low, add report graphs for category spend, prevent duplicate mutation submissions, improve mobile PWA navigation, and replace user-facing "worker" wording with "employee".

The app is still in testing, so production verification can use temporary data as long as test records are cleaned up afterward.

## Scope

### PWA installability

- Add `public/manifest.json` with Hallmark Expense Tracker app metadata, standalone display, portrait orientation, white background/theme, and icon references.
- Add generated PNG icons under `public/icons/`.
- Add `public/offline.html` and `public/sw.js`.
- Register the service worker from a small client component included in `app/layout.tsx`.
- Add manifest, theme color, apple web app metadata, and apple touch icon metadata to `app/layout.tsx`.
- Update the auth request interceptor so PWA assets are public:
  - `manifest.json`
  - `sw.js`
  - `offline.html`
  - `icons/**`
  - favicon/static assets

### Push notifications

- Push recipients are owner/admin users only. Employees do not receive browser push notifications.
- Add a Supabase `push_subscriptions` table keyed by user/device endpoint.
- Add VAPID env vars:
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
- Add API routes:
  - `GET /api/push/vapid-public-key`
  - `POST /api/push/subscribe`
  - `DELETE /api/push/subscribe`
- Add a Settings card where the owner/admin can enable or disable push notifications for the current device.
- Extend the existing low-balance notification path so worker/employee expense submission sends:
  - current email notification through Resend
  - browser push notification to subscribed owner/admin devices
- Keep email and push failures non-blocking for the expense submission, but make helper return values testable so we can verify whether push was attempted.
- Push payload opens the app to the owner dashboard or reports page when tapped.

### Report graphs

- Keep the existing report filter flow.
- After a report runs, show an analytics section before the table:
  - total credited
  - total spent
  - net balance movement
  - top spending category
  - category spend bar chart based only on debit entries
- Credits/fund transfers should not appear as categories in the spend chart.
- The chart should be lightweight and dependency-free unless the existing codebase already has a charting library. A responsive CSS bar chart is enough for the first version.
- The table remains available for detailed records and CSV/PDF exports.

### Duplicate-submit prevention

- Add immediate client-side guards for mutation forms and buttons.
- Apply to:
  - login
  - add expense
  - add funds
  - add employee
  - reset employee credentials
  - threshold save
  - alert email save
  - category add/delete
  - report run button
- Each handler should return early when already submitting.
- Buttons should be disabled while submitting and use clear loading text.
- Server routes remain idempotency-light for now; no database idempotency keys are added in this pass.

### Mobile and PWA navigation

- Remove bottom fixed navigation for PWA/mobile use because it conflicts with phone system navigation areas.
- Owner/admin navigation becomes a right-side rail on mobile, using icon buttons with accessible labels. On desktop it can remain a wider side navigation.
- Employee navigation also moves away from the bottom. Use a right-side compact rail or top/right hybrid that keeps primary content readable on small screens.
- Add responsive content padding so the right rail does not cover forms, tables, or buttons.
- Keep nav targets unchanged to avoid route churn.

### UI wording

- Replace user-facing "Worker/Workers" text with "Employee/Employees".
- Keep internal route names, DB role names, API fields, and TypeScript identifiers as `worker` unless a UI-only rename is straightforward. This avoids a risky database and route migration.
- Examples:
  - "Workers" nav label becomes "Employees".
  - "Add New Worker" becomes "Add New Employee".
  - "No workers yet" becomes "No employees yet".
  - Emails may say "employee" in visible copy, while API payload fields keep `worker_id`.

## Architecture

### PWA files

`public/manifest.json` and `public/sw.js` mirror the inventory app's proven structure with expense-specific copy. The service worker handles:

- install and cache offline fallback
- navigation fetch fallback to `/offline.html`
- push event display
- notification click navigation

`components/sw-register.tsx` registers `/sw.js` on the client. `app/layout.tsx` adds PWA metadata and includes the registration component.

### Push data flow

1. Owner/admin opens Settings in the installed app or browser.
2. They click Enable Push Notifications.
3. Browser asks permission and creates a Push API subscription.
4. Client posts subscription keys to `/api/push/subscribe`.
5. Route verifies the current user is owner/admin and upserts the subscription in Supabase.
6. Employee submits an expense.
7. `/api/expenses` recalculates employee balance.
8. If balance is below threshold, `checkAndNotifyLowBalance` sends email and push notifications to owner/admin subscriptions.
9. Tapping the notification opens `/owner/dashboard`.

### Reports graph data flow

The report page already receives mixed credit/debit entries from `/api/reports`. Client-side derived helpers will:

- split credit and debit totals
- group debit rows by `categories.name`
- sort categories by amount descending
- compute percentages against the largest category for bar widths

These helpers should be pure functions and covered by tests.

### Duplicate-submit guard

For React Hook Form, rely on `isSubmitting` plus an explicit `submitting`/`uploading` guard where needed. For manual forms, use a `loading` state with an early return:

```ts
if (loading) return
setLoading(true)
try {
  // mutation
} finally {
  setLoading(false)
}
```

## Error Handling

- PWA registration errors are logged only in development or silently ignored in production; they should not block app usage.
- Push subscribe failures show a toast and leave the UI in the previous state.
- Missing VAPID env vars make the public-key endpoint return a clear server error.
- Notification send failures remain non-blocking for expense creation.
- Reports show a no-data state when filters return no rows.
- Duplicate submission attempts while loading do nothing.

## Testing

- Unit tests for report aggregation helpers:
  - groups only debit entries by category
  - ignores credit rows
  - computes total credit/debit/net/top category
- Unit tests for notification helper behavior:
  - no push/email when balance is not low
  - push attempted for owner/admin subscriptions when balance is low
  - expired push subscription cleanup can be tested if implementation exposes it cleanly
- Unit tests or focused component tests for duplicate-submit helpers where practical.
- Manual/browser verification:
  - `manifest.json` is reachable without login redirect
  - `sw.js` is reachable without login redirect
  - live app shows installable PWA metadata
  - Settings can subscribe current device when VAPID env vars exist
  - temporary employee expense triggers low-balance notification path
  - reports show category chart and table
  - mobile viewport does not have bottom nav overlap

## Deployment Notes

- Add VAPID env vars in Vercel Production.
- Run Supabase migration for `push_subscriptions`.
- Deploy to Vercel.
- Verify on a real phone for install and push. iOS push notifications require the app to be installed to the Home Screen and notification permission granted.

## Out of Scope

- Renaming database roles or route paths from `worker` to `employee`.
- Guaranteed email/push delivery auditing in the UI.
- Offline data entry and sync.
- Server-side idempotency keys for every mutation.
