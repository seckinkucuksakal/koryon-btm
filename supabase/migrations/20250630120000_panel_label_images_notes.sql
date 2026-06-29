-- Pano etiket: pano notları ve görseller (tek hat / pano içi)

alter table public.panel_label_panels
  add column if not exists notes text;

create table if not exists public.panel_label_images (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.panel_label_panels (id) on delete cascade,
  category text not null check (category in ('tek_hat', 'pano_ici')),
  title text not null default '',
  storage_path text not null,
  mime_type text not null default 'image/jpeg',
  sort_order integer not null default 0,
  user_id text not null default 'shared',
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists panel_label_images_panel_id_idx
  on public.panel_label_images (panel_id);

create index if not exists panel_label_images_category_idx
  on public.panel_label_images (panel_id, category);

alter table public.panel_label_images enable row level security;

create policy "panel_label_images_select"
  on public.panel_label_images for select
  using (visible = true);

create policy "panel_label_images_insert"
  on public.panel_label_images for insert
  with check (true);

create policy "panel_label_images_update"
  on public.panel_label_images for update
  using (true);

create policy "panel_label_images_delete"
  on public.panel_label_images for delete
  using (true);
