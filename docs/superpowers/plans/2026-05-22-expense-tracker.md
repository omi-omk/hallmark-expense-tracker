# Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based multi-worker expense tracking app with owner funding, per-worker balance tracking, receipt image upload, and low-balance email alerts — deployed on Vercel.

**Architecture:** Next.js App Router (TypeScript) for frontend and API routes, Supabase for PostgreSQL database + auth + image storage, and Resend for email notifications. Route groups separate worker UI from owner UI with distinct layouts. Server Components fetch data; Client Components handle forms and interactions.

**Tech Stack:** Next.js 15, Supabase (supabase-js + SSR), Resend, shadcn/ui, Tailwind CSS, react-hook-form, zod, papaparse (CSV), jspdf + jspdf-autotable (PDF), Jest (unit tests)

---

## File Map

```
hallmark/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                        # Centered card layout, no nav
│   │   └── login/page.tsx                    # Login form → /login
│   ├── (worker)/
│   │   ├── layout.tsx                        # Bottom nav bar (mobile-first)
│   │   ├── dashboard/page.tsx                → /dashboard
│   │   └── expenses/
│   │       ├── page.tsx                      → /expenses
│   │       └── new/page.tsx                  → /expenses/new
│   ├── (owner)/
│   │   ├── layout.tsx                        # Sidebar nav
│   │   └── owner/
│   │       ├── dashboard/page.tsx            → /owner/dashboard
│   │       ├── workers/
│   │       │   ├── page.tsx                  → /owner/workers
│   │       │   └── [id]/page.tsx             → /owner/workers/[id]
│   │       ├── reports/page.tsx              → /owner/reports
│   │       └── settings/page.tsx             → /owner/settings
│   ├── api/
│   │   ├── auth/callback/route.ts            # Supabase OAuth callback
│   │   ├── expenses/route.ts                 # POST create expense
│   │   ├── fund-transfers/route.ts           # POST add funds
│   │   ├── workers/
│   │   │   ├── route.ts                      # GET list, POST create
│   │   │   └── [id]/route.ts                 # PATCH update worker
│   │   ├── categories/route.ts               # GET, POST, DELETE
│   │   └── reports/
│   │       ├── route.ts                      # GET filtered expenses
│   │       ├── csv/route.ts                  # GET CSV download
│   │       └── pdf/route.ts                  # GET PDF download
│   ├── layout.tsx                            # Root layout (fonts, providers)
│   └── page.tsx                              # Redirects to /login
├── components/
│   ├── balance-card.tsx                      # ₹ balance display with warning
│   ├── expense-form.tsx                      # Add expense form (client)
│   ├── expense-list.tsx                      # Filterable expense table
│   ├── worker-card.tsx                       # Owner dashboard worker card
│   ├── fund-form.tsx                         # Add funds modal (client)
│   └── nav/
│       ├── worker-nav.tsx                    # Bottom nav for workers
│       └── owner-nav.tsx                     # Sidebar nav for owner
├── lib/
│   ├── supabase/
│   │   ├── client.ts                         # Browser Supabase client
│   │   └── server.ts                         # Server Supabase client (+ admin)
│   ├── balance.ts                            # Pure balance calculation functions
│   ├── notifications.ts                      # Low-balance check + Resend email
│   └── export/
│       ├── csv.ts                            # CSV string generation
│       └── pdf.ts                            # PDF Uint8Array generation
├── middleware.ts                             # Auth guard + role-based routing
├── types/index.ts                            # All shared TypeScript types
├── __tests__/
│   ├── balance.test.ts
│   ├── csv.test.ts
│   └── notifications.test.ts
├── supabase/
│   └── migrations/001_initial.sql           # All tables + RLS + seed data
└── .env.local.example
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json` (via Next.js CLI)
- Create: `.env.local.example`
- Create: `jest.config.ts`

- [ ] **Step 1: Scaffold Next.js project**

Run inside `/Users/aayushibaldi/Desktop/hallmark`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```
Answer the prompts: Yes to all defaults.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr resend
npm install react-hook-form @hookform/resolvers zod
npm install papaparse jspdf jspdf-autotable
npm install --save-dev @types/papaparse jest jest-environment-node @testing-library/jest-dom
```

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init
```
Accept all defaults (New York style, zinc color). Then add components:
```bash
npx shadcn@latest add button input label card badge toast dialog select table separator
```

- [ ] **Step 4: Create environment variables template**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
```

Copy it to `.env.local` and fill in values from your Supabase project dashboard and Resend dashboard.

- [ ] **Step 5: Configure Jest**

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

Add to `package.json` scripts:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: initial Next.js + Supabase + shadcn setup"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Create the SQL migration file**

Create `supabase/migrations/001_initial.sql`:
```sql
-- profiles: extends Supabase auth.users, one row per user
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('owner', 'worker')),
  low_balance_threshold integer not null default 500,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- fund_transfers: each time owner records money sent to a worker
create table public.fund_transfers (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

-- categories: global (owner) + worker-specific
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_global boolean not null default false,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- expenses: every expense a worker records
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  amount integer not null check (amount > 0),
  date date not null default current_date,
  comment text,
  image_url text,
  created_at timestamptz not null default now()
);

-- settings: singleton row for global config
create table public.settings (
  id integer primary key default 1 check (id = 1),
  owner_alert_email text not null default ''
);

-- Seed "Other" category (undeletable, is_system = true)
insert into public.categories (name, is_global, is_system, created_by)
values ('Other', true, true, null);

-- Seed settings row
insert into public.settings (id, owner_alert_email) values (1, '');

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.fund_transfers enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.settings enable row level security;

-- RLS: profiles
-- Users can read their own profile; owner can read all
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Owner reads all profiles" on public.profiles
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- RLS: fund_transfers
-- Workers read their own; owner reads all
create policy "Worker reads own transfers" on public.fund_transfers
  for select using (auth.uid() = worker_id);

create policy "Owner reads all transfers" on public.fund_transfers
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- RLS: categories
-- All authenticated users can read global categories
create policy "All users read global categories" on public.categories
  for select using (is_global = true and auth.uid() is not null);

-- Workers read own categories
create policy "Workers read own categories" on public.categories
  for select using (created_by = auth.uid());

-- RLS: expenses
-- Workers read own; owner reads all
create policy "Worker reads own expenses" on public.expenses
  for select using (auth.uid() = worker_id);

create policy "Owner reads all expenses" on public.expenses
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- RLS: settings
-- Owner reads settings
create policy "Owner reads settings" on public.settings
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );
```

