# Inventory Management System — Design Spec

**Date**: 2026-05-22  
**Project**: `hallmark-inventory` (new repo, sibling to `hallmark-expense-tracker`)  
**Stack**: Next.js 16 (App Router), React 19, TypeScript, Supabase, Resend, Tailwind v4, shadcn, Zod, react-hook-form, Jest

---

## 1. Overview

A standalone inventory management system for Hallmark. Admins manage users and the full product catalog. Users are granted per-account permissions to add stock, remove stock, or view-only. Every stock change is recorded as an immutable movement entry — current quantity is always derived from the sum of movements. Admins receive low-stock email alerts via Resend when a product crosses below its threshold.

---

## 2. Architecture

### Project shape

New repo `hallmark-inventory`. Mirrors the expense tracker: same stack, same patterns, dedicated Supabase project (separate from the expense tracker's DB).

### Route groups

```
app/
  (auth)/
    login/
  (app)/
    layout.tsx          -- loads profile, enforces auth, passes role/permissions
    dashboard/          -- admin only
    inventory/          -- all users
    products/           -- all users
    categories/         -- all users (creation gated by permission)
    history/            -- all users (export gated to admin)
    reports/            -- admin only
    users/              -- admin only
    settings/           -- admin only (placeholder for future config)
  api/
    auth/callback/
    auth/signout/
    users/
    users/[id]/
    categories/
    categories/[id]/
    products/
    products/[id]/
    movements/
    reports/
```

### Auth & clients

- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server client (cookie-based) + `createAdminClient()` (service-role) + `isAdmin(userId)` helper + `getUserPermissions(userId)` helper
- `middleware.ts` — redirects unauthenticated users to `/login`; authenticated users on `/login` go to `/`

---

## 3. Roles & Permissions

```
role = 'admin' | 'user'   (stored on profiles.role)
```

For `role = 'user'`, two additional boolean flags on the profile:

| Flag              | Default | Meaning                                  |
|-------------------|---------|------------------------------------------|
| `can_add_stock`   | false   | May record positive stock movements      |
| `can_remove_stock`| false   | May record negative stock movements      |

View access (read-only) is implicit for any authenticated user.

**Permission matrix:**

| Action                              | admin | user (can_add) | user (can_remove) | user (view-only) |
|-------------------------------------|-------|----------------|-------------------|------------------|
| View inventory / products / history | ✓     | ✓              | ✓                 | ✓                |
| Add stock movement                  | ✓     | ✓              | —                 | —                |
| Remove stock movement               | ✓     | —              | ✓                 | —                |
| Record correction movement          | ✓     | —              | —                 | —                |
| Create / edit product               | ✓     | ✓              | ✓                 | —                |
| Archive product                     | ✓     | —              | —                 | —                |
| Create / edit category              | ✓     | ✓              | ✓                 | —                |
| Delete category                     | ✓     | —              | —                 | —                |
| Manage users                        | ✓     | —              | —                 | —                |
| View dashboard / reports            | ✓     | —              | —                 | —                |
| Export logs / reports               | ✓     | —              | —                 | —                |

---

## 4. Database Schema

### `profiles`
```sql
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
```

### `categories`
```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

### `products`
```sql
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
```

### `stock_movements`
```sql
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null,   -- positive = add, negative = remove
  movement_type text not null check (movement_type in ('add', 'remove', 'correction')),
  note text,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

### `settings`
```sql
create table public.settings (
  id integer primary key default 1 check (id = 1)
  -- reserved for future config; no alert email needed (all admins get notified)
);
insert into public.settings (id) values (1);
```

### Derived quantity

```sql
create or replace function public.product_current_quantity(p_id uuid)
returns integer language sql stable as $$
  select coalesce(sum(quantity), 0)::integer
  from public.stock_movements
  where product_id = p_id;
$$;
```

Used in product list queries:
```sql
select p.*, public.product_current_quantity(p.id) as current_quantity
from public.products p
where not p.is_archived;
```

### RLS

All tables have RLS enabled. All authenticated users may SELECT. Mutations are **not** gated by RLS — they go through API routes using the service-role admin client with explicit permission checks in application code (same pattern as expense tracker, which uses admin client to bypass RLS for writes).

---

## 5. API Routes

All handlers follow this pattern: create server client → get user → check permissions → use admin client for DB writes → return JSON.

### `/api/users`
- `GET` — admin only. Returns all profiles ordered by name.
- `POST` — admin only. Creates Supabase auth user + profile row. Sends welcome email with credentials.

### `/api/users/[id]`
- `PATCH` — admin only. Updates name, email, password (via `admin.auth.admin.updateUserById`), `can_add_stock`, `can_remove_stock`, `is_active`.
- `DELETE` — admin only. Sets `is_active = false` and calls `admin.auth.admin.updateUserById(id, { ban_duration: '87600h' })` to ban the session (10-year ban effectively blocks login).

### `/api/categories`
- `GET` — any authenticated user.
- `POST` — admin, or user with `can_add_stock` or `can_remove_stock`. Body: `{ name, description? }`.

### `/api/categories/[id]`
- `PATCH` — admin, or user with `can_add_stock` or `can_remove_stock`. Body: `{ name?, description? }`.
- `DELETE` — admin only. Blocked if any non-archived product references this category (returns 400 with error message).

### `/api/products`
- `GET` — any authenticated user. Query params: `?search=`, `?category_id=`, `?include_archived=true`.
- `POST` — admin, or user with `can_add_stock` or `can_remove_stock`. Body: `{ name, category_id, description?, low_stock_threshold, initial_quantity? }`. If `initial_quantity > 0`, automatically creates a first `add` movement.

### `/api/products/[id]`
- `PATCH` — admin, or user with `can_add_stock` or `can_remove_stock`. Body: `{ name?, description?, low_stock_threshold?, category_id? }`.
- `DELETE` — admin only. Sets `is_archived = true`.

### `/api/movements`
- `GET` — any authenticated user. Query params: `?product_id=`, `?performed_by=`, `?type=`, `?from=`, `?to=`, `?page=`, `?limit=`.
- `POST` — permission checked by type:
  - `add`: admin or `can_add_stock`
  - `remove`: admin or `can_remove_stock`
  - `correction`: admin only; `note` field is required for corrections
  
  After insert, runs low-stock threshold check (see Section 7).

### `/api/reports`
- `GET` — admin only. Returns full product list with current quantities, last movement date. Query params: `?sort=name_asc|qty_asc|qty_desc`, `?category_id=`, `?low_stock_only=true`.

---

## 6. UI Pages

### `/inventory` (all users)
- Search bar — filters products by name (debounced, calls `GET /api/products?search=`)
- Product cards/rows: name, category badge, current quantity, threshold indicator
  - Quantity shown in red if `current_qty <= threshold`, yellow if `current_qty <= threshold * 1.5`
- "Add Stock" button per product (shown only if `can_add_stock` or admin) → drawer with quantity + note
- "Remove Stock" button per product (shown only if `can_remove_stock` or admin) → drawer with quantity + note
- "New Product" button (shown if `can_add_stock`, `can_remove_stock`, or admin) → modal: name, category (dropdown + inline "New category" option), description, threshold, optional initial quantity

### `/products` (all users)
- Table: name, category, current qty, threshold, status
- Edit button (admin + add/remove users) → modal pre-filled with product fields
- Archive button (admin only) → confirmation dialog

### `/categories` (all users)
- List: name, description, product count
- New/Edit category button (admin + add/remove users)
- Delete button (admin only) — disabled + tooltip if products exist in category

### `/history` (all users)
- Log table: timestamp, product, category, type (add/remove/correction), qty change, note, performed by
- Filter bar: product search, user filter (admin only), type filter, date range
- Export CSV button (admin only) — exports filtered results via papaparse

### `/dashboard` (admin only)
- Summary cards: total active products, total categories, products below threshold (count), last movement timestamp
- Category-wise availability table: grouped by category, expandable rows per product
  - Columns: product name, current qty, threshold, status indicator
  - Sort controls: name A→Z, qty low→high, qty high→low
  - "Low stock only" toggle

### `/reports` (admin only)
- Full flat product table with current quantities
- Sort: name A→Z, qty low→high, qty high→low
- Filter: category, low-stock only, last-movement date range
- Export CSV (papaparse) and Export PDF (jspdf + jspdf-autotable) buttons

### `/users` (admin only)
- Table: name, email, can_add, can_remove, active
- Create user button → modal: name, email, password, permission toggles
- Edit button → modal pre-filled; includes password reset field
- Deactivate/Reactivate toggle

### `/login`
- Email + password form, same as expense tracker

---

## 7. Low-Stock Alert Logic

Inside `POST /api/movements`, after inserting the movement:

```typescript
const newQty = await getProductCurrentQuantity(productId)
const movement = parsedBody.quantity  // positive or negative
const oldQty = newQty - movement

if (oldQty > threshold && newQty <= threshold) {
  const adminEmails = await getAllAdminEmails()
  for (const email of adminEmails) {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `Low Stock Alert: ${productName}`,
      html: `
        <p>Hello,</p>
        <p><strong>${productName}</strong> quantity has dropped to <strong>${newQty}</strong>,
        which is at or below the threshold of <strong>${threshold}</strong>.</p>
        <p>Please restock.</p>
      `,
    })
  }
}
```

Only fires on the **crossing event** (was above, now at-or-below). Does not re-fire while already below threshold.

---

## 8. Email Notifications

All emails sent via Resend with `from: 'onboarding@resend.dev'`.

### Welcome email (on user creation)
```
Subject: Your Inventory account is ready
To:      new user's email
Body:    Name, login email, initial password — ask them to change password.
```

### Low-stock alert
```
Subject: Low Stock Alert: {product name}
To:      all admin account emails
Body:    Product name, current quantity, threshold value.
```

---

## 9. Error Handling

- All API routes return `{ error: string }` with appropriate HTTP status (400 bad input, 401 unauthorized, 403 forbidden, 404 not found, 500 server error)
- Client-side: sonner toasts for success and error states
- Zod validation on all request bodies; flatten errors surfaced as 400
- Permission violations return 403 with a clear message
- Category delete blocked if products exist: 400 with `"Cannot delete: X product(s) use this category"`
- Stock removal that would make quantity negative: blocked with 400 `"Insufficient stock: current quantity is X"`

---

## 10. Soft-Delete & Data Integrity

- **Products**: `is_archived = true`. Archived products are hidden from inventory/catalog by default. Their stock_movements are preserved for history. A filter allows admins to view archived products.
- **Users**: `is_active = false` + Supabase session invalidation. Deactivated users' past movements remain visible in history with their name.
- **Categories**: Hard delete only if zero products (including archived) reference them. Otherwise blocked.
- **Stock movements**: Never deleted. Corrections are new rows with `movement_type = 'correction'` and a required note.

---

## 11. Types (`types/index.ts`)

```typescript
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

export interface ProductWithQuantity extends Product {
  current_quantity: number
  categories: { name: string }
}

export interface MovementWithDetails extends StockMovement {
  products: { name: string; categories: { name: string } }
  profiles: { name: string } | null
}
```
