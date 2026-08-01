create table if not exists income_expenses (
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
  created_at timestamptz not null default now()
);

create table if not exists assets_youngbeom (
  id bigserial primary key,
  owner text not null default '영범',
  name text not null,
  category text not null default '금융자산',
  amount numeric not null default 0,
  source_sheet text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists assets_jaeeun (
  id bigserial primary key,
  owner text not null default '재은',
  name text not null,
  category text not null default '금융자산',
  amount numeric not null default 0,
  source_sheet text not null default '',
  created_at timestamptz not null default now()
);

alter table income_expenses enable row level security;
alter table assets_youngbeom enable row level security;
alter table assets_jaeeun enable row level security;

drop policy if exists "public read income_expenses" on income_expenses;
drop policy if exists "public read assets_youngbeom" on assets_youngbeom;
drop policy if exists "public read assets_jaeeun" on assets_jaeeun;

create policy "public read income_expenses"
on income_expenses for select
to anon, authenticated
using (true);

create policy "public read assets_youngbeom"
on assets_youngbeom for select
to anon, authenticated
using (true);

create policy "public read assets_jaeeun"
on assets_jaeeun for select
to anon, authenticated
using (true);

drop policy if exists "authenticated write income_expenses" on income_expenses;
drop policy if exists "authenticated write assets_youngbeom" on assets_youngbeom;
drop policy if exists "authenticated write assets_jaeeun" on assets_jaeeun;

create policy "authenticated write income_expenses"
on income_expenses for all
to authenticated
using (true)
with check (true);

create policy "authenticated write assets_youngbeom"
on assets_youngbeom for all
to authenticated
using (true)
with check (true);

create policy "authenticated write assets_jaeeun"
on assets_jaeeun for all
to authenticated
using (true)
with check (true);

create index if not exists income_expenses_date_idx on income_expenses (date desc);
create index if not exists income_expenses_category_idx on income_expenses (category);
create index if not exists assets_youngbeom_amount_idx on assets_youngbeom (amount desc);
create index if not exists assets_jaeeun_amount_idx on assets_jaeeun (amount desc);
