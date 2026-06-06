alter table public.profiles
  add column if not exists title text;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'worker'));

alter table public.settings
  add column if not exists dashboard_show_category_spend boolean not null default true,
  add column if not exists dashboard_show_employee_spend boolean not null default true,
  add column if not exists dashboard_show_employee_cards boolean not null default true,
  add column if not exists dashboard_chart_order text not null default 'category_first';

alter table public.settings
  drop constraint if exists settings_dashboard_chart_order_check;

alter table public.settings
  add constraint settings_dashboard_chart_order_check
  check (dashboard_chart_order in ('category_first', 'employee_first'));
