# Dashboard Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a simple customizable owner dashboard with employee-wise spend, optional employee titles, and settings-controlled dashboard sections.

**Architecture:** Reuse the existing report analytics helpers and pie chart component. Store employee titles on `profiles` and dashboard preferences on the singleton `settings` row. Keep customization in the existing Settings page and keep dashboard rendering server-side.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Jest, Tailwind/shadcn UI components.

---

### Task 1: Analytics Helpers

**Files:**
- Modify: `lib/reports/analytics.ts`
- Modify: `__tests__/reports-analytics.test.ts`

- [ ] Add failing Jest tests for `buildEmployeeSpend`.
- [ ] Run `npm test -- --runInBand __tests__/reports-analytics.test.ts` and verify the new tests fail because `buildEmployeeSpend` is missing.
- [ ] Implement `EmployeeSpend` and `buildEmployeeSpend(entries)`.
- [ ] Run the focused test again and verify it passes.

### Task 2: Database And Types

**Files:**
- Create: `supabase/migrations/003_dashboard_customization.sql`
- Modify: `types/index.ts`

- [ ] Add a migration for `profiles.title` and dashboard settings columns.
- [ ] Update `Profile` and `Settings` TypeScript interfaces.

### Task 3: Employee Title Forms And API

**Files:**
- Modify: `app/api/workers/route.ts`
- Modify: `app/api/workers/[id]/route.ts`
- Modify: `app/(owner)/owner/workers/page.tsx`
- Modify: `components/reset-credentials-form.tsx`
- Modify: `components/worker-card.tsx`
- Modify: `app/(owner)/owner/workers/[id]/page.tsx`

- [ ] Accept optional `title` during employee creation.
- [ ] Accept optional `title` during employee update.
- [ ] Display title on employee cards, employee list, and employee detail.
- [ ] Keep title optional and trim empty strings to `null`.

### Task 4: Dashboard Settings API And UI

**Files:**
- Modify: `app/api/settings/route.ts`
- Modify: `app/(owner)/owner/settings/page.tsx`

- [ ] Extend GET response defaults for dashboard settings.
- [ ] Extend PATCH schema to accept either alert email, dashboard settings, or both.
- [ ] Add Settings page controls for dashboard section visibility and chart order.
- [ ] Disable the save button while saving to prevent double submits.

### Task 5: Dashboard Rendering

**Files:**
- Modify: `app/(owner)/owner/dashboard/page.tsx`

- [ ] Query expense totals with employee names.
- [ ] Build employee spend data and pass it to `CategorySpendPieChart`.
- [ ] Read dashboard settings and render sections conditionally.
- [ ] Respect chart order when both charts are visible.
- [ ] Show an empty state if all dashboard sections are hidden.

### Task 6: Verification And Deployment

**Files:**
- No new files expected.

- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npm run build`.
- [ ] Run `npx eslint --ignore-pattern '.claude/**'`.
- [ ] Commit only intended files.
- [ ] Push to `origin main`.
- [ ] Confirm Vercel deployment path, using Git auto-deploy or `vercel --prod` if CLI auth is available.
