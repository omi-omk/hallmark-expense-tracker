create table public.expense_activity_logs (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('owner', 'admin', 'worker')),
  action text not null check (action in ('created', 'edited', 'deleted')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index expense_activity_logs_expense_id_idx on public.expense_activity_logs(expense_id);
create index expense_activity_logs_worker_id_idx on public.expense_activity_logs(worker_id);
create index expense_activity_logs_created_at_idx on public.expense_activity_logs(created_at desc);

alter table public.expense_activity_logs enable row level security;

create policy "Employees read own expense activity" on public.expense_activity_logs
  for select using (auth.uid() = worker_id);

create policy "Owner and admin read all expense activity" on public.expense_activity_logs
  for select using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );
