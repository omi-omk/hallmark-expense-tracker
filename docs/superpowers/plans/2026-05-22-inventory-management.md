# Hallmark Inventory Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js 16 inventory management system at `../hallmark-inventory` (sibling to `hallmark-expense-tracker`) with role-based stock movement tracking, low-stock email alerts, and admin reporting.

**Architecture:** Next.js 16 App Router with `(auth)` and `(app)` route groups. All mutations go through API routes using the Supabase service-role admin client (bypasses RLS). Current product quantity is derived by summing `stock_movements.quantity` via a Postgres function `product_current_quantity(p_id uuid)`. Permission checks are enforced in application code; RLS only gates SELECT for authenticated users.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (dedicated project), Resend, Tailwind v4, shadcn (base-nova / lucide), Zod, react-hook-form, sonner, papaparse, jspdf, jspdf-autotable, Jest (node env)

**AGENTS.md note:** Before writing any Next.js code, read `node_modules/next/dist/docs/` for breaking-change APIs (dynamic route params are now `Promise<{ id: string }>` in Next.js 15+).

---

## File Map

```
hallmark-inventory/
├── __tests__/
│   ├── permissions.test.ts
│   ├── notifications.test.ts
│   └── export.test.ts
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── products/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── history/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── users/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/callback/route.ts
│   │   ├── auth/signout/route.ts
│   │   ├── users/route.ts
│   │   ├── users/[id]/route.ts
│   │   ├── categories/route.ts
│   │   ├── categories/[id]/route.ts
│   │   ├── products/route.ts
│   │   ├── products/[id]/route.ts
│   │   ├── movements/route.ts
│   │   └── reports/route.ts
│   └── page.tsx
├── components/
│   ├── providers/profile-context.tsx
│   ├── nav/app-nav.tsx
│   ├── users/users-client.tsx
│   ├── categories/categories-client.tsx
│   ├── inventory/inventory-client.tsx
│   ├── products/products-client.tsx
│   ├── history/history-client.tsx
│   ├── dashboard/dashboard-client.tsx
│   └── reports/reports-client.tsx
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   ├── export/csv.ts
│   ├── export/pdf.ts
│   ├── notifications.ts
│   └── permissions.ts
├── supabase/migrations/001_initial.sql
├── types/index.ts
├── .env.local.example
├── jest.config.js
└── middleware.ts
```

---

### Task 1: Scaffold the project

**Files:**
- Create: `../hallmark-inventory/` (new Next.js project)
- Create: `../hallmark-inventory/jest.config.js`
- Create: `../hallmark-inventory/.env.local.example`

- [ ] **Step 1: Create the Next.js app**

From `/Users/aayushibaldi/Desktop/hallmark-dev/`:

```bash
npx create-next-app@latest hallmark-inventory \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

When prompted, accept all defaults.

- [ ] **Step 2: Install dependencies**

```bash
cd hallmark-inventory
npm install @supabase/ssr @supabase/supabase-js zod react-hook-form @hookform/resolvers \
  resend sonner papaparse jspdf jspdf-autotable
npm install --save-dev jest jest-environment-node @types/jest ts-jest @types/papaparse
```

- [ ] **Step 3: Install and initialise shadcn**

```bash
npx shadcn@latest init
```

When prompted: style → `base-nova`, base color → `neutral`, CSS variables → yes. Then add the components used throughout:

```bash
npx shadcn@latest add button input label card dialog drawer sheet badge \
  table select checkbox switch toast separator
```

- [ ] **Step 4: Write jest.config.js**

```js
// jest.config.js
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

module.exports = createJestConfig(config)
```

- [ ] **Step 5: Write .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
```

Copy it to `.env.local` and fill in values from your new Supabase project.

- [ ] **Step 6: Add test script to package.json**

Open `package.json` and ensure `scripts` contains:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Initialise git and commit**

```bash
git init
git add .
git commit -m "chore: scaffold hallmark-inventory project"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Create migration file**

```bash
mkdir -p supabase/migrations
```

Create `supabase/migrations/001_initial.sql` with the following content:

```sql
-- profiles: extends auth.users
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'user')),
  can_add_stock boolean not null default false,
  can_remove_stock boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.categories(id),
  description text,
  low_stock_threshold integer not null check (low_stock_threshold >= 0),
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- stock_movements (append-only)
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null,  -- positive=add, negative=remove
  movement_type text not null check (movement_type in ('add', 'remove', 'correction')),
  note text,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- settings (singleton row, reserved for future config)
create table public.settings (
  id integer primary key default 1 check (id = 1)
);
insert into public.settings (id) values (1);

-- derive current quantity from movements
create or replace function public.product_current_quantity(p_id uuid)
returns integer language sql stable as $$
  select coalesce(sum(quantity), 0)::integer
  from public.stock_movements
  where product_id = p_id;
$$;

-- enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.settings enable row level security;

-- authenticated users can read everything
create policy "Authenticated read profiles"
  on public.profiles for select to authenticated using (true);

create policy "Authenticated read categories"
  on public.categories for select to authenticated using (true);

create policy "Authenticated read products"
  on public.products for select to authenticated using (true);

create policy "Authenticated read movements"
  on public.stock_movements for select to authenticated using (true);

create policy "Authenticated read settings"
  on public.settings for select to authenticated using (true);
```

- [ ] **Step 2: Run migration in Supabase**

Go to your Supabase project → SQL Editor → paste the contents of `001_initial.sql` → Run.

- [ ] **Step 3: Create the first admin user**

In the Supabase dashboard → Authentication → Users → Add user (confirm email). Then in the SQL Editor:

```sql
insert into public.profiles (id, name, email, role)
values (
  '<user-uuid-from-auth-dashboard>',
  'Admin',
  '<admin-email>',
  'admin'
);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial.sql
git commit -m "feat: add initial database schema and RLS policies"
```

---

### Task 3: TypeScript types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Write types**

```typescript
// types/index.ts
export type Role = 'admin' | 'user'
export type MovementType = 'add' | 'remove' | 'correction'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  can_add_stock: boolean
  can_remove_stock: boolean
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
}

export interface Product {
  id: string
  name: string
  category_id: string
  description: string | null
  low_stock_threshold: number
  is_archived: boolean
  created_by: string | null
  created_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  quantity: number
  movement_type: MovementType
  note: string | null
  performed_by: string | null
  created_at: string
}

// Returned by GET /api/products (via get_products_with_quantity RPC)
export interface ProductWithQuantity extends Product {
  current_quantity: number
  category_name: string
}

