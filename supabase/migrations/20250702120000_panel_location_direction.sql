-- Pano etiket: lokasyon tarifi

alter table public.panel_label_panels
  add column if not exists location_direction text;
