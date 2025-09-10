-- Supabase schema for Web Investment Assistant
-- Run this in Supabase SQL editor

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  asset_type text not null check (asset_type in ('stock','crypto')),
  investment_level int not null check (investment_level between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches(id) on delete cascade,
  status text not null check (status in ('pending','completed','failed')),
  report_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful index
create index if not exists idx_analysis_reports_search_id on public.analysis_reports(search_id);

-- RLS
alter table public.searches enable row level security;
alter table public.analysis_reports enable row level security;

-- Policies: owner-based access using auth.uid()
drop policy if exists "searches_select_own" on public.searches;
create policy "searches_select_own" on public.searches
  for select using (auth.uid() = user_id);

drop policy if exists "searches_insert_own" on public.searches;
create policy "searches_insert_own" on public.searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "reports_select_by_owner" on public.analysis_reports;
create policy "reports_select_by_owner" on public.analysis_reports
  for select using (exists (
    select 1 from public.searches s where s.id = analysis_reports.search_id and s.user_id = auth.uid()
  ));

drop policy if exists "reports_insert_by_owner" on public.analysis_reports;
create policy "reports_insert_by_owner" on public.analysis_reports
  for insert with check (exists (
    select 1 from public.searches s where s.id = analysis_reports.search_id and s.user_id = auth.uid()
  ));

drop policy if exists "reports_update_by_owner" on public.analysis_reports;
create policy "reports_update_by_owner" on public.analysis_reports
  for update using (exists (
    select 1 from public.searches s where s.id = analysis_reports.search_id and s.user_id = auth.uid()
  ));