// Returned by GET /api/movements with joins
export interface MovementWithDetails extends StockMovement {
  products: { name: string; categories: { name: string } }
  profiles: { name: string } | null
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add TypeScript types for all entities"
```

---

### Task 4: Supabase clients

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Write browser client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Write server client**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Profile } from '@/types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// Service-role client: bypasses RLS — use only in server API routes
export function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin'
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data ?? null
}

export async function getAllAdminEmails(): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
    .eq('is_active', true)
  return (data ?? []).map((p: { email: string }) => p.email)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: add Supabase browser and server clients"
```

---

### Task 5: Permission helpers (TDD)

**Files:**
- Create: `lib/permissions.ts`
- Create: `__tests__/permissions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/permissions.test.ts
import {
  canAddStock,
  canRemoveStock,
  canManageStock,
  canManageUsers,
  canDeleteCategory,
  canArchiveProduct,
  canRecordCorrection,
  canViewAdminPages,
  canExportData,
} from '@/lib/permissions'
import type { Profile } from '@/types'

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  name: 'Test',
  email: 'test@example.com',
  role: 'user',
  can_add_stock: false,
  can_remove_stock: false,
  is_active: true,
  created_at: new Date().toISOString(),
  ...overrides,
})

describe('canAddStock', () => {
  it('returns true for admin', () => {
    expect(canAddStock(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns true for user with can_add_stock', () => {
    expect(canAddStock(makeProfile({ can_add_stock: true }))).toBe(true)
  })
  it('returns false for view-only user', () => {
    expect(canAddStock(makeProfile())).toBe(false)
  })
  it('returns false for user with only can_remove_stock', () => {
    expect(canAddStock(makeProfile({ can_remove_stock: true }))).toBe(false)
  })
})

describe('canRemoveStock', () => {
  it('returns true for admin', () => {
    expect(canRemoveStock(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns true for user with can_remove_stock', () => {
    expect(canRemoveStock(makeProfile({ can_remove_stock: true }))).toBe(true)
  })
  it('returns false for view-only user', () => {
    expect(canRemoveStock(makeProfile())).toBe(false)
  })
  it('returns false for user with only can_add_stock', () => {
    expect(canRemoveStock(makeProfile({ can_add_stock: true }))).toBe(false)
  })
})

describe('canManageStock', () => {
  it('returns true for admin', () => {
    expect(canManageStock(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns true for user with can_add_stock', () => {
    expect(canManageStock(makeProfile({ can_add_stock: true }))).toBe(true)
  })
  it('returns true for user with can_remove_stock', () => {
    expect(canManageStock(makeProfile({ can_remove_stock: true }))).toBe(true)
  })
  it('returns false for view-only user', () => {
    expect(canManageStock(makeProfile())).toBe(false)
  })
})

describe('canManageUsers', () => {
  it('returns true for admin', () => {
    expect(canManageUsers(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns false for non-admin', () => {
    expect(canManageUsers(makeProfile())).toBe(false)
  })
})

describe('canDeleteCategory', () => {
  it('returns true for admin', () => {
    expect(canDeleteCategory(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns false for user with permissions', () => {
    expect(canDeleteCategory(makeProfile({ can_add_stock: true }))).toBe(false)
  })
})

describe('canArchiveProduct', () => {
  it('returns true for admin', () => {
    expect(canArchiveProduct(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns false for non-admin', () => {
    expect(canArchiveProduct(makeProfile({ can_add_stock: true }))).toBe(false)
  })
})

describe('canRecordCorrection', () => {
  it('returns true for admin', () => {
    expect(canRecordCorrection(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns false for non-admin', () => {
    expect(canRecordCorrection(makeProfile({ can_add_stock: true }))).toBe(false)
  })
})

describe('canViewAdminPages', () => {
  it('returns true for admin', () => {
    expect(canViewAdminPages(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns false for user', () => {
    expect(canViewAdminPages(makeProfile())).toBe(false)
  })
})

describe('canExportData', () => {
  it('returns true for admin', () => {
    expect(canExportData(makeProfile({ role: 'admin' }))).toBe(true)
  })
  it('returns false for non-admin', () => {
    expect(canExportData(makeProfile())).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=permissions
```

Expected: FAIL — `Cannot find module '@/lib/permissions'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/permissions.ts
import type { Profile } from '@/types'

export function canAddStock(profile: Profile): boolean {
  return profile.role === 'admin' || profile.can_add_stock
}

export function canRemoveStock(profile: Profile): boolean {
  return profile.role === 'admin' || profile.can_remove_stock
}

export function canManageStock(profile: Profile): boolean {
  return profile.role === 'admin' || profile.can_add_stock || profile.can_remove_stock
}

export function canManageUsers(profile: Profile): boolean {
  return profile.role === 'admin'
}

export function canDeleteCategory(profile: Profile): boolean {
  return profile.role === 'admin'
}

export function canArchiveProduct(profile: Profile): boolean {
  return profile.role === 'admin'
}

export function canRecordCorrection(profile: Profile): boolean {
  return profile.role === 'admin'
}

export function canViewAdminPages(profile: Profile): boolean {
  return profile.role === 'admin'
}

export function canExportData(profile: Profile): boolean {
  return profile.role === 'admin'
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=permissions
```

Expected: PASS — 18 tests

- [ ] **Step 5: Commit**

```bash
git add lib/permissions.ts __tests__/permissions.test.ts
git commit -m "feat: add permission helpers with TDD"
```

---

### Task 6: Notification library (TDD)

**Files:**
- Create: `lib/notifications.ts`
- Create: `__tests__/notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/notifications.test.ts
jest.mock('resend', () => {
  const mockSend = jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null })
  const MockResend = jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  }))
  ;(MockResend as any).__mockSend = mockSend
  return { Resend: MockResend }
})

import { sendLowStockAlert, sendWelcomeEmail } from '@/lib/notifications'
import { Resend } from 'resend'

const getMockSend = (): jest.Mock => (Resend as any).__mockSend

describe('sendLowStockAlert', () => {
  beforeEach(() => getMockSend().mockClear())

  it('sends one email per admin address', async () => {
    await sendLowStockAlert('Widget A', 3, 10, ['a@x.com', 'b@x.com'])
    expect(getMockSend()).toHaveBeenCalledTimes(2)
  })

  it('includes product name in subject', async () => {
    await sendLowStockAlert('Widget A', 3, 10, ['a@x.com'])
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Widget A') })
    )
  })

  it('includes current quantity in body', async () => {
    await sendLowStockAlert('Widget A', 3, 10, ['a@x.com'])
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('3') })
    )
  })

  it('includes threshold in body', async () => {
    await sendLowStockAlert('Widget A', 3, 10, ['a@x.com'])
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('10') })
    )
  })

  it('sends no emails when adminEmails is empty', async () => {
    await sendLowStockAlert('Widget A', 3, 10, [])
    expect(getMockSend()).not.toHaveBeenCalled()
  })
})

describe('sendWelcomeEmail', () => {
  beforeEach(() => getMockSend().mockClear())

  it('sends email to the new user address', async () => {
    await sendWelcomeEmail('Ravi Kumar', 'ravi@x.com', 'secret123')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ravi@x.com' })
    )
  })

  it('includes user name in body', async () => {
    await sendWelcomeEmail('Ravi Kumar', 'ravi@x.com', 'secret123')
    expect(getMockSend()).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('Ravi Kumar') })
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=notifications
```

Expected: FAIL — `Cannot find module '@/lib/notifications'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/notifications.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendLowStockAlert(
  productName: string,
  currentQty: number,
  threshold: number,
  adminEmails: string[]
): Promise<void> {
  for (const email of adminEmails) {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `Low Stock Alert: ${productName}`,
      html: `
        <p>Hello,</p>
        <p><strong>${productName}</strong> quantity has dropped to <strong>${currentQty}</strong>,
        which is at or below the threshold of <strong>${threshold}</strong>.</p>
        <p>Please restock.</p>
      `,
    })
  }
}

export async function sendWelcomeEmail(
  name: string,
  email: string,
  password: string
): Promise<void> {
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Your Inventory account is ready',
    html: `
      <p>Hi ${name},</p>
      <p>Your Inventory account has been created. Here are your login details:</p>
      <p><strong>Email:</strong> ${email}<br/>
      <strong>Password:</strong> ${password}</p>
      <p>Please log in and change your password.</p>
    `,
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=notifications
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts __tests__/notifications.test.ts
git commit -m "feat: add notification helpers with TDD"
```

---

### Task 7: Export utilities (TDD)

**Files:**
- Create: `lib/export/csv.ts`
- Create: `lib/export/pdf.ts`
- Create: `__tests__/export.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/export.test.ts
jest.mock('jspdf', () =>
  jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    text: jest.fn(),
    output: jest.fn().mockReturnValue(new ArrayBuffer(0)),
  }))
)
jest.mock('jspdf-autotable', () => jest.fn())

import { generateInventoryCSV, generateMovementsCSV } from '@/lib/export/csv'
import { generateInventoryPDF } from '@/lib/export/pdf'
import type { ProductWithQuantity, MovementWithDetails } from '@/types'

const makeProduct = (overrides: Partial<ProductWithQuantity> = {}): ProductWithQuantity => ({
  id: 'prod-1',
  name: 'Widget A',
  category_id: 'cat-1',
  description: null,
  low_stock_threshold: 10,
  is_archived: false,
  created_by: null,
  created_at: new Date().toISOString(),
  current_quantity: 25,
  category_name: 'Electronics',
  ...overrides,
})

const makeMovement = (overrides: Partial<MovementWithDetails> = {}): MovementWithDetails => ({
  id: 'mov-1',
  product_id: 'prod-1',
  quantity: 5,
  movement_type: 'add',
  note: null,
  performed_by: null,
  created_at: new Date().toISOString(),
  products: { name: 'Widget A', categories: { name: 'Electronics' } },
  profiles: { name: 'Ravi Kumar' },
  ...overrides,
})

describe('generateInventoryCSV', () => {
  it('returns a string', () => {
    expect(typeof generateInventoryCSV([makeProduct()])).toBe('string')
  })
  it('includes product name', () => {
    expect(generateInventoryCSV([makeProduct({ name: 'Widget A' })])).toContain('Widget A')
  })
  it('includes category name', () => {
    expect(generateInventoryCSV([makeProduct()])).toContain('Electronics')
  })
  it('includes current quantity', () => {
    expect(generateInventoryCSV([makeProduct({ current_quantity: 25 })])).toContain('25')
  })
  it('still returns headers for empty input', () => {
    const result = generateInventoryCSV([])
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('generateMovementsCSV', () => {
  it('returns a string', () => {
    expect(typeof generateMovementsCSV([makeMovement()])).toBe('string')
  })
  it('includes product name', () => {
    expect(generateMovementsCSV([makeMovement()])).toContain('Widget A')
  })
  it('includes performer name', () => {
    expect(generateMovementsCSV([makeMovement()])).toContain('Ravi Kumar')
  })
})

describe('generateInventoryPDF', () => {
  it('returns an ArrayBuffer', () => {
    expect(generateInventoryPDF([makeProduct()], 'Test')).toBeInstanceOf(ArrayBuffer)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=export
```

Expected: FAIL — `Cannot find module '@/lib/export/csv'`

- [ ] **Step 3: Write CSV export**

```typescript
// lib/export/csv.ts
import Papa from 'papaparse'
import type { ProductWithQuantity, MovementWithDetails } from '@/types'

export function generateInventoryCSV(products: ProductWithQuantity[]): string {
  const rows = products.map(p => ({
    Name: p.name,
    Category: p.category_name,
    'Current Qty': p.current_quantity,
    Threshold: p.low_stock_threshold,
    Status: p.current_quantity <= p.low_stock_threshold ? 'Low Stock' : 'OK',
    Description: p.description ?? '',
  }))
  return Papa.unparse({
    fields: ['Name', 'Category', 'Current Qty', 'Threshold', 'Status', 'Description'],
    data: rows,
  })
}

export function generateMovementsCSV(movements: MovementWithDetails[]): string {
  const rows = movements.map(m => ({
    Timestamp: m.created_at,
    Product: m.products.name,
    Category: m.products.categories.name,
    Type: m.movement_type,
    Quantity: m.quantity,
    Note: m.note ?? '',
    'Performed By': m.profiles?.name ?? '—',
  }))
  return Papa.unparse({
    fields: ['Timestamp', 'Product', 'Category', 'Type', 'Quantity', 'Note', 'Performed By'],
    data: rows,
  })
}
```

- [ ] **Step 4: Write PDF export**

```typescript
// lib/export/pdf.ts
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ProductWithQuantity } from '@/types'

export function generateInventoryPDF(products: ProductWithQuantity[], title: string): ArrayBuffer {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text('Inventory Report', 14, 22)
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(title, 14, 32)

  autoTable(doc, {
    startY: 40,
    head: [['Name', 'Category', 'Current Qty', 'Threshold', 'Status']],
    body: products.map(p => [
      p.name,
      p.category_name,
      p.current_quantity,
      p.low_stock_threshold,
      p.current_quantity <= p.low_stock_threshold ? 'Low Stock' : 'OK',
    ]),
  })

  return doc.output('arraybuffer')
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=export
```

Expected: PASS — 9 tests

- [ ] **Step 6: Commit**

```bash
git add lib/export/csv.ts lib/export/pdf.ts __tests__/export.test.ts
git commit -m "feat: add CSV and PDF export utilities with TDD"
```

---

### Task 8: Middleware + auth API routes

**Files:**
- Create: `middleware.ts`
- Create: `app/api/auth/signout/route.ts`
- Create: `app/api/auth/callback/route.ts`

- [ ] **Step 1: Write middleware**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
```

- [ ] **Step 2: Write signout route**

```typescript
// app/api/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SUPABASE_URL!
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('supabase.co', '')}` : 'http://localhost:3000'
  ))
}
```

