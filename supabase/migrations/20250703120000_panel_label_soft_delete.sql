-- Pano etiket: geri dönüşüm kutusu (soft delete)

alter table public.panel_label_regions
  add column if not exists deleted_at timestamptz;

alter table public.panel_label_panels
  add column if not exists deleted_at timestamptz;

alter table public.panel_label_images
  add column if not exists deleted_at timestamptz;

-- Çöp kutusu ekranı silinen kayıtları da okuyabilsin
drop policy if exists "panel_label_regions_select" on public.panel_label_regions;
create policy "panel_label_regions_select"
  on public.panel_label_regions for select
  using (true);

drop policy if exists "panel_label_panels_select" on public.panel_label_panels;
create policy "panel_label_panels_select"
  on public.panel_label_panels for select
  using (true);

drop policy if exists "panel_label_images_select" on public.panel_label_images;
create policy "panel_label_images_select"
  on public.panel_label_images for select
  using (true);
