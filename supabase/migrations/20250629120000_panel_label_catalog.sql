-- Pano ve Etiket Kontrol: bölgeler ve pano kataloğu

create table if not exists public.panel_label_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  user_id text not null default 'shared',
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.panel_label_panels (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.panel_label_regions (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  user_id text not null default 'shared',
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists panel_label_panels_region_id_idx
  on public.panel_label_panels (region_id);

create index if not exists panel_label_regions_sort_idx
  on public.panel_label_regions (sort_order, name);

alter table public.panel_label_regions enable row level security;
alter table public.panel_label_panels enable row level security;

create policy "panel_label_regions_select"
  on public.panel_label_regions for select
  using (visible = true);

create policy "panel_label_regions_insert"
  on public.panel_label_regions for insert
  with check (true);

create policy "panel_label_regions_update"
  on public.panel_label_regions for update
  using (true);

create policy "panel_label_regions_delete"
  on public.panel_label_regions for delete
  using (true);

create policy "panel_label_panels_select"
  on public.panel_label_panels for select
  using (visible = true);

create policy "panel_label_panels_insert"
  on public.panel_label_panels for insert
  with check (true);

create policy "panel_label_panels_update"
  on public.panel_label_panels for update
  using (true);

create policy "panel_label_panels_delete"
  on public.panel_label_panels for delete
  using (true);