Wait — use `NextResponse.json` + client-side redirect instead to avoid URL issues:

```typescript
// app/api/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}
```

The nav component will call `POST /api/auth/signout` then `router.push('/login')`.

- [ ] **Step 3: Write auth callback route**

```typescript
// app/api/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 4: Commit**

```bash
git add middleware.ts app/api/auth/signout/route.ts app/api/auth/callback/route.ts
git commit -m "feat: add middleware and auth API routes"
```

---

### Task 9: App shell — layout, context, nav, root page

**Files:**
- Create: `components/providers/profile-context.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `components/nav/app-nav.tsx`
- Create: `app/page.tsx`
- Create: `app/(auth)/layout.tsx`

- [ ] **Step 1: Write the profile context (client)**

```typescript
// components/providers/profile-context.tsx
'use client'

import { createContext, useContext } from 'react'
import type { Profile } from '@/types'

const ProfileContext = createContext<Profile | null>(null)

export function ProfileProvider({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

export function useProfile(): Profile {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
```

- [ ] **Step 2: Write the (app) layout (server)**

```typescript
// app/(app)/layout.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileProvider } from '@/components/providers/profile-context'
import { AppNav } from '@/components/nav/app-nav'
import type { Profile } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login')

  return (
    <ProfileProvider profile={profile as Profile}>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row pb-16 md:pb-0">
        <AppNav />
        <main className="flex-1 p-4 md:p-8 max-w-6xl">
          {children}
        </main>
      </div>
    </ProfileProvider>
  )
}
```

- [ ] **Step 3: Write the AppNav (client)**

```typescript
// components/nav/app-nav.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useProfile } from '@/components/providers/profile-context'
import { Button } from '@/components/ui/button'
import { Package, LayoutDashboard, History, Users, FileText, Tags, Settings, LogOut } from 'lucide-react'

export function AppNav() {
  const profile = useProfile()
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = profile.role === 'admin'

  const links = [
    ...(isAdmin ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    { href: '/inventory', label: 'Inventory', icon: Package },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/categories', label: 'Categories', icon: Tags },
    { href: '/history', label: 'History', icon: History },
    ...(isAdmin ? [
      { href: '/reports', label: 'Reports', icon: FileText },
      { href: '/users', label: 'Users', icon: Users },
      { href: '/settings', label: 'Settings', icon: Settings },
    ] : []),
  ]

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="w-full md:w-56 bg-white border-b md:border-r border-gray-200 flex md:flex-col">
      <div className="p-4 border-b border-gray-200 hidden md:block">
        <h1 className="font-semibold text-gray-900">Hallmark Inventory</h1>
        <p className="text-xs text-gray-500 truncate">{profile.name}</p>
      </div>
      <div className="flex md:flex-col flex-1 overflow-x-auto md:overflow-visible p-2 gap-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
              ${pathname.startsWith(href)
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </div>
      <div className="p-2 border-t border-gray-200 hidden md:block">
        <Button variant="ghost" className="w-full justify-start gap-2 text-gray-600" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Write the root page (role-based redirect)**

```typescript
// app/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/dashboard')
  redirect('/inventory')
}
```

- [ ] **Step 5: Write the (auth) layout**

```typescript
// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {children}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/providers/profile-context.tsx app/(app)/layout.tsx \
  components/nav/app-nav.tsx app/page.tsx app/(auth)/layout.tsx
git commit -m "feat: add app shell with profile context and nav"
```

---

### Task 10: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Write the login page**

```typescript
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Hallmark Inventory</CardTitle>
        <p className="text-sm text-muted-foreground text-center">Sign in to your account</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(auth)/login/page.tsx
