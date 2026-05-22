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
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Owner reads all profiles" on public.profiles
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- RLS: fund_transfers
create policy "Worker reads own transfers" on public.fund_transfers
  for select using (auth.uid() = worker_id);

create policy "Owner reads all transfers" on public.fund_transfers
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- RLS: categories
create policy "All users read global categories" on public.categories
  for select using (is_global = true and auth.uid() is not null);

create policy "Workers read own categories" on public.categories
  for select using (created_by = auth.uid());

-- RLS: expenses
create policy "Worker reads own expenses" on public.expenses
  for select using (auth.uid() = worker_id);

create policy "Owner reads all expenses" on public.expenses
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- RLS: settings
create policy "Owner reads settings" on public.settings
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );
