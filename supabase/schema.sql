create table if not exists public.income_expenses (
  id bigserial primary key,
  date date not null,
  type text not null check (type in ('수입', '지출')),
  category text not null default '미분류',
  content text not null default '',
  amount numeric not null default 0,
  amount_abs numeric not null default 0,
  payment_method text not null default '',
  spender text not null default '',
  memo text not null default '',
  source_file text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.assets_youngbeom (
  id bigserial primary key,
  owner text not null default '영범',
  name text not null,
  category text not null default '금융자산',
  amount numeric not null default 0,
  source_sheet text not null default '',
  source_file text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.assets_jaeeun (
  id bigserial primary key,
  owner text not null default '재은',
  name text not null,
  category text not null default '금융자산',
  amount numeric not null default 0,
  source_sheet text not null default '',
  source_file text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.income_expenses add column if not exists source_file text not null default '';
alter table public.income_expenses add column if not exists synced_at timestamptz not null default now();
alter table public.assets_youngbeom add column if not exists source_file text not null default '';
alter table public.assets_youngbeom add column if not exists synced_at timestamptz not null default now();
alter table public.assets_jaeeun add column if not exists source_file text not null default '';
alter table public.assets_jaeeun add column if not exists synced_at timestamptz not null default now();

alter table public.income_expenses enable row level security;
alter table public.assets_youngbeom enable row level security;
alter table public.assets_jaeeun enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.income_expenses to anon, authenticated;
grant select on public.assets_youngbeom to anon, authenticated;
grant select on public.assets_jaeeun to anon, authenticated;

drop policy if exists "read income_expenses" on public.income_expenses;
drop policy if exists "read assets_youngbeom" on public.assets_youngbeom;
drop policy if exists "read assets_jaeeun" on public.assets_jaeeun;

create policy "read income_expenses"
on public.income_expenses for select
to anon, authenticated
using (true);

create policy "read assets_youngbeom"
on public.assets_youngbeom for select
to anon, authenticated
using (true);

create policy "read assets_jaeeun"
on public.assets_jaeeun for select
to anon, authenticated
using (true);

create index if not exists income_expenses_date_idx on public.income_expenses (date desc);
create index if not exists income_expenses_type_idx on public.income_expenses (type);
create index if not exists income_expenses_category_idx on public.income_expenses (category);
create index if not exists income_expenses_synced_at_idx on public.income_expenses (synced_at desc);
create index if not exists assets_youngbeom_amount_idx on public.assets_youngbeom (amount desc);
create index if not exists assets_youngbeom_synced_at_idx on public.assets_youngbeom (synced_at desc);
create index if not exists assets_jaeeun_amount_idx on public.assets_jaeeun (amount desc);
create index if not exists assets_jaeeun_synced_at_idx on public.assets_jaeeun (synced_at desc);