git commit -m "feat: add login page"
```

---

### Task 11: Users API

**Files:**
- Create: `app/api/users/route.ts`
- Create: `app/api/users/[id]/route.ts`

- [ ] **Step 1: Write GET + POST /api/users**

```typescript
// app/api/users/route.ts
import { createClient, createAdminClient, isAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendWelcomeEmail } from '@/lib/notifications'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  can_add_stock: z.boolean().default(false),
  can_remove_stock: z.boolean().default(false),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, email, password, can_add_stock, can_remove_stock } = parsed.data
  const admin = createAdminClient()

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    name,
    email,
    role: 'user',
    can_add_stock,
    can_remove_stock,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {})
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  try {
    await sendWelcomeEmail(name, email, password)
  } catch (_) {
    // email failure is non-blocking
  }

  return NextResponse.json({ id: authUser.user.id }, { status: 201 })
}
```

- [ ] **Step 2: Write PATCH + DELETE /api/users/[id]**

```typescript
// app/api/users/[id]/route.ts
import { createClient, createAdminClient, isAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  can_add_stock: z.boolean().optional(),
  can_remove_stock: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, email, password, can_add_stock, can_remove_stock, is_active } = parsed.data
  const admin = createAdminClient()

  // Update auth.users fields if provided
  const authUpdates: Record<string, unknown> = {}
  if (email) authUpdates.email = email
  if (password) authUpdates.password = password
  if (Object.keys(authUpdates).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(id, authUpdates)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update profiles row
  const profileUpdates: Record<string, unknown> = {}
  if (name !== undefined) profileUpdates.name = name
  if (email !== undefined) profileUpdates.email = email
  if (can_add_stock !== undefined) profileUpdates.can_add_stock = can_add_stock
  if (can_remove_stock !== undefined) profileUpdates.can_remove_stock = can_remove_stock
  if (is_active !== undefined) profileUpdates.is_active = is_active

  const { error } = await admin.from('profiles').update(profileUpdates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // 10-year ban effectively blocks login
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: '87600h',
  })
  if (banError) return NextResponse.json({ error: banError.message }, { status: 500 })

  const { error } = await admin.from('profiles').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/users/route.ts app/api/users/[id]/route.ts
git commit -m "feat: add users API (GET, POST, PATCH, DELETE)"
```

---

### Task 12: Categories API

**Files:**
- Create: `app/api/categories/route.ts`
- Create: `app/api/categories/[id]/route.ts`

- [ ] **Step 1: Write GET + POST /api/categories**

```typescript
// app/api/categories/route.ts
import { createClient, createAdminClient, getUserProfile } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canManageStock } from '@/lib/permissions'

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('categories').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile || !canManageStock(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('categories')
    .insert({ name: parsed.data.name, description: parsed.data.description ?? null, created_by: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write PATCH + DELETE /api/categories/[id]**

```typescript
// app/api/categories/[id]/route.ts
import { createClient, createAdminClient, getUserProfile } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canManageStock, canDeleteCategory } from '@/lib/permissions'

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile || !canManageStock(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('categories')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile || !canDeleteCategory(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Block delete if any products (including archived) reference this category
  const { count } = await admin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} product(s) use this category` },
      { status: 400 }
    )
  }

  const { error } = await admin.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/categories/route.ts app/api/categories/[id]/route.ts
git commit -m "feat: add categories API (GET, POST, PATCH, DELETE)"
```

---

### Task 13: Products API

**Files:**
- Create: `app/api/products/route.ts`
- Create: `app/api/products/[id]/route.ts`

**Before writing this task**, add the helper RPC function to your Supabase DB (run in SQL Editor):

```sql
create or replace function public.get_products_with_quantity(
  p_search text default null,
  p_category_id uuid default null,
  p_include_archived boolean default false
)
returns table(
  id uuid, name text, category_id uuid, description text,
  low_stock_threshold integer, is_archived boolean,
  created_by uuid, created_at timestamptz,
  current_quantity integer, category_name text
)
language sql stable security definer as $$
  select
    p.id, p.name, p.category_id, p.description,
    p.low_stock_threshold, p.is_archived,
    p.created_by, p.created_at,
    public.product_current_quantity(p.id) as current_quantity,
    c.name as category_name
  from public.products p
  join public.categories c on c.id = p.category_id
  where (p_include_archived or not p.is_archived)
    and (p_search is null or p.name ilike '%' || p_search || '%')
    and (p_category_id is null or p.category_id = p_category_id)
  order by p.name;
$$;
```

- [ ] **Step 1: Write GET + POST /api/products**

```typescript
// app/api/products/route.ts
import { createClient, createAdminClient, getUserProfile } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canManageStock } from '@/lib/permissions'