- [ ] **Step 2: Run the SQL in Supabase**

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Paste the entire SQL above
4. Click **Run**
5. Verify in **Table Editor** that you see: `profiles`, `fund_transfers`, `categories`, `expenses`, `settings`
6. Verify `categories` has one row: `Other`

- [ ] **Step 3: Create the owner account**

In Supabase SQL Editor, run:
```sql
-- First create the auth user via Supabase Auth dashboard:
-- Go to Authentication → Users → Add User
-- Email: owner@yourcompany.com, Password: <strong password>
-- Copy the UUID of the new user, then run:

insert into public.profiles (id, name, email, role, low_balance_threshold)
values (
  '<paste-uuid-here>',
  'Owner',
  'owner@yourcompany.com',
  'owner',
  0
);

-- Update settings with owner alert email
update public.settings set owner_alert_email = 'owner@yourcompany.com' where id = 1;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: database schema with RLS and seed data"
```

---

## Task 3: TypeScript Types + Supabase Clients + Middleware

**Files:**
- Create: `types/index.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Define shared types**

Create `types/index.ts`:
```typescript
export type Role = 'owner' | 'worker'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  low_balance_threshold: number
  is_active: boolean
  created_at: string
}

export interface FundTransfer {
  id: string
  worker_id: string
  amount: number
  note: string | null
  created_at: string
}

export interface Category {
  id: string
  name: string
  is_global: boolean
  is_system: boolean
  created_by: string | null
  created_at: string
}

export interface Expense {
  id: string
  worker_id: string
  category_id: string
  amount: number
  date: string
  comment: string | null
  image_url: string | null
  created_at: string
}

export interface Settings {
  owner_alert_email: string
}

export interface WorkerWithBalance extends Profile {
  balance: number
}

export interface ExpenseWithCategory extends Expense {
  categories: { name: string }
}
```

- [ ] **Step 2: Create browser Supabase client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create server Supabase clients**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

// Admin client bypasses RLS and exposes auth.admin — use only in server API routes
export function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 4: Create auth middleware**

Create `middleware.ts`:
```typescript
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const redirect = profile?.role === 'owner' ? '/owner/dashboard' : '/dashboard'
    return NextResponse.redirect(new URL(redirect, request.url))
  }

  if (user && path.startsWith('/owner')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'owner') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
```

- [ ] **Step 5: Update root layout and redirect page**

Replace `app/layout.tsx` with:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Track worker expenses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

Replace `app/page.tsx` with:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

- [ ] **Step 6: Commit**

```bash
git add types/ lib/ middleware.ts app/layout.tsx app/page.tsx
git commit -m "feat: types, Supabase clients, and auth middleware"
```

---

## Task 4: Login Page

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/api/auth/callback/route.ts`

- [ ] **Step 1: Create auth layout**

Create `app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create login page**

Create `app/(auth)/login/page.tsx`:
```tsx
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
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    router.push(profile?.role === 'owner' ? '/owner/dashboard' : '/dashboard')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Expense Tracker</CardTitle>
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
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create Supabase auth callback route**

