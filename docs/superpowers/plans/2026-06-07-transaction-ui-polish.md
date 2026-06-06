# Transaction UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make transaction browsing consistent, full-page, receipt-aware, and touch-friendly across owner/admin and employee UI.

**Architecture:** Add small URL helpers and focused detail pages. Convert expense cards/rows from click-dialog patterns to normal links for better mobile PWA behavior. Reuse existing Supabase server fetch patterns and card UI.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Jest, Tailwind, lucide-react.

---

### Task 1: Transaction URL Helpers

**Files:**
- Create: `lib/transactions/urls.ts`
- Create: `__tests__/transaction-urls.test.ts`

- [ ] Add tests for employee and owner expense detail URL helpers.
- [ ] Run `npm test -- --runInBand __tests__/transaction-urls.test.ts` and verify helpers are missing.
- [ ] Implement `employeeExpenseDetailUrl(id)` and `ownerExpenseDetailUrl(id)`.
- [ ] Run the focused test and verify it passes.

### Task 2: Detail Pages

**Files:**
- Create: `app/(worker)/expenses/[id]/page.tsx`
- Create: `app/(owner)/owner/transactions/expenses/[id]/page.tsx`

- [ ] Add employee expense detail page scoped to the logged-in employee.
- [ ] Add owner/admin expense detail page with employee name/email context.
- [ ] Show receipt image when present and `No receipt uploaded` when absent.

### Task 3: Clickable Transaction Lists

**Files:**
- Modify: `components/expense-list.tsx`
- Modify: `app/(worker)/dashboard/page.tsx`
- Modify: `app/(owner)/owner/workers/[id]/page.tsx`

- [ ] Replace employee expense dialog behavior with links to `/expenses/[id]`.
- [ ] Add receipt image icons to employee transaction cards.
- [ ] Make employee dashboard recent expenses clickable.
- [ ] Make owner/admin employee detail expense rows clickable and receipt-aware.

### Task 4: Low-Balance Dashboard UX

**Files:**
- Modify: `app/(owner)/owner/dashboard/page.tsx`

- [ ] Make low-balance banner link to `#low-balance-employees`.
- [ ] Add a separate low-balance employee section when needed.
- [ ] Keep the full employee list below.

### Task 5: Verification And Push

**Files:**
- No new source files expected beyond the above.

- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npm run build`.
- [ ] Run `npx eslint --ignore-pattern '.claude/**'`.
- [ ] Commit only intended files.
- [ ] Push to `origin main`.
