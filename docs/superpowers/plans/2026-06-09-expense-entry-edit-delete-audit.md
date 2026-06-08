# Expense Entry Edit Delete Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees and admins edit/delete expense entries while recording a clear audit trail visible to admins and on transaction details.

**Architecture:** Add an `expense_activity_logs` table that stores actor, affected employee, action, old values, and new values. Route all expense PATCH/DELETE operations through `app/api/expenses/[id]/route.ts` so ownership/owner permissions and audit logging happen server-side. Reuse the existing transaction detail view with a focused client action panel for edit/delete and an admin activity list in Settings.

**Tech Stack:** Next.js App Router, Supabase, React Hook Form/Zod patterns already in the app, Jest helper tests, Tailwind UI components.

---

### Task 1: Audit Payload Helpers

**Files:**
- Create: `lib/expenses/activity-log.ts`
- Test: `__tests__/expense-activity-log.test.ts`

- [ ] Write tests for field-diff and snapshot helpers.
- [ ] Run `npm test -- --runInBand __tests__/expense-activity-log.test.ts` and confirm the helpers are missing.
- [ ] Implement helpers that compare `amount`, `date`, `category_id`, `comment`, and `image_url`.
- [ ] Run the focused test and confirm it passes.

### Task 2: Supabase Migration

**Files:**
- Create: `supabase/migrations/004_expense_activity_logs.sql`

- [ ] Add `expense_activity_logs` with `expense_id`, `worker_id`, `actor_id`, `actor_role`, `action`, `old_values`, `new_values`, `created_at`.
- [ ] Add indexes for expense, worker, and created date.
- [ ] Enable RLS and add owner/admin read policy plus employee-own-log read policy.

### Task 3: Expense PATCH/DELETE API

**Files:**
- Modify: `app/api/expenses/[id]/route.ts`
- Test: helper coverage from Task 1 plus build/typecheck.

- [ ] Validate edit payload with Zod.
- [ ] Load actor profile and expense row.
- [ ] Permit employees only for own rows; permit owner/admin for all rows.
- [ ] PATCH expenses and insert an `edited` log only when tracked fields changed.
- [ ] DELETE expenses and insert a `deleted` log with full old snapshot.

### Task 4: Detail Page Edit/Delete UI

**Files:**
- Create: `components/expense-actions.tsx`
- Modify: `components/expense-detail-view.tsx`
- Modify: `app/(worker)/expenses/[id]/page.tsx`
- Modify: `app/(owner)/owner/transactions/expenses/[id]/page.tsx`

- [ ] Fetch categories for detail pages.
- [ ] Render Edit/Delete buttons on employee and admin detail pages.
- [ ] Edit dialog updates amount, date, category, comment, and receipt URL.
- [ ] Delete confirms, calls DELETE, and routes back to the relevant list.
- [ ] Show transaction activity history on detail pages.

### Task 5: Admin Activity List

**Files:**
- Create: `app/api/expense-activity/route.ts`
- Create: `components/settings/expense-activity-log.tsx`
- Modify: `app/(owner)/owner/settings/page.tsx`

- [ ] Add an owner/admin-only API returning recent activity logs with actor and employee names.
- [ ] Add a Settings card showing recent edits/deletes with before/after summaries.

### Task 6: Verification, Push, Deploy

**Files:**
- All changed files.

- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Commit app changes without staging `.claude` or `.superpowers` state.
- [ ] Push `main`.
- [ ] Deploy production with `vercel --prod --yes` and verify READY.
