-- 우리집 통합 재정 대시보드 - Supabase 스키마
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
-- anon(publishable) 키로는 이 DDL을 실행할 수 없습니다. 반드시 대시보드에서 직접 실행해야 합니다.

create table if not exists ledger_items (
  id bigint primary key,
  month text not null,
  type text not null check (type in ('수입', '지출')),
  category text not null,
  content text not null,
  amount numeric not null,
  active boolean not null default true,
  date text not null,
  memo text not null default '',
  payment_method text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists asset_free_items (
  id bigserial primary key,
  name text not null,
  amount numeric not null,
  updated_at timestamptz not null default now()
);

create table if not exists asset_investment_items (
  id bigserial primary key,
  name text not null,
  principal numeric not null,
  appraised numeric not null,
  yield_rate numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists checklist_items (
  id bigserial primary key,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

-- 대출 상환 기록: 상환할 때마다 한 행씩 쌓이고, 남은 원금/이자는 앱에서 순차 계산합니다.
create table if not exists mortgage_payments (
  id bigserial primary key,
  payment_date date not null,
  amount numeric not null,
  memo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists household_settings (
  id int primary key default 1,
  mortgage_name text not null default 'NH주택담보대출',
  mortgage_amount numeric not null default 600000000,
  mortgage_rate numeric not null default 4.08,
  mortgage_start_date date,
  mortgage_end_date date,
  ledger_file_name text,
  assets_file_name text,
  updated_at timestamptz not null default now(),
  constraint household_settings_single_row check (id = 1)
);
insert into household_settings (id) values (1) on conflict (id) do nothing;

-- Row Level Security: 로그인(인증)한 사용자만 읽고 쓸 수 있음.
-- 이 앱은 부부가 공유 계정 하나로 로그인하는 구조이므로 "authenticated"면 모두 허용합니다.
alter table ledger_items enable row level security;
alter table asset_free_items enable row level security;
alter table asset_investment_items enable row level security;
alter table checklist_items enable row level security;
alter table mortgage_payments enable row level security;
alter table household_settings enable row level security;

drop policy if exists "authenticated_all" on ledger_items;
create policy "authenticated_all" on ledger_items for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all" on asset_free_items;
create policy "authenticated_all" on asset_free_items for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all" on asset_investment_items;
create policy "authenticated_all" on asset_investment_items for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all" on checklist_items;
create policy "authenticated_all" on checklist_items for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all" on mortgage_payments;
create policy "authenticated_all" on mortgage_payments for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all" on household_settings;
create policy "authenticated_all" on household_settings for all to authenticated using (true) with check (true);

-- 실시간 동기화(다른 기기에서 업로드하면 즉시 반영)를 위해 Realtime publication에 테이블 추가
-- 이미 추가되어 있다면 오류 없이 무시됩니다.
do $$
begin
  alter publication supabase_realtime add table ledger_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table asset_free_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table asset_investment_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table checklist_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table mortgage_payments;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table household_settings;
exception when duplicate_object then null;
end $$;