const createProductSchema = z.object({
  name: z.string().min(1),
  category_id: z.string().uuid(),
  description: z.string().optional(),
  low_stock_threshold: z.number().int().nonnegative(),
  initial_quantity: z.number().int().nonnegative().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || null
  const categoryId = searchParams.get('category_id') || null
  const includeArchived = searchParams.get('include_archived') === 'true'

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_products_with_quantity', {
    p_search: search,
    p_category_id: categoryId,
    p_include_archived: includeArchived,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile || !canManageStock(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, category_id, description, low_stock_threshold, initial_quantity } = parsed.data
  const admin = createAdminClient()

  const { data: product, error: productError } = await admin
    .from('products')
    .insert({ name, category_id, description: description ?? null, low_stock_threshold, created_by: user.id })
    .select()
    .single()
  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })

  if (initial_quantity && initial_quantity > 0) {
    await admin.from('stock_movements').insert({
      product_id: product.id,
      quantity: initial_quantity,
      movement_type: 'add',
      note: 'Initial stock',
      performed_by: user.id,
    })
  }

  return NextResponse.json(product, { status: 201 })
}
```

- [ ] **Step 2: Write PATCH + DELETE /api/products/[id]**

```typescript
// app/api/products/[id]/route.ts
import { createClient, createAdminClient, getUserProfile } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canManageStock, canArchiveProduct } from '@/lib/permissions'

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
  category_id: z.string().uuid().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile || !canManageStock(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile || !canArchiveProduct(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('products').update({ is_archived: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/products/route.ts app/api/products/[id]/route.ts
git commit -m "feat: add products API (GET, POST, PATCH, archive)"
```

---

### Task 14: Movements API

**Files:**
- Create: `app/api/movements/route.ts`

- [ ] **Step 1: Write GET + POST /api/movements**

```typescript
// app/api/movements/route.ts
import {
  createClient, createAdminClient, getUserProfile, getAllAdminEmails
} from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canAddStock, canRemoveStock, canRecordCorrection } from '@/lib/permissions'
import { sendLowStockAlert } from '@/lib/notifications'

const createMovementSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1),           // always the positive magnitude
  movement_type: z.enum(['add', 'remove', 'correction']),
  note: z.string().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('product_id')
  const performedBy = searchParams.get('performed_by')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const offset = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from('stock_movements')
    .select('*, products(name, categories(name)), profiles(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (productId) query = query.eq('product_id', productId)
  if (performedBy) query = query.eq('performed_by', performedBy)
  if (type) query = query.eq('movement_type', type)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createMovementSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { product_id, quantity, movement_type, note } = parsed.data

  // Permission check per movement type
  if (movement_type === 'add' && !canAddStock(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (movement_type === 'remove' && !canRemoveStock(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (movement_type === 'correction') {
    if (!canRecordCorrection(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!note || note.trim() === '') {
      return NextResponse.json({ error: 'Note is required for corrections' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  // Load product for threshold check
  const { data: product, error: productError } = await admin
    .from('products')
    .select('name, low_stock_threshold')
    .eq('id', product_id)
    .single()
  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Get current quantity before movement
  const { data: oldQtyResult } = await admin.rpc('product_current_quantity', { p_id: product_id })
  const oldQty: number = oldQtyResult ?? 0

  // Determine signed quantity for storage
  const actualQuantity = movement_type === 'remove' ? -quantity : quantity

  // Prevent negative stock for all movement types
  if (oldQty + actualQuantity < 0) {
    return NextResponse.json(
      { error: `Insufficient stock: current quantity is ${oldQty}` },
      { status: 400 }
    )
  }

  const { data: movement, error: movementError } = await admin
    .from('stock_movements')
    .insert({ product_id, quantity: actualQuantity, movement_type, note: note ?? null, performed_by: user.id })
    .select()
    .single()
  if (movementError) return NextResponse.json({ error: movementError.message }, { status: 500 })

  // Low-stock crossing alert (fires only when crossing from above to at-or-below threshold)
  const newQty = oldQty + actualQuantity
  if (oldQty > product.low_stock_threshold && newQty <= product.low_stock_threshold) {
    getAllAdminEmails().then(emails =>
      sendLowStockAlert(product.name, newQty, product.low_stock_threshold, emails).catch(() => {})
    )
  }

  return NextResponse.json(movement, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/movements/route.ts
git commit -m "feat: add movements API with low-stock threshold alert"
```

---

### Task 15: Reports API

**Files:**
- Create: `app/api/reports/route.ts`

- [ ] **Step 1: Write GET /api/reports**

```typescript
// app/api/reports/route.ts
import { createClient, createAdminClient, isAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') ?? 'name_asc'
  const categoryId = searchParams.get('category_id') || null
  const lowStockOnly = searchParams.get('low_stock_only') === 'true'

  const admin = createAdminClient()

  // Fetch all products with quantity (including archived=false)
  const { data: products, error } = await admin.rpc('get_products_with_quantity', {
    p_search: null,
    p_category_id: categoryId,
    p_include_archived: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get last movement date per product
  const { data: lastMovements } = await admin
    .from('stock_movements')
    .select('product_id, created_at')
    .order('created_at', { ascending: false })

  const lastMovementMap: Record<string, string> = {}
  for (const m of lastMovements ?? []) {
    if (!lastMovementMap[m.product_id]) lastMovementMap[m.product_id] = m.created_at
  }

  let result = (products ?? []).map((p: any) => ({
    ...p,
    last_movement_at: lastMovementMap[p.id] ?? null,
  }))

  if (lowStockOnly) {
    result = result.filter((p: any) => p.current_quantity <= p.low_stock_threshold)
  }

  if (sort === 'qty_asc') result.sort((a: any, b: any) => a.current_quantity - b.current_quantity)
  else if (sort === 'qty_desc') result.sort((a: any, b: any) => b.current_quantity - a.current_quantity)
  else result.sort((a: any, b: any) => a.name.localeCompare(b.name))

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "feat: add reports API"
```

---

### Task 16: Users page (admin only)

**Files:**
- Create: `app/(app)/users/page.tsx`
- Create: `components/users/users-client.tsx`

- [ ] **Step 1: Write the server page**

```typescript
// app/(app)/users/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersClient } from '@/components/users/users-client'
import type { Profile } from '@/types'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/inventory')

  const { data: users } = await admin.from('profiles').select('*').order('name')

  return <UsersClient initialUsers={(users ?? []) as Profile[]} />
}
```

- [ ] **Step 2: Write the client component**

```typescript
// components/users/users-client.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import type { Profile } from '@/types'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  can_add_stock: z.boolean(),
  can_remove_stock: z.boolean(),
})

const editSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional().or(z.literal('')),
  can_add_stock: z.boolean(),
  can_remove_stock: z.boolean(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

export function UsersClient({ initialUsers }: { initialUsers: Profile[] }) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', email: '', password: '', can_add_stock: false, can_remove_stock: false },
  })

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  })

  async function handleCreate(data: CreateForm) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to create user')
      return
    }
    toast.success('User created and welcome email sent')
    setCreateOpen(false)
    createForm.reset()
    const updated = await fetch('/api/users').then(r => r.json())
    setUsers(updated)
  }

  async function handleEdit(data: EditForm) {
    if (!editUser) return
    const body: Record<string, unknown> = {
      name: data.name,
      can_add_stock: data.can_add_stock,
      can_remove_stock: data.can_remove_stock,
    }
    if (data.email) body.email = data.email
    if (data.password) body.password = data.password
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to update user')
      return
    }
    toast.success('User updated')
    setEditUser(null)
    const updated = await fetch('/api/users').then(r => r.json())
    setUsers(updated)
  }

  async function handleToggleActive(user: Profile) {
    if (user.is_active) {
      // Deactivate
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to deactivate user'); return }
      toast.success('User deactivated')
    } else {
      // Reactivate: unban + set is_active = true
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      if (!res.ok) { toast.error('Failed to reactivate user'); return }
      // Also remove ban via auth admin — handled server-side when is_active sets ban_duration to 'none'
      toast.success('User reactivated')
    }
    const updated = await fetch('/api/users').then(r => r.json())
    setUsers(updated)
  }

  function openEdit(user: Profile) {
    setEditUser(user)
    editForm.reset({
      name: user.name,
      email: '',
      password: '',
      can_add_stock: user.can_add_stock,
      can_remove_stock: user.can_remove_stock,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...createForm.register('name')} />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-red-500">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...createForm.register('email')} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" {...createForm.register('password')} />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={createForm.watch('can_add_stock')}
                    onCheckedChange={v => createForm.setValue('can_add_stock', v)}
                  />
                  <Label>Can Add Stock</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={createForm.watch('can_remove_stock')}
                    onCheckedChange={v => createForm.setValue('can_remove_stock', v)}
                  />
                  <Label>Can Remove Stock</Label>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createForm.formState.isSubmitting}>
                {createForm.formState.isSubmitting ? 'Creating…' : 'Create User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Add Stock</TableHead>
            <TableHead>Remove Stock</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(u => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.can_add_stock ? '✓' : '—'}</TableCell>
              <TableCell>{u.can_remove_stock ? '✓' : '—'}</TableCell>
              <TableCell>
                <Badge variant={u.is_active ? 'default' : 'secondary'}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Edit</Button>
                <Button
                  size="sm"
                  variant={u.is_active ? 'destructive' : 'outline'}
                  onClick={() => handleToggleActive(u)}
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => { if (!open) setEditUser(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...editForm.register('name')} />
            </div>
            <div className="space-y-2">
              <Label>New Email (leave blank to keep current)</Label>
              <Input type="email" {...editForm.register('email')} />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input type="password" {...editForm.register('password')} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.watch('can_add_stock')}
                  onCheckedChange={v => editForm.setValue('can_add_stock', v)}
                />
                <Label>Can Add Stock</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.watch('can_remove_stock')}
                  onCheckedChange={v => editForm.setValue('can_remove_stock', v)}
                />
                <Label>Can Remove Stock</Label>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={editForm.formState.isSubmitting}>
              {editForm.formState.isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Handle reactivation — update /api/users/[id] PATCH to unban when is_active=true**

In `app/api/users/[id]/route.ts` PATCH, add inside the `if (is_active !== undefined)` block:

```typescript
// Inside PATCH, after profileUpdates assignment
if (is_active === true) {
  // Lift the ban so the user can log in again
  await admin.auth.admin.updateUserById(id, { ban_duration: 'none' }).catch(() => {})
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(app)/users/page.tsx components/users/users-client.tsx app/api/users/[id]/route.ts
git commit -m "feat: add users page with create/edit/deactivate"
```

---

### Task 17: Categories page

**Files:**
- Create: `app/(app)/categories/page.tsx`
- Create: `components/categories/categories-client.tsx`

- [ ] **Step 1: Write the server page**

```typescript
// app/(app)/categories/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CategoriesClient } from '@/components/categories/categories-client'
import type { Category, Profile } from '@/types'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  const { data: categories } = await admin.from('categories').select('*').order('name')

  // Count products per category
  const { data: productCounts } = await admin
    .from('products')
    .select('category_id')
  const countMap: Record<string, number> = {}
  for (const p of productCounts ?? []) {
    countMap[p.category_id] = (countMap[p.category_id] ?? 0) + 1
  }

  return (
    <CategoriesClient
      initialCategories={(categories ?? []) as Category[]}
      productCounts={countMap}
      profile={profile as Profile}
    />
  )
}
```

- [ ] **Step 2: Write the client component**

```typescript
// components/categories/categories-client.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { canManageStock, canDeleteCategory } from '@/lib/permissions'
import type { Category, Profile } from '@/types'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})
type CategoryForm = z.infer<typeof categorySchema>

export function CategoriesClient({
  initialCategories,
  productCounts,
  profile,
}: {
  initialCategories: Category[]
  productCounts: Record<string, number>
  profile: Profile
}) {
  const [categories, setCategories] = useState(initialCategories)
  const [counts, setCounts] = useState(productCounts)
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  })

  async function refresh() {
    const cats = await fetch('/api/categories').then(r => r.json())
    setCategories(cats)
  }

  async function handleCreate(data: CategoryForm) {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error('Failed to create category'); return }
    toast.success('Category created')
    setCreateOpen(false)
    form.reset()
    await refresh()
  }

  async function handleEdit(data: CategoryForm) {
    if (!editCategory) return
    const res = await fetch(`/api/categories/${editCategory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error('Failed to update category'); return }
    toast.success('Category updated')
    setEditCategory(null)
    await refresh()
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete "${cat.name}"?`)) return
    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
    const body = await res.json()
    if (!res.ok) { toast.error(body.error ?? 'Failed to delete'); return }
    toast.success('Category deleted')
    await refresh()
  }

  const canManage = canManageStock(profile)
  const canDelete = canDeleteCategory(profile)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button>New Category</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input {...form.register('description')} />
                </div>
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{cat.name}</p>
              {cat.description && <p className="text-sm text-gray-500">{cat.description}</p>}
              <Badge variant="secondary" className="mt-1">{counts[cat.id] ?? 0} products</Badge>
            </div>
            <div className="flex gap-2">
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => {
                  setEditCategory(cat)
                  form.reset({ name: cat.name, description: cat.description ?? '' })
                }}>Edit</Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={(counts[cat.id] ?? 0) > 0}
                  title={(counts[cat.id] ?? 0) > 0 ? 'Cannot delete: products exist' : undefined}
                  onClick={() => handleDelete(cat)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editCategory} onOpenChange={open => { if (!open) setEditCategory(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input {...form.register('description')} />
            </div>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/categories/page.tsx components/categories/categories-client.tsx
git commit -m "feat: add categories page with create/edit/delete"
```

---

### Task 18: Inventory page

**Files:**
- Create: `app/(app)/inventory/page.tsx`
- Create: `components/inventory/inventory-client.tsx`

- [ ] **Step 1: Write the server page**

```typescript
// app/(app)/inventory/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InventoryClient } from '@/components/inventory/inventory-client'
import type { Profile, Category, ProductWithQuantity } from '@/types'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  const { data: categories } = await admin.from('categories').select('*').order('name')
  const { data: products } = await admin.rpc('get_products_with_quantity', {
    p_search: null,
    p_category_id: null,
    p_include_archived: false,
  })

  return (
    <InventoryClient
      initialProducts={(products ?? []) as ProductWithQuantity[]}
      categories={(categories ?? []) as Category[]}
      profile={profile as Profile}
    />
  )
}
```

- [ ] **Step 2: Write the client component**

```typescript
// components/inventory/inventory-client.tsx
'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { canAddStock, canRemoveStock, canManageStock } from '@/lib/permissions'
import type { Profile, Category, ProductWithQuantity } from '@/types'

const movementSchema = z.object({
  quantity: z.number({ required_error: 'Required' }).int().min(1, 'Must be at least 1'),
  note: z.string().optional(),
})

const newProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category_id: z.string().min(1, 'Category is required'),
  new_category_name: z.string().optional(),
  description: z.string().optional(),
  low_stock_threshold: z.number({ required_error: 'Required' }).int().nonnegative(),
  initial_quantity: z.number().int().nonnegative().optional(),
})

type MovementForm = z.infer<typeof movementSchema>
type NewProductForm = z.infer<typeof newProductSchema>

function stockColor(qty: number, threshold: number) {
  if (qty <= threshold) return 'text-red-600 font-semibold'
  if (qty <= threshold * 1.5) return 'text-yellow-600 font-semibold'
  return 'text-gray-900'
}

export function InventoryClient({
  initialProducts,
  categories,
  profile,
}: {
  initialProducts: ProductWithQuantity[]
  categories: Category[]
  profile: Profile
}) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [activeSheet, setActiveSheet] = useState<{ product: ProductWithQuantity; type: 'add' | 'remove' } | null>(null)
  const [newProductOpen, setNewProductOpen] = useState(false)
  const [categoryList, setCategoryList] = useState(categories)

  const movementForm = useForm<MovementForm>({ resolver: zodResolver(movementSchema) })
  const productForm = useForm<NewProductForm>({ resolver: zodResolver(newProductSchema) })

  const fetchProducts = useCallback(async (q: string) => {
    const res = await fetch(`/api/products?search=${encodeURIComponent(q)}`)
    const data = await res.json()
    setProducts(data)
  }, [])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    const debounce = setTimeout(() => fetchProducts(e.target.value), 350)
    return () => clearTimeout(debounce)
  }

  async function handleMovement(data: MovementForm) {
    if (!activeSheet) return
    const res = await fetch('/api/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: activeSheet.product.id,
        quantity: data.quantity,
        movement_type: activeSheet.type,
        note: data.note,
      }),
    })
    const body = await res.json()
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return }
    toast.success(`Stock ${activeSheet.type === 'add' ? 'added' : 'removed'} successfully`)
    setActiveSheet(null)
    movementForm.reset()
    await fetchProducts(search)
  }

  async function handleNewProduct(data: NewProductForm) {
    let categoryId = data.category_id
    if (data.category_id === '__new__' && data.new_category_name) {
      const catRes = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.new_category_name }),
      })
      if (!catRes.ok) { toast.error('Failed to create category'); return }
      const cat = await catRes.json()
      categoryId = cat.id
      setCategoryList(prev => [...prev, cat])
    }
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, category_id: categoryId }),
    })
    if (!res.ok) { toast.error('Failed to create product'); return }
    toast.success('Product created')
    setNewProductOpen(false)
    productForm.reset()
    await fetchProducts(search)
  }

  const canAdd = canAddStock(profile)
  const canRemove = canRemoveStock(profile)
  const canCreate = canManageStock(profile)
  const watchCategoryId = productForm.watch('category_id')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
        {canCreate && (
          <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
            <DialogTrigger asChild><Button>New Product</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
              <form onSubmit={productForm.handleSubmit(handleNewProduct)} className="space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input {...productForm.register('name')} />
                  {productForm.formState.errors.name && (
                    <p className="text-xs text-red-500">{productForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select onValueChange={v => productForm.setValue('category_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categoryList.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ New category…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {watchCategoryId === '__new__' && (
                  <div className="space-y-1">
                    <Label>New Category Name</Label>
                    <Input {...productForm.register('new_category_name')} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Description (optional)</Label>
                  <Input {...productForm.register('description')} />
                </div>
                <div className="space-y-1">
                  <Label>Low Stock Threshold *</Label>
                  <Input
                    type="number"
                    min={0}
                    {...productForm.register('low_stock_threshold', { valueAsNumber: true })}
                  />
                  {productForm.formState.errors.low_stock_threshold && (
                    <p className="text-xs text-red-500">
                      {productForm.formState.errors.low_stock_threshold.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Initial Quantity (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    {...productForm.register('initial_quantity', { valueAsNumber: true })}
                  />
                </div>
                <Button type="submit" className="w-full">Create Product</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{product.name}</p>
              <Badge variant="outline" className="text-xs">{product.category_name}</Badge>
              {product.description && (
                <p className="text-xs text-gray-500 mt-1">{product.description}</p>
              )}
              <p className={`mt-1 text-sm ${stockColor(product.current_quantity, product.low_stock_threshold)}`}>
                Qty: {product.current_quantity} / Threshold: {product.low_stock_threshold}
              </p>
            </div>
            <div className="flex gap-2">
              {canAdd && (
                <Sheet
                  open={activeSheet?.product.id === product.id && activeSheet.type === 'add'}
                  onOpenChange={open => {
                    if (open) { setActiveSheet({ product, type: 'add' }); movementForm.reset() }
                    else setActiveSheet(null)
                  }}
                >
                  <SheetTrigger asChild>
                    <Button size="sm" variant="outline">Add Stock</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader><SheetTitle>Add Stock — {product.name}</SheetTitle></SheetHeader>
                    <form onSubmit={movementForm.handleSubmit(handleMovement)} className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" min={1} {...movementForm.register('quantity', { valueAsNumber: true })} />
                        {movementForm.formState.errors.quantity && (
                          <p className="text-xs text-red-500">{movementForm.formState.errors.quantity.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Note (optional)</Label>
                        <Input {...movementForm.register('note')} />
                      </div>
                      <Button type="submit" className="w-full">Confirm Add</Button>
                    </form>
                  </SheetContent>
                </Sheet>
              )}
              {canRemove && (
                <Sheet
                  open={activeSheet?.product.id === product.id && activeSheet.type === 'remove'}
                  onOpenChange={open => {
                    if (open) { setActiveSheet({ product, type: 'remove' }); movementForm.reset() }
                    else setActiveSheet(null)
                  }}
                >
                  <SheetTrigger asChild>
                    <Button size="sm" variant="outline">Remove Stock</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader><SheetTitle>Remove Stock — {product.name}</SheetTitle></SheetHeader>
                    <form onSubmit={movementForm.handleSubmit(handleMovement)} className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" min={1} {...movementForm.register('quantity', { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Note (optional)</Label>
                        <Input {...movementForm.register('note')} />
                      </div>
                      <Button type="submit" variant="destructive" className="w-full">Confirm Remove</Button>
                    </form>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-center text-gray-500 py-8">No products found.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/inventory/page.tsx components/inventory/inventory-client.tsx
git commit -m "feat: add inventory page with search, stock drawers, new product modal"
```

---

### Task 19: Products page

**Files:**
- Create: `app/(app)/products/page.tsx`
- Create: `components/products/products-client.tsx`

- [ ] **Step 1: Write the server page**

```typescript
// app/(app)/products/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProductsClient } from '@/components/products/products-client'
import type { Profile, Category, ProductWithQuantity } from '@/types'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  const { data: categories } = await admin.from('categories').select('*').order('name')
  const { data: products } = await admin.rpc('get_products_with_quantity', {
    p_search: null,
    p_category_id: null,
    p_include_archived: false,
  })

  return (
    <ProductsClient
      initialProducts={(products ?? []) as ProductWithQuantity[]}
      categories={(categories ?? []) as Category[]}
      profile={profile as Profile}
    />
  )
}
```

- [ ] **Step 2: Write the client component**

```typescript
// components/products/products-client.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { canManageStock, canArchiveProduct } from '@/lib/permissions'
import type { Profile, Category, ProductWithQuantity } from '@/types'

const editSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
  category_id: z.string().uuid().optional(),
})
type EditForm = z.infer<typeof editSchema>

export function ProductsClient({
  initialProducts,
  categories,
  profile,
}: {
  initialProducts: ProductWithQuantity[]
  categories: Category[]
  profile: Profile
}) {
  const [products, setProducts] = useState(initialProducts)
  const [editProduct, setEditProduct] = useState<ProductWithQuantity | null>(null)

  const form = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  async function refresh() {
    const data = await fetch('/api/products').then(r => r.json())
    setProducts(data)
  }

  async function handleEdit(data: EditForm) {
    if (!editProduct) return
    const res = await fetch(`/api/products/${editProduct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error('Failed to update product'); return }
    toast.success('Product updated')
    setEditProduct(null)
    await refresh()
  }

  async function handleArchive(product: ProductWithQuantity) {
    if (!confirm(`Archive "${product.name}"? It will be hidden from inventory.`)) return
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to archive product'); return }
    toast.success('Product archived')
    await refresh()
  }

  const canEdit = canManageStock(profile)
  const canArchive = canArchiveProduct(profile)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Products</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Current Qty</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Status</TableHead>
            {(canEdit || canArchive) && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map(p => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>{p.category_name}</TableCell>
              <TableCell className={p.current_quantity <= p.low_stock_threshold ? 'text-red-600 font-semibold' : ''}>
                {p.current_quantity}
              </TableCell>
              <TableCell>{p.low_stock_threshold}</TableCell>
              <TableCell>
                <Badge variant={p.current_quantity <= p.low_stock_threshold ? 'destructive' : 'default'}>
                  {p.current_quantity <= p.low_stock_threshold ? 'Low Stock' : 'OK'}
                </Badge>
              </TableCell>
              {(canEdit || canArchive) && (
                <TableCell className="flex gap-2">
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditProduct(p)
                      form.reset({
                        name: p.name,
                        description: p.description ?? '',
                        low_stock_threshold: p.low_stock_threshold,
                        category_id: p.category_id,
                      })
                    }}>Edit</Button>
                  )}
                  {canArchive && (
                    <Button size="sm" variant="destructive" onClick={() => handleArchive(p)}>Archive</Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editProduct} onOpenChange={open => { if (!open) setEditProduct(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                defaultValue={editProduct?.category_id}
                onValueChange={v => form.setValue('category_id', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input {...form.register('description')} />
            </div>
            <div className="space-y-2">
              <Label>Low Stock Threshold</Label>
              <Input
                type="number"
                min={0}
                {...form.register('low_stock_threshold', { valueAsNumber: true })}
              />
            </div>
            <Button type="submit" className="w-full">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/products/page.tsx components/products/products-client.tsx
git commit -m "feat: add products page with edit and archive"
```

---

### Task 20: History page

**Files:**
- Create: `app/(app)/history/page.tsx`
- Create: `components/history/history-client.tsx`

- [ ] **Step 1: Write the server page**

```typescript
// app/(app)/history/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HistoryClient } from '@/components/history/history-client'
import type { Profile, MovementWithDetails } from '@/types'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  const { data: result } = await admin
    .from('stock_movements')
    .select('*, products(name, categories(name)), profiles(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <HistoryClient
      initialMovements={(result ?? []) as MovementWithDetails[]}
      profile={profile as Profile}
    />
  )
}
```

- [ ] **Step 2: Write the client component**

```typescript
// components/history/history-client.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { generateMovementsCSV } from '@/lib/export/csv'
import { canExportData } from '@/lib/permissions'
import type { Profile, MovementWithDetails } from '@/types'

export function HistoryClient({
  initialMovements,
  profile,
}: {
  initialMovements: MovementWithDetails[]
  profile: Profile
}) {
  const [movements, setMovements] = useState(initialMovements)
  const [typeFilter, setTypeFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function applyFilters() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    const res = await fetch(`/api/movements?${params}`)
    const body = await res.json()
    setMovements(body.data ?? [])
    setLoading(false)
  }

  function handleExportCSV() {
    const csv = generateMovementsCSV(movements)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Log exported')
  }

  const canExport = canExportData(profile)

  function typeBadgeVariant(type: string) {
    if (type === 'add') return 'default'
    if (type === 'remove') return 'destructive'
    return 'secondary'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">History</h1>
        {canExport && (
          <Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-gray-500 mb-1">Type</p>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="add">Add</SelectItem>
              <SelectItem value="remove">Remove</SelectItem>
              <SelectItem value="correction">Correction</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">From</p>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">To</p>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
        </div>
        <Button onClick={applyFilters} disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map(m => (
            <TableRow key={m.id}>
              <TableCell className="text-xs text-gray-500">
                {new Date(m.created_at).toLocaleString()}
              </TableCell>
              <TableCell>{m.products.name}</TableCell>
              <TableCell>{m.products.categories.name}</TableCell>
              <TableCell>
                <Badge variant={typeBadgeVariant(m.movement_type)}>{m.movement_type}</Badge>
              </TableCell>
              <TableCell className={m.quantity < 0 ? 'text-red-600' : 'text-green-700'}>
                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
              </TableCell>
              <TableCell className="text-sm text-gray-500">{m.note ?? '—'}</TableCell>
              <TableCell>{m.profiles?.name ?? '—'}</TableCell>
            </TableRow>
          ))}
          {movements.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500 py-6">
                No movements found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/history/page.tsx components/history/history-client.tsx
git commit -m "feat: add history page with filters and CSV export"
```

---

### Task 21: Dashboard page (admin only)

**Files:**
- Create: `app/(app)/dashboard/page.tsx`
- Create: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Write the server page**

```typescript
// app/(app)/dashboard/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import type { Profile, ProductWithQuantity } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/inventory')

  const { data: products } = await admin.rpc('get_products_with_quantity', {
    p_search: null,
    p_category_id: null,
    p_include_archived: false,
  })

  const { data: categories } = await admin.from('categories').select('*').order('name')

  const { data: lastMovement } = await admin
    .from('stock_movements')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <DashboardClient
      products={(products ?? []) as ProductWithQuantity[]}
      categories={categories ?? []}
      lastMovementAt={lastMovement?.created_at ?? null}
    />
  )
}
```

- [ ] **Step 2: Write the client component**

```typescript
// components/dashboard/dashboard-client.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import type { ProductWithQuantity } from '@/types'

type Category = { id: string; name: string }
type SortKey = 'name_asc' | 'qty_asc' | 'qty_desc'

export function DashboardClient({
  products,
  categories,
  lastMovementAt,
}: {
  products: ProductWithQuantity[]
  categories: Category[]
  lastMovementAt: string | null
}) {
  const [sort, setSort] = useState<SortKey>('name_asc')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const lowStockCount = products.filter(p => p.current_quantity <= p.low_stock_threshold).length

  function sorted(prods: ProductWithQuantity[]) {
    const filtered = lowStockOnly ? prods.filter(p => p.current_quantity <= p.low_stock_threshold) : prods
    if (sort === 'qty_asc') return [...filtered].sort((a, b) => a.current_quantity - b.current_quantity)
    if (sort === 'qty_desc') return [...filtered].sort((a, b) => b.current_quantity - a.current_quantity)
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Products</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{products.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Categories</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{categories.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Low Stock</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${lowStockCount > 0 ? 'text-red-600' : ''}`}>{lowStockCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Last Movement</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {lastMovementAt ? new Date(lastMovementAt).toLocaleString() : 'None'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sort + filter controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Sort by</Label>
          <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name A → Z</SelectItem>
              <SelectItem value="qty_asc">Qty Low → High</SelectItem>
              <SelectItem value="qty_desc">Qty High → Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          <Label>Low stock only</Label>
        </div>
      </div>

      {/* Category-wise table */}
      {categories.map(cat => {
        const catProducts = sorted(products.filter(p => p.category_id === cat.id))
        if (catProducts.length === 0) return null
        return (
          <div key={cat.id} className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="font-semibold">{cat.name}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Product</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Current Qty</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Threshold</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {catProducts.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className={`px-4 py-2 text-right ${p.current_quantity <= p.low_stock_threshold ? 'text-red-600 font-semibold' : ''}`}>
                      {p.current_quantity}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{p.low_stock_threshold}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant={p.current_quantity <= p.low_stock_threshold ? 'destructive' : 'default'}>
                        {p.current_quantity <= p.low_stock_threshold ? 'Low' : 'OK'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/dashboard/page.tsx components/dashboard/dashboard-client.tsx
git commit -m "feat: add dashboard page with summary cards and category table"
```

---

### Task 22: Reports page (admin only)

**Files:**
- Create: `app/(app)/reports/page.tsx`
- Create: `components/reports/reports-client.tsx`

- [ ] **Step 1: Write the server page**

```typescript
// app/(app)/reports/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsClient } from '@/components/reports/reports-client'
import type { Profile, Category } from '@/types'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/inventory')

  const { data: categories } = await admin.from('categories').select('*').order('name')

  return <ReportsClient categories={(categories ?? []) as Category[]} />
}
```

- [ ] **Step 2: Write the client component**

```typescript
// components/reports/reports-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { generateInventoryCSV } from '@/lib/export/csv'
import { generateInventoryPDF } from '@/lib/export/pdf'
import type { ProductWithQuantity, Category } from '@/types'

type ReportProduct = ProductWithQuantity & { last_movement_at: string | null }

export function ReportsClient({ categories }: { categories: Category[] }) {
  const [products, setProducts] = useState<ReportProduct[]>([])
  const [sort, setSort] = useState('name_asc')
  const [categoryId, setCategoryId] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchReports() {
    setLoading(true)
    const params = new URLSearchParams({ sort })
    if (categoryId !== 'all') params.set('category_id', categoryId)
    if (lowStockOnly) params.set('low_stock_only', 'true')
    const data = await fetch(`/api/reports?${params}`).then(r => r.json())
    setProducts(data)
    setLoading(false)
  }

  useEffect(() => { fetchReports() }, [sort, categoryId, lowStockOnly])

  function exportCSV() {
    const csv = generateInventoryCSV(products)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  function exportPDF() {
    const title = `Generated ${new Date().toLocaleString()}`
    const buffer = generateInventoryPDF(products, title)
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('PDF exported')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={loading}>Export CSV</Button>
          <Button variant="outline" onClick={exportPDF} disabled={loading}>Export PDF</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Label>Sort</Label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name A → Z</SelectItem>
              <SelectItem value="qty_asc">Qty Low → High</SelectItem>
              <SelectItem value="qty_desc">Qty High → Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          <Label>Low stock only</Label>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Current Qty</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Movement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-6">Loading…</TableCell></TableRow>
          ) : products.map(p => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>{p.category_name}</TableCell>
              <TableCell className={p.current_quantity <= p.low_stock_threshold ? 'text-red-600 font-semibold' : ''}>
                {p.current_quantity}
              </TableCell>
              <TableCell>{p.low_stock_threshold}</TableCell>
              <TableCell>
                <Badge variant={p.current_quantity <= p.low_stock_threshold ? 'destructive' : 'default'}>
                  {p.current_quantity <= p.low_stock_threshold ? 'Low Stock' : 'OK'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-gray-500">
                {p.last_movement_at ? new Date(p.last_movement_at).toLocaleDateString() : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/reports/page.tsx components/reports/reports-client.tsx
git commit -m "feat: add reports page with CSV and PDF export"
```

---

### Task 23: Settings page (placeholder)

**Files:**
- Create: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Write the placeholder**

```typescript
// app/(app)/settings/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/inventory')

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>
      <p className="text-gray-500">System configuration will appear here in a future update.</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/settings/page.tsx
git commit -m "feat: add settings placeholder page"
```

---

### Task 24: Run tests and deploy to Vercel

**Files:** none (deployment step)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests in `__tests__/permissions.test.ts`, `__tests__/notifications.test.ts`, `__tests__/export.test.ts` pass.

- [ ] **Step 2: Verify the app builds cleanly**

```bash
npm run build
```

Expected: no TypeScript or build errors. Fix any that appear before proceeding.

- [ ] **Step 3: Push to GitHub**

Create a new GitHub repo named `hallmark-inventory`, then:

```bash
git remote add origin https://github.com/<your-org>/hallmark-inventory.git
git push -u origin main
```

- [ ] **Step 4: Deploy to Vercel**

```bash
npx vercel --yes
```

Follow the prompts to link to your Vercel account and project.

- [ ] **Step 5: Set environment variables on Vercel**

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add RESEND_API_KEY production
```

Paste the values from your `.env.local` file when prompted for each.

- [ ] **Step 6: Trigger production deployment**

```bash
npx vercel --prod
```

Expected: deployment URL printed. Visit it and verify login works.

---

## Self-Review

### Spec coverage check

| Spec section | Covered by task |
|---|---|
| Profiles / roles / permission flags | Task 2 (schema), Task 5 (permissions) |
| Categories CRUD | Task 12 (API), Task 17 (UI) |
| Products CRUD + archive | Task 13 (API), Task 19 (UI) |
| Stock movements (append-only) | Task 14 (API), Task 18 (inventory UI), Task 20 (history UI) |
| Correction requires note | Task 14 POST handler |
| Low-stock threshold alert (crossing event only) | Task 14 POST handler, Task 6 (notification lib) |
| Welcome email on user creation | Task 11 POST handler, Task 6 (notification lib) |
| User create / edit / deactivate | Task 11 (API), Task 16 (UI) |
| Reactivate user (unban) | Task 16 step 3 (PATCH is_active=true lifts ban) |
| Inventory page — search + stock drawers + new product | Task 18 |
| New product inline category creation | Task 18 inventory-client.tsx |
| Dashboard (admin) — cards + category table + sort | Task 21 |
| Reports (admin) — table + CSV + PDF | Task 22 |
| History — filters + CSV export | Task 20 |
| Settings placeholder | Task 23 |
| Middleware (auth redirect) | Task 8 |
| Login page | Task 10 |
| Soft delete: products is_archived | Task 13 DELETE handler |
| Soft delete: users is_active + ban | Task 11 DELETE handler |
| Category delete blocked if products exist | Task 12 DELETE handler |
| Stock can't go negative | Task 14 POST handler |
| RLS — select for authenticated | Task 2 (SQL) |
| Export: CSV papaparse, PDF jspdf | Task 7 (lib), Task 20, Task 22 |
| Deploy to Vercel | Task 24 |

### Type consistency

- `ProductWithQuantity.category_name` (string) — used in `generateInventoryCSV`, dashboard, reports — all consistent.
- `MovementWithDetails.products.categories.name` — used in `generateMovementsCSV` and history table — consistent.
- `canManageStock`, `canAddStock`, `canRemoveStock`, etc. — defined in `lib/permissions.ts` Task 5, imported in API routes Tasks 11–14 and UI Tasks 16–20 — all consistent.
- `getAllAdminEmails()` — defined in `lib/supabase/server.ts` Task 4, imported in `app/api/movements/route.ts` Task 14 — consistent.
- `sendLowStockAlert(productName, currentQty, threshold, adminEmails[])` — defined Task 6, called Task 14 — consistent.
- `sendWelcomeEmail(name, email, password)` — defined Task 6, called Task 11 — consistent.
- `get_products_with_quantity` RPC — created in Task 13 note (run in SQL Editor), called in Tasks 13, 15, 21 server pages — consistent.
- Dynamic route params use `{ params: Promise<{ id: string }> }` pattern in Tasks 11–13 — consistent with Next.js 15+ breaking change.

### No placeholder check

All steps contain complete code or exact commands. No "TBD", "TODO", or "implement this" text present.

---

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session with checkpoints. Use `superpowers:executing-plans`.

Which approach would you like?
