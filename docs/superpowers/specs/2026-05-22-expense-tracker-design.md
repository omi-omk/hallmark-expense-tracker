# Expense Tracker — Design Spec
**Date:** 2026-05-22
**Stack:** Next.js + Supabase + Resend, deployed on Vercel

---

## Overview

A web-based expense tracking app for a company with multiple workers. The owner funds worker accounts and records the transfers in-app. Workers log in to see their balance and record expenses. The owner has full visibility, reporting, and alert capabilities. Works on mobile browsers.

---

## Users & Roles

| Role | Description |
|------|-------------|
| **Owner** | One admin account. Seeded at setup — cannot self-register. Manages workers, funds balances, views all data, exports reports. |
| **Worker** | Multiple accounts, created by owner. Sees only their own balance and expenses. |

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend + API | Next.js (App Router, TypeScript) |
| Database + Auth + Storage | Supabase (PostgreSQL) |
| Email notifications | Resend |
| Deployment | Vercel |
| Currency | Indian Rupees (₹) |

---

## Data Model

### `profiles`
Extends Supabase auth users. One row per user.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | FK to auth.users |
| name | text | |
| email | text | |
| role | enum | `owner` or `worker` |
| low_balance_threshold | integer | ₹ amount; per-worker, set by owner |
| created_at | timestamp | |

### `fund_transfers`
Each time the owner records money sent to a worker.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| worker_id | uuid | FK to profiles |
| amount | integer | ₹, positive |
| note | text | optional |
| created_at | timestamp | |

### `categories`
Global (owner-created) and worker-specific categories.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| name | text | |
| is_global | boolean | true = owner-created, visible to all |
| created_by | uuid | FK to profiles (null for seeded globals) |
| created_at | timestamp | |

**Seeded on setup:** `Other` (global, `is_global = true`, undeletable).

Workers see all global categories in expense dropdowns. Only the owner can add or delete global categories (except "Other"). Workers cannot manage categories at all.

### `expenses`
Each expense recorded by a worker.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| worker_id | uuid | FK to profiles |
| category_id | uuid | FK to categories — **required** |
| amount | integer | ₹, positive |
| date | date | The day the expense occurred; defaults to today |
| comment | text | Optional clarification note |
| image_url | text | Optional; points to Supabase Storage |
| created_at | timestamp | When the record was created in the app |

### `settings`
Single row. Stores global config.

| Column | Type | Notes |
|--------|------|-------|
| owner_alert_email | text | Email address for low-balance notifications |

---

## Balance Calculation

A worker's current balance is always computed — never stored:

```
Balance = SUM(fund_transfers.amount) − SUM(expenses.amount)
          WHERE worker_id = <worker>
```

This keeps the ledger honest and fully auditable.

---

## Screens

### Worker (3 screens)

**1. Dashboard (Home)**
- Current balance displayed prominently (large ₹ figure)
- Low balance warning banner if below threshold
- Recent expenses list (last 5–10)
- "Add Expense" button

**2. Add Expense**
- Amount (₹, required)
- Date (date picker, defaults to today)
- Category (dropdown of global categories — required; "Other" always listed last)
- Comment (text field, optional)
- Upload photo (optional, single image)
- Submit button

**3. Expense History**
- Full list of own expenses, newest first
- Filter by category and/or date range
- Tap any expense to view full details (comment + receipt photo)

---

### Owner (5 screens)

**1. Dashboard (Home)**
- All workers listed as cards showing name + current balance
- Workers below their threshold highlighted in red
- In-app alert badge for any low-balance worker
- Quick link to each worker's detail page

**2. Worker Detail**
- Worker's current balance
- "Add Funds" button → enter ₹ amount + optional note
- Low balance threshold setting for this worker (editable)
- Fund transfer history
- Full expense history (with category, date, amount, comment, photo)
- Reset worker's email or password

**3. Workers Management**
- Add new worker (name + email + temporary password + low balance threshold)
  - Threshold defaults to ₹500; owner can change it here or later from Worker Detail
  - Worker receives email with temp password on creation
- Deactivate/reactivate worker accounts

**4. Reports**
- Filter by: worker, category, date range
- Results table: worker name · date · category · amount · comment
- Export as CSV
- Export as PDF

**5. Settings**
- Global categories: add new, delete existing (cannot delete "Other")
- Owner alert email address for low-balance notifications

---

## Key Flows

### Auth
1. Owner account is seeded once at initial setup.
2. Owner creates worker via Workers Management (name + email + temp password).
3. Worker receives email with credentials.
4. Worker logs in with email + password.
5. If worker forgets credentials → owner resets from Worker Detail screen.
6. No self-registration for workers.

### Fund & Expense
1. Owner sends real money to worker (outside the app).
2. Owner records it in-app: Worker Detail → Add Funds → ₹ amount + note.
3. Worker's balance updates immediately.
4. Worker logs in, sees updated balance, records an expense.
5. Balance is deducted automatically on expense submission.
6. If new balance < worker's threshold → low balance alert triggered.

### Low Balance Alert
1. Triggered after every expense submission.
2. App recalculates worker balance.
3. If balance < `profiles.low_balance_threshold` for that worker:
   - Email sent to `settings.owner_alert_email` via Resend.
   - Red badge appears on that worker's card on owner dashboard.
4. Alert clears (badge removed) when owner next adds funds and balance exceeds threshold.

### Reports & Export
1. Owner opens Reports, selects filters (worker / category / date range).
2. App queries all matching expenses and displays in table.
3. Owner clicks "Export CSV" → downloads `.csv` file.
4. Owner clicks "Export PDF" → downloads formatted `.pdf` report.

---

## Image Storage

- Expense receipt images are stored in Supabase Storage.
- Upload is optional — expenses without images are valid.
- Images are private; accessible only to the worker who uploaded and the owner.
- Max file size: 5 MB per image.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Expense amount > current balance | Allow (balance can go negative); show warning |
| Image upload fails | Expense saves without image; user sees a non-blocking error toast |
| Email notification fails | Expense still saves; in-app alert still shows; email failure logged silently |
| Worker tries to access owner routes | Redirect to worker dashboard |
| Owner tries to delete "Other" category | Button disabled; tooltip explains it is undeletable |

---

## Out of Scope (v1)

- Worker-to-worker transfers
- Multiple currencies
- Approval workflow for expenses
- Mobile native app (iOS/Android)
- Multiple owner accounts
