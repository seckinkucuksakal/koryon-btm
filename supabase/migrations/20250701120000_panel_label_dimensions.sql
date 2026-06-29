-- Pano etiket: pano boyutları (cm)

alter table public.panel_label_panels
  add column if not exists width_cm numeric(8, 2),
  add column if not exists height_cm numeric(8, 2),
  add column if not exists depth_cm numeric(8, 2);