Create `app/api/auth/callback/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **Step 4: Manual test**

Run `npm run dev`. Open `http://localhost:3000`.
- Verify redirect to `/login`
- Log in with the owner account created in Task 2
- Verify redirect to `/owner/dashboard` (will show 404 for now — that's fine)
- Log out by visiting `/api/auth/signout` — add this route:

Create `app/api/auth/signout/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', 'http://localhost:3000'))
}
```

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: login page and auth routes"
```

---

## Task 5: Balance Calculation (TDD)

**Files:**
- Create: `lib/balance.ts`
- Create: `__tests__/balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/balance.test.ts`:
```typescript
import { calculateBalance, isLowBalance } from '@/lib/balance'

describe('calculateBalance', () => {
  it('returns 0 when no transfers and no expenses', () => {
    expect(calculateBalance([], [])).toBe(0)
  })

  it('returns total funds when no expenses', () => {
    expect(calculateBalance([{ amount: 1000 }, { amount: 500 }], [])).toBe(1500)
  })

  it('deducts expenses from funds', () => {
    expect(calculateBalance([{ amount: 1000 }], [{ amount: 300 }])).toBe(700)
  })

  it('returns negative when expenses exceed funds', () => {
    expect(calculateBalance([{ amount: 200 }], [{ amount: 500 }])).toBe(-300)
  })

  it('handles multiple transfers and multiple expenses', () => {
    expect(
      calculateBalance(
        [{ amount: 1000 }, { amount: 500 }],
        [{ amount: 200 }, { amount: 150 }]
      )
    ).toBe(1150)
  })
})

describe('isLowBalance', () => {
  it('returns true when balance is below threshold', () => {
    expect(isLowBalance(400, 500)).toBe(true)
  })

  it('returns false when balance equals threshold', () => {
    expect(isLowBalance(500, 500)).toBe(false)
  })

  it('returns false when balance is above threshold', () => {
    expect(isLowBalance(600, 500)).toBe(false)
  })

  it('returns true for negative balance with positive threshold', () => {
    expect(isLowBalance(-100, 500)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- balance.test.ts
```
Expected: FAIL — "Cannot find module '@/lib/balance'"

- [ ] **Step 3: Implement balance.ts**

Create `lib/balance.ts`:
```typescript
export function calculateBalance(
  fundTransfers: { amount: number }[],
  expenses: { amount: number }[]
): number {
  const totalFunds = fundTransfers.reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  return totalFunds - totalExpenses
}

export function isLowBalance(balance: number, threshold: number): boolean {
  return balance < threshold
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- balance.test.ts
```
Expected: PASS — 9 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/balance.ts __tests__/balance.test.ts
git commit -m "feat: balance calculation with tests"
```

---

## Task 6: Worker Dashboard

**Files:**
- Create: `app/(worker)/layout.tsx`
- Create: `app/(worker)/dashboard/page.tsx`
- Create: `components/nav/worker-nav.tsx`
- Create: `components/balance-card.tsx`

- [ ] **Step 1: Create worker nav component**

Create `components/nav/worker-nav.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, PlusCircle } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/expenses/new', label: 'Add', icon: PlusCircle },
  { href: '/expenses', label: 'History', icon: Receipt },
]

export function WorkerNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 text-xs ${active ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create worker layout**

Create `app/(worker)/layout.tsx`:
```tsx
import { WorkerNav } from '@/components/nav/worker-nav'

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-lg font-semibold">Expense Tracker</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>
      <WorkerNav />
    </div>
  )
}
```

- [ ] **Step 3: Create balance card component**

Create `components/balance-card.tsx`:
```tsx
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface BalanceCardProps {
  balance: number
  threshold: number
}

export function BalanceCard({ balance, threshold }: BalanceCardProps) {
  const isLow = balance < threshold
  return (
    <Card className={isLow ? 'border-red-300 bg-red-50' : ''}>
      <CardContent className="pt-6">
        {isLow && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Low balance — please inform your manager</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">Your Balance</p>
        <p className={`text-4xl font-bold mt-1 ${isLow ? 'text-red-600' : ''}`}>
          ₹{balance.toLocaleString('en-IN')}
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Create worker dashboard page**

Create `app/(worker)/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { BalanceCard } from '@/components/balance-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { ExpenseWithCategory } from '@/types'

export default async function WorkerDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, transfersRes, expensesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('fund_transfers').select('amount').eq('worker_id', user.id),
    supabase
      .from('expenses')
      .select('*, categories(name)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const profile = profileRes.data
  const transfers = transfersRes.data ?? []
  const recentExpenses = (expensesRes.data ?? []) as ExpenseWithCategory[]
  const allExpenses = recentExpenses

  const balance = calculateBalance(transfers, allExpenses)

  return (
    <div className="space-y-6">
      <BalanceCard balance={balance} threshold={profile?.low_balance_threshold ?? 500} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Expenses</h2>
        <Button asChild size="sm" variant="outline">
          <Link href="/expenses">View all</Link>
        </Button>
      </div>

      {recentExpenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {recentExpenses.map(expense => (
            <Card key={expense.id}>
              <CardContent className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{expense.categories.name}</p>
                  <p className="text-xs text-muted-foreground">{expense.date}</p>
                </div>
                <p className="font-semibold">₹{expense.amount.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button asChild className="w-full">
        <Link href="/expenses/new">+ Add Expense</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Manual test**

Log in as a worker account (create one via Supabase Auth dashboard + profiles row). Visit `/dashboard`. Verify balance shows ₹0 and "No expenses recorded yet."

- [ ] **Step 6: Commit**

```bash
git add app/(worker)/ components/balance-card.tsx components/nav/
git commit -m "feat: worker dashboard with balance card"
```

---

## Task 7: Add Expense (Form + API + Image Upload)

**Files:**
- Create: `app/(worker)/expenses/new/page.tsx`
- Create: `components/expense-form.tsx`
- Create: `app/api/expenses/route.ts`

- [ ] **Step 1: Create expense API route**

Create `app/api/expenses/route.ts`:
```typescript
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkAndNotifyLowBalance } from '@/lib/notifications'
import { calculateBalance, isLowBalance } from '@/lib/balance'
import { z } from 'zod'

const schema = z.object({
  category_id: z.string().uuid(),
  amount: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comment: z.string().optional(),
  image_url: z.string().url().optional().nullable(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: expense, error } = await supabase.from('expenses').insert({
    worker_id: user.id,
    ...parsed.data,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check balance and notify if low
  const [transfersRes, expensesRes, profileRes, settingsRes] = await Promise.all([
    admin.from('fund_transfers').select('amount').eq('worker_id', user.id),
    admin.from('expenses').select('amount').eq('worker_id', user.id),
    admin.from('profiles').select('name, low_balance_threshold').eq('id', user.id).single(),
    admin.from('settings').select('owner_alert_email').single(),
  ])

  const balance = calculateBalance(transfersRes.data ?? [], expensesRes.data ?? [])
  const threshold = profileRes.data?.low_balance_threshold ?? 500

  if (isLowBalance(balance, threshold) && settingsRes.data?.owner_alert_email) {
    await checkAndNotifyLowBalance(
      profileRes.data?.name ?? 'Worker',
      balance,
      threshold,
      settingsRes.data.owner_alert_email
    ).catch(() => {}) // email failure is non-blocking
  }

  return NextResponse.json(expense, { status: 201 })
}
```

- [ ] **Step 2: Create expense form component**

Create `components/expense-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { Category } from '@/types'

const schema = z.object({
  amount: z.coerce.number().int().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  category_id: z.string().uuid('Please select a category'),
  comment: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ExpenseFormProps {
  categories: Category[]
}

export function ExpenseForm({ categories }: ExpenseFormProps) {
  const [image, setImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: today },
  })

  async function uploadImage(file: File, expenseId: string): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `receipts/${expenseId}.${ext}`
    const { error } = await supabase.storage.from('expense-images').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('expense-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function onSubmit(data: FormData) {
    setUploading(true)
    let image_url: string | null = null

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, image_url: null }),
    })

    if (!res.ok) {
      toast({ title: 'Error', description: 'Failed to save expense.', variant: 'destructive' })
      setUploading(false)
      return
    }

    const expense = await res.json()

    if (image) {
      image_url = await uploadImage(image, expense.id)
      if (image_url) {
        await fetch(`/api/expenses/${expense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url }),
        })
      } else {
        toast({ title: 'Note', description: 'Expense saved but image upload failed.' })
      }
    }

    setUploading(false)
    toast({ title: 'Expense added successfully' })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label>Amount (₹)</Label>
        <Input type="number" min={1} placeholder="500" {...register('amount')} />
        {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <Input type="date" max={today} {...register('date')} />
        {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select onValueChange={val => setValue('category_id', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category_id && <p className="text-xs text-red-500">{errors.category_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Comment (optional)</Label>
        <Input placeholder="What was this for?" {...register('comment')} />
      </div>

      <div className="space-y-2">
        <Label>Receipt Photo (optional)</Label>
        <Input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => setImage(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">Max 5 MB. Photo of bill or receipt.</p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || uploading}>
        {isSubmitting || uploading ? 'Saving...' : 'Add Expense'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Add PATCH route for image_url update**

Add to `app/api/expenses/route.ts` — create a new file `app/api/expenses/[id]/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { image_url } = await request.json()
  const { error } = await supabase
    .from('expenses')
    .update({ image_url })
    .eq('id', params.id)
    .eq('worker_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Create Supabase Storage bucket**

In Supabase dashboard:
1. Go to **Storage** → **New bucket**
2. Name: `expense-images`
3. Public: **Yes** (so image URLs work directly)
4. Click **Create**

Then add a storage policy in SQL Editor:
```sql
-- Workers can upload to their own folder; owner can read all
create policy "Workers can upload images" on storage.objects
  for insert with check (bucket_id = 'expense-images' and auth.uid() is not null);

create policy "Anyone can view expense images" on storage.objects
  for select using (bucket_id = 'expense-images');
```

- [ ] **Step 5: Create the add expense page**

Create `app/(worker)/expenses/new/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import type { Category } from '@/types'

export default async function NewExpensePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_global', true)
    .order('name')

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Add Expense</h2>
      <ExpenseForm categories={(categories ?? []) as Category[]} />
    </div>
  )
}
```

- [ ] **Step 6: Manual test**

1. Log in as worker → click "Add"
2. Fill in amount, date, category, comment → submit
3. Verify redirect to dashboard with updated balance
4. Add another expense with a photo — verify image stores in Supabase

- [ ] **Step 7: Commit**

```bash
git add app/ components/expense-form.tsx
git commit -m "feat: add expense form with image upload"
```

---

## Task 8: Expense History Page

**Files:**
- Create: `app/(worker)/expenses/page.tsx`
- Create: `components/expense-list.tsx`

- [ ] **Step 1: Create expense list component**

Create `components/expense-list.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Category, ExpenseWithCategory } from '@/types'

interface ExpenseListProps {
  expenses: ExpenseWithCategory[]
  categories: Category[]
}

export function ExpenseList({ expenses, categories }: ExpenseListProps) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selected, setSelected] = useState<ExpenseWithCategory | null>(null)

  const filtered = expenses.filter(e => {
    if (categoryFilter !== 'all' && e.category_id !== categoryFilter) return false
    if (fromDate && e.date < fromDate) return false
    if (toDate && e.date > toDate) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select onValueChange={setCategoryFilter} defaultValue="all">
          <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses match your filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(expense => (
            <Card key={expense.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(expense)}>
              <CardContent className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{expense.categories.name}</p>
                  <p className="text-xs text-muted-foreground">{expense.date}</p>
                  {expense.comment && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{expense.comment}</p>}
                </div>
                <p className="font-semibold">₹{expense.amount.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.categories.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div><span className="text-sm text-muted-foreground">Amount: </span><span className="font-semibold">₹{selected.amount.toLocaleString('en-IN')}</span></div>
              <div><span className="text-sm text-muted-foreground">Date: </span><span>{selected.date}</span></div>
              {selected.comment && <div><span className="text-sm text-muted-foreground">Comment: </span><span>{selected.comment}</span></div>}
              {selected.image_url && (
                <img src={selected.image_url} alt="Receipt" className="w-full rounded-lg max-h-64 object-contain" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Create expense history page**

Create `app/(worker)/expenses/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseList } from '@/components/expense-list'
import type { Category, ExpenseWithCategory } from '@/types'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [expensesRes, categoriesRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('*, categories(name)')
      .eq('worker_id', user.id)
      .order('date', { ascending: false }),
    supabase.from('categories').select('*').eq('is_global', true).order('name'),
  ])

  const expenses = (expensesRes.data ?? []) as ExpenseWithCategory[]
  const categories = (categoriesRes.data ?? []) as Category[]

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Expense History</h2>
        <p className="text-sm text-muted-foreground">Total: ₹{total.toLocaleString('en-IN')}</p>
      </div>
      <ExpenseList expenses={expenses} categories={categories} />
    </div>
  )
}
```

- [ ] **Step 3: Manual test**

Log in as worker → click "History" → verify expenses list, filters work, clicking shows detail dialog with receipt image.

- [ ] **Step 4: Commit**

```bash
git add app/(worker)/expenses/ components/expense-list.tsx
git commit -m "feat: expense history with filters and detail view"
```

---

## Task 9: Low Balance Notifications (TDD)

**Files:**
- Create: `lib/notifications.ts`
- Create: `__tests__/notifications.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/notifications.test.ts`:
```typescript
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    },
  })),
}))

import { checkAndNotifyLowBalance } from '@/lib/notifications'
import { Resend } from 'resend'

describe('checkAndNotifyLowBalance', () => {
  let mockSend: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    const instance = (Resend as jest.Mock).mock.results[0]?.value
    mockSend = instance?.emails?.send
  })

  it('sends email when balance is below threshold', async () => {
    await checkAndNotifyLowBalance('Ravi Kumar', 300, 500, 'owner@example.com')
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Ravi Kumar'),
        html: expect.stringContaining('₹300'),
      })
    )
  })

  it('does not send email when balance equals threshold', async () => {
    await checkAndNotifyLowBalance('Ravi Kumar', 500, 500, 'owner@example.com')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('does not send email when balance is above threshold', async () => {
    await checkAndNotifyLowBalance('Ravi Kumar', 800, 500, 'owner@example.com')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('includes threshold amount in email', async () => {
    await checkAndNotifyLowBalance('Priya', 100, 1000, 'owner@example.com')
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('₹1000'),
      })
    )
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- notifications.test.ts
```
Expected: FAIL — "Cannot find module '@/lib/notifications'"

- [ ] **Step 3: Implement notifications.ts**

Create `lib/notifications.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- notifications.test.ts
```
Expected: PASS — 4 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts __tests__/notifications.test.ts
git commit -m "feat: low balance email notifications with tests"
```

---

## Task 10: Owner Dashboard

**Files:**
- Create: `app/(owner)/layout.tsx`
- Create: `app/(owner)/owner/dashboard/page.tsx`
- Create: `components/nav/owner-nav.tsx`
- Create: `components/worker-card.tsx`

- [ ] **Step 1: Create owner nav**

Create `components/nav/owner-nav.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, BarChart3, Settings, LayoutDashboard } from 'lucide-react'

const links = [
  { href: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/owner/workers', label: 'Workers', icon: Users },
  { href: '/owner/reports', label: 'Reports', icon: BarChart3 },
  { href: '/owner/settings', label: 'Settings', icon: Settings },
]

export function OwnerNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:static md:border-r md:border-t-0 md:w-56 md:min-h-screen">
      <div className="flex justify-around items-center h-16 md:flex-col md:items-start md:justify-start md:h-full md:pt-8 md:gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm w-full ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-gray-100'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create owner layout**

Create `app/(owner)/layout.tsx`:
```tsx
import { OwnerNav } from '@/components/nav/owner-nav'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row pb-16 md:pb-0">
      <OwnerNav />
      <main className="flex-1 p-4 md:p-8 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create worker card component**

Create `components/worker-card.tsx`:
```tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { WorkerWithBalance } from '@/types'

interface WorkerCardProps {
  worker: WorkerWithBalance
}

export function WorkerCard({ worker }: WorkerCardProps) {
  const isLow = worker.balance < worker.low_balance_threshold

  return (
    <Link href={`/owner/workers/${worker.id}`}>
      <Card className={`cursor-pointer hover:bg-gray-50 ${isLow ? 'border-red-300' : ''}`}>
        <CardContent className="py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {isLow && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
            <div>
              <p className="font-medium">{worker.name}</p>
              <p className="text-sm text-muted-foreground">{worker.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`font-semibold ${isLow ? 'text-red-600' : ''}`}>
                ₹{worker.balance.toLocaleString('en-IN')}
              </p>
              {isLow && <Badge variant="destructive" className="text-xs">Low</Badge>}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 4: Create owner dashboard page**

Create `app/(owner)/owner/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { WorkerCard } from '@/components/worker-card'
import type { WorkerWithBalance } from '@/types'

export default async function OwnerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'worker')
    .eq('is_active', true)
    .order('name')

  const workersWithBalance: WorkerWithBalance[] = await Promise.all(
    (workers ?? []).map(async worker => {
      const [transfersRes, expensesRes] = await Promise.all([
        supabase.from('fund_transfers').select('amount').eq('worker_id', worker.id),
        supabase.from('expenses').select('amount').eq('worker_id', worker.id),
      ])
      const balance = calculateBalance(transfersRes.data ?? [], expensesRes.data ?? [])
      return { ...worker, balance }
    })
  )

  const lowBalanceCount = workersWithBalance.filter(
    w => w.balance < w.low_balance_threshold
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {lowBalanceCount > 0 && (
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 px-3 py-1.5 rounded-full">
            <span>⚠️ {lowBalanceCount} worker{lowBalanceCount > 1 ? 's' : ''} with low balance</span>
          </div>
        )}
      </div>

      {workersWithBalance.length === 0 ? (
        <p className="text-muted-foreground">No workers yet. Add workers from the Workers page.</p>
      ) : (
        <div className="space-y-3">
          {workersWithBalance
            .sort((a, b) => (a.balance < a.low_balance_threshold ? -1 : 1))
            .map(worker => (
              <WorkerCard key={worker.id} worker={worker} />
            ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Manual test**

Log in as owner → verify dashboard shows worker cards. Workers below threshold should show in red with "Low" badge.

- [ ] **Step 6: Commit**

```bash
git add app/(owner)/ components/worker-card.tsx components/nav/owner-nav.tsx
git commit -m "feat: owner dashboard with worker balance cards"
```

---

## Task 11: Worker Management + Fund Transfers

**Files:**
- Create: `app/(owner)/owner/workers/page.tsx`
- Create: `app/(owner)/owner/workers/[id]/page.tsx`
- Create: `app/api/workers/route.ts`
- Create: `app/api/workers/[id]/route.ts`
- Create: `app/api/fund-transfers/route.ts`
- Create: `components/fund-form.tsx`

- [ ] **Step 1: Create workers API route**

Create `app/api/workers/route.ts`:
```typescript
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createWorkerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  low_balance_threshold: z.coerce.number().int().nonnegative().default(500),
})

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'worker')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = createWorkerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, email, password, low_balance_threshold } = parsed.data

  // Create auth user
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // Create profile
  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    name,
    email,
    role: 'worker',
    low_balance_threshold,
  })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  return NextResponse.json({ id: authUser.user.id }, { status: 201 })
}
```

- [ ] **Step 2: Create worker PATCH route (deactivate + reset credentials)**

Create `app/api/workers/[id]/route.ts`:
```typescript
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  is_active: z.boolean().optional(),
  low_balance_threshold: z.number().int().nonnegative().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { email, password, ...profileUpdates } = parsed.data

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin.from('profiles').update(profileUpdates).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (email || password) {
    const { error } = await admin.auth.admin.updateUserById(params.id, {
      ...(email && { email }),
      ...(password && { password }),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (email) {
      await admin.from('profiles').update({ email }).eq('id', params.id)
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create fund transfers API route**

Create `app/api/fund-transfers/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  worker_id: z.string().uuid(),
  amount: z.number().int().positive(),
  note: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { error } = await supabase.from('fund_transfers').insert(parsed.data)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 4: Create add funds modal component**

Create `components/fund-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

interface FundFormProps {
  workerId: string
}

export function FundForm({ workerId }: FundFormProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/fund-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: workerId, amount: parseInt(amount), note }),
    })

    if (!res.ok) {
      toast({ title: 'Error', description: 'Failed to add funds.', variant: 'destructive' })
    } else {
      toast({ title: `₹${amount} added successfully` })
      setOpen(false)
      setAmount('')
      setNote('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Funds</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="1000"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Monthly allowance" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Confirm'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Create workers list page**

Create `app/(owner)/owner/workers/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import type { Profile } from '@/types'

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', low_balance_threshold: '500' })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function fetchWorkers() {
    const res = await fetch('/api/workers')
    const data = await res.json()
    setWorkers(data)
  }

  useEffect(() => { fetchWorkers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, low_balance_threshold: parseInt(form.low_balance_threshold) }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast({ title: 'Error', description: err.error ?? 'Failed to create worker', variant: 'destructive' })
    } else {
      toast({ title: 'Worker created successfully' })
      setOpen(false)
      setForm({ name: '', email: '', password: '', low_balance_threshold: '500' })
      fetchWorkers()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Add Worker</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Worker</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Ravi Kumar' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'ravi@example.com' },
                { label: 'Temporary Password', key: 'password', type: 'password', placeholder: 'min 8 characters' },
                { label: 'Low Balance Threshold (₹)', key: 'low_balance_threshold', type: 'number', placeholder: '500' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Worker'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {workers.map(worker => (
          <Link key={worker.id} href={`/owner/workers/${worker.id}`}>
            <Card className="cursor-pointer hover:bg-gray-50">
              <CardContent className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{worker.name}</p>
                  <p className="text-sm text-muted-foreground">{worker.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${worker.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {worker.is_active ? 'Active' : 'Inactive'}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
        {workers.length === 0 && <p className="text-muted-foreground text-sm">No workers yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create worker detail page**

Create `app/(owner)/owner/workers/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { calculateBalance } from '@/lib/balance'
import { FundForm } from '@/components/fund-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExpenseWithCategory } from '@/types'
import { ResetCredentialsForm } from '@/components/reset-credentials-form'

export default async function WorkerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [workerRes, transfersRes, expensesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.id).single(),
    supabase.from('fund_transfers').select('*').eq('worker_id', params.id).order('created_at', { ascending: false }),
    supabase.from('expenses').select('*, categories(name)').eq('worker_id', params.id).order('date', { ascending: false }),
  ])

  if (!workerRes.data) notFound()

  const worker = workerRes.data
  const transfers = transfersRes.data ?? []
  const expenses = (expensesRes.data ?? []) as ExpenseWithCategory[]
  const balance = calculateBalance(transfers, expenses)
  const isLow = balance < worker.low_balance_threshold

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{worker.name}</h1>
          <p className="text-muted-foreground">{worker.email}</p>
        </div>
        <FundForm workerId={worker.id} />
      </div>

      <Card className={isLow ? 'border-red-300 bg-red-50' : ''}>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className={`text-3xl font-bold ${isLow ? 'text-red-600' : ''}`}>
            ₹{balance.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Alert threshold: ₹{worker.low_balance_threshold.toLocaleString('en-IN')}
          </p>
        </CardContent>
      </Card>

      <ResetCredentialsForm workerId={worker.id} />

      <Card>
        <CardHeader><CardTitle>Fund History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfers yet.</p>
          ) : transfers.map(t => (
            <div key={t.id} className="flex justify-between text-sm py-1 border-b last:border-0">
              <div>
                <p className="font-medium text-green-700">+₹{t.amount.toLocaleString('en-IN')}</p>
                {t.note && <p className="text-muted-foreground">{t.note}</p>}
              </div>
              <p className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses yet.</p>
          ) : expenses.map(e => (
            <div key={e.id} className="flex justify-between text-sm py-1 border-b last:border-0">
              <div>
                <p className="font-medium">{e.categories.name}</p>
                <p className="text-muted-foreground">{e.date}{e.comment ? ` — ${e.comment}` : ''}</p>
              </div>
              <p className="text-red-600">-₹{e.amount.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Create reset credentials form**

Create `components/reset-credentials-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

export function ResetCredentialsForm({ workerId }: { workerId: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email && !password) return
    setLoading(true)

    const res = await fetch(`/api/workers/${workerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(email && { email }),
        ...(password && { password }),
      }),
    })

    if (res.ok) {
      toast({ title: 'Credentials updated successfully' })
      setEmail('')
      setPassword('')
    } else {
      toast({ title: 'Error', description: 'Failed to update credentials', variant: 'destructive' })
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Reset Credentials</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleReset} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">New Email (optional)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="new@email.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">New Password (optional)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 8 characters" minLength={8} />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={loading || (!email && !password)}>
            {loading ? 'Updating...' : 'Update'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 8: Manual test**

1. Owner → Workers → Add Worker (fill in name, email, password, threshold)
2. Verify worker appears in list
3. Click worker → see detail page with ₹0 balance
4. Click "Add Funds" → enter ₹2000 → confirm
5. Verify balance updates to ₹2000
6. Log in as worker → verify dashboard shows ₹2000

- [ ] **Step 9: Commit**

```bash
git add app/ components/ lib/
git commit -m "feat: worker management, fund transfers, and worker detail page"
```

---

## Task 12: Categories Management

**Files:**
- Create: `app/(owner)/owner/settings/page.tsx`
- Create: `app/api/categories/route.ts`

- [ ] **Step 1: Create categories API route**

Create `app/api/categories/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_global', true)
    .order('name')
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role, id').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { error } = await supabase.from('categories').insert({
    name: name.trim(),
    is_global: true,
    created_by: profile.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()

  // Prevent deleting "Other"
  const { data: cat } = await supabase.from('categories').select('is_system').eq('id', id).single()
  if (cat?.is_system) return NextResponse.json({ error: 'Cannot delete system category' }, { status: 400 })

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create settings page**

Create `app/(owner)/owner/settings/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Trash2 } from 'lucide-react'
import type { Category } from '@/types'

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [alertEmail, setAlertEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function fetchCategories() {
    const res = await fetch('/api/categories')
    const data = await res.json()
    setCategories(data)
  }

  useEffect(() => { fetchCategories() }, [])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategory.trim()) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategory.trim() }),
    })
    if (res.ok) {
      setNewCategory('')
      fetchCategories()
      toast({ title: 'Category added' })
    } else {
      toast({ title: 'Error adding category', variant: 'destructive' })
    }
  }

  async function deleteCategory(id: string) {
    const res = await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      fetchCategories()
      toast({ title: 'Category deleted' })
    } else {
      const err = await res.json()
      toast({ title: err.error ?? 'Cannot delete category', variant: 'destructive' })
    }
  }

  async function saveAlertEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_alert_email: alertEmail }),
    })
    toast({ title: res.ok ? 'Email saved' : 'Error saving email', variant: res.ok ? 'default' : 'destructive' })
    setLoading(false)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Alert Email</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveAlertEmail} className="flex gap-2">
            <Input
              type="email"
              value={alertEmail}
              onChange={e => setAlertEmail(e.target.value)}
              placeholder="owner@company.com"
              required
            />
            <Button type="submit" disabled={loading}>Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Global Categories</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addCategory} className="flex gap-2">
            <Input
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="New category name"
            />
            <Button type="submit">Add</Button>
          </form>

          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{cat.name}</span>
                {cat.is_system ? (
                  <span className="text-xs text-muted-foreground">System (protected)</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCategory(cat.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create settings API route**

Create `app/api/settings/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { owner_alert_email } = await request.json()
  const { error } = await supabase.from('settings').update({ owner_alert_email }).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Manual test**

Owner → Settings → Add category "Fuel" → verify appears in list → delete "Fuel" → verify removed. Try deleting "Other" — should show error message.

- [ ] **Step 5: Commit**

```bash
git add app/ components/
git commit -m "feat: categories management and settings page"
```

---

## Task 13: Reports + CSV Export (TDD for CSV)

**Files:**
- Create: `lib/export/csv.ts`
- Create: `lib/export/pdf.ts`
- Create: `__tests__/csv.test.ts`
- Create: `app/api/reports/route.ts`
- Create: `app/api/reports/csv/route.ts`
- Create: `app/api/reports/pdf/route.ts`
- Create: `app/(owner)/owner/reports/page.tsx`

- [ ] **Step 1: Write failing CSV tests**

Create `__tests__/csv.test.ts`:
```typescript
import { generateCSV } from '@/lib/export/csv'
import type { ExpenseWithCategory } from '@/types'

const makeExpense = (overrides: Partial<ExpenseWithCategory> = {}): ExpenseWithCategory => ({
  id: '1',
  worker_id: 'w1',
  category_id: 'c1',
  amount: 500,
  date: '2026-05-22',
  comment: 'Lunch',
  image_url: null,
  created_at: '',
  categories: { name: 'Food' },
  ...overrides,
})

describe('generateCSV', () => {
  it('includes header row', () => {
    const csv = generateCSV([])
    expect(csv).toContain('Date')
    expect(csv).toContain('Category')
    expect(csv).toContain('Amount (Rs)')
    expect(csv).toContain('Comment')
  })

  it('generates a row for each expense', () => {
    const csv = generateCSV([makeExpense()])
    expect(csv).toContain('2026-05-22')
    expect(csv).toContain('Food')
    expect(csv).toContain('500')
    expect(csv).toContain('Lunch')
  })

  it('replaces null comment with empty string', () => {
    const csv = generateCSV([makeExpense({ comment: null })])
    expect(csv).not.toContain('null')
  })

  it('handles multiple rows', () => {
    const csv = generateCSV([
      makeExpense({ id: '1', amount: 100, date: '2026-05-01' }),
      makeExpense({ id: '2', amount: 200, date: '2026-05-02' }),
    ])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- csv.test.ts
```
Expected: FAIL — "Cannot find module '@/lib/export/csv'"

- [ ] **Step 3: Implement CSV generation**

Create `lib/export/csv.ts`:
```typescript
import Papa from 'papaparse'
import type { ExpenseWithCategory } from '@/types'

export function generateCSV(expenses: ExpenseWithCategory[]): string {
  const rows = expenses.map(e => ({
    Date: e.date,
    Category: e.categories.name,
    'Amount (Rs)': e.amount,
    Comment: e.comment ?? '',
  }))
  return Papa.unparse(rows)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- csv.test.ts
```
Expected: PASS — 4 tests, 0 failures

- [ ] **Step 5: Implement PDF generation**

Create `lib/export/pdf.ts`:
```typescript
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExpenseWithCategory } from '@/types'

export function generatePDF(
  expenses: ExpenseWithCategory[],
  title: string
): Buffer {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text('Expense Report', 14, 22)
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(title, 14, 32)

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Category', 'Amount (₹)', 'Comment']],
    body: expenses.map(e => [
      e.date,
      e.categories.name,
      `₹${e.amount.toLocaleString('en-IN')}`,
      e.comment ?? '',
    ]),
    foot: [['', 'Total', `₹${total.toLocaleString('en-IN')}`, '']],
  })

  return Buffer.from(doc.output('arraybuffer'))
}
```

- [ ] **Step 6: Create reports API routes**

Create `app/api/reports/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const worker_id = searchParams.get('worker_id')
  const category_id = searchParams.get('category_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('expenses')
    .select('*, categories(name), profiles(name)')
    .order('date', { ascending: false })

  if (worker_id) query = query.eq('worker_id', worker_id)
  if (category_id) query = query.eq('category_id', category_id)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

Create `app/api/reports/csv/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateCSV } from '@/lib/export/csv'
import type { ExpenseWithCategory } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return new NextResponse('Forbidden', { status: 403 })

  const { searchParams } = new URL(request.url)
  const worker_id = searchParams.get('worker_id')
  const category_id = searchParams.get('category_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('expenses')
    .select('*, categories(name)')
    .order('date', { ascending: false })

  if (worker_id) query = query.eq('worker_id', worker_id)
  if (category_id) query = query.eq('category_id', category_id)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data } = await query
  const csv = generateCSV((data ?? []) as ExpenseWithCategory[])

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
```

Create `app/api/reports/pdf/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generatePDF } from '@/lib/export/pdf'
import type { ExpenseWithCategory } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'owner') return new NextResponse('Forbidden', { status: 403 })

  const { searchParams } = new URL(request.url)
  const worker_id = searchParams.get('worker_id')
  const category_id = searchParams.get('category_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('expenses')
    .select('*, categories(name)')
    .order('date', { ascending: false })

  if (worker_id) query = query.eq('worker_id', worker_id)
  if (category_id) query = query.eq('category_id', category_id)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data } = await query
  const title = [
    from && `From: ${from}`,
    to && `To: ${to}`,
  ].filter(Boolean).join('  |  ') || 'All time'

  const pdf = generatePDF((data ?? []) as ExpenseWithCategory[], title)

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  })
}
```

- [ ] **Step 7: Create reports page**

Create `app/(owner)/owner/reports/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import type { Category, ExpenseWithCategory, Profile } from '@/types'

interface ExpenseRow extends ExpenseWithCategory {
  profiles: { name: string }
}

export default function ReportsPage() {
  const [workers, setWorkers] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [filters, setFilters] = useState({ worker_id: '', category_id: '', from: '', to: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/workers').then(r => r.json()).then(setWorkers)
    fetch('/api/categories').then(r => r.json()).then(setCategories)
  }, [])

  async function runReport() {
    setLoading(true)
    const params = new URLSearchParams(
      Object.entries(filters).filter(([_, v]) => v) as [string, string][]
    )
    const res = await fetch(`/api/reports?${params}`)
    const data = await res.json()
    setExpenses(data)
    setLoading(false)
  }

  function exportUrl(format: 'csv' | 'pdf') {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([_, v]) => v) as [string, string][]
    )
    return `/api/reports/${format}?${params}`
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Worker</Label>
              <Select onValueChange={v => setFilters(f => ({ ...f, worker_id: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="All workers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workers</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select onValueChange={v => setFilters(f => ({ ...f, category_id: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            </div>
          </div>
          <Button onClick={runReport} disabled={loading} className="w-full">
            {loading ? 'Loading...' : 'Run Report'}
          </Button>
        </CardContent>
      </Card>

      {expenses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium">{expenses.length} expenses · Total: ₹{total.toLocaleString('en-IN')}</p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={exportUrl('csv')} download>Export CSV</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={exportUrl('pdf')} download>Export PDF</a>
              </Button>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Worker</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2">Comment</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{e.profiles?.name}</td>
                    <td className="py-2 pr-4">{e.date}</td>
                    <td className="py-2 pr-4">{e.categories.name}</td>
                    <td className="py-2 pr-4">₹{e.amount.toLocaleString('en-IN')}</td>
                    <td className="py-2 text-muted-foreground">{e.comment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Add profiles join to expenses RLS policy**

In Supabase SQL Editor:
```sql
-- Allow owner to read profiles for join in reports
-- (already covered by "Owner reads all profiles" policy above)
-- No change needed.
```

- [ ] **Step 9: Manual test**

Owner → Reports → Run Report (no filters) → verify table shows all expenses. Click "Export CSV" → verify `.csv` download. Click "Export PDF" → verify `.pdf` download with table.

- [ ] **Step 10: Commit**

```bash
git add app/ lib/export/ __tests__/csv.test.ts
git commit -m "feat: reports page with CSV and PDF export"
```

---

## Task 14: Deployment to Vercel

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected: All tests pass (balance, csv, notifications).

- [ ] **Step 2: Run build check**

```bash
npm run build
```
Fix any TypeScript errors before deploying.

- [ ] **Step 3: Deploy to Vercel**

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub (push your code to GitHub first)
2. Or install Vercel CLI: `npm i -g vercel` then run `vercel` in the project folder
3. When prompted, add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`

- [ ] **Step 4: Update Supabase Auth redirect URLs**

In Supabase dashboard → Authentication → URL Configuration:
- Site URL: `https://your-app.vercel.app`
- Redirect URL: `https://your-app.vercel.app/api/auth/callback`

- [ ] **Step 5: Update Resend sender domain**

In Resend dashboard:
- Add and verify your domain for the `from` address in `lib/notifications.ts`
- Update `from: 'alerts@expensetracker.app'` to your verified domain

- [ ] **Step 6: Smoke test on production**

1. Open `https://your-app.vercel.app`
2. Log in as owner → verify dashboard loads
3. Create a worker → log in as that worker
4. Add an expense → verify balance deducts
5. Let balance drop below threshold → verify owner gets email notification
6. Export a CSV from Reports → verify download works

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: production deployment configuration"
```

---

## Running All Tests

```bash
npm test
```

Expected output:
```
PASS __tests__/balance.test.ts
PASS __tests__/csv.test.ts
PASS __tests__/notifications.test.ts

Test Suites: 3 passed, 3 total
Tests:       17 passed, 17 total
```
