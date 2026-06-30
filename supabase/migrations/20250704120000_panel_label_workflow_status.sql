-- Pano etiket: pano iş akışı durumu

alter table public.panel_label_panels
  add column if not exists workflow_status text
  check (workflow_status in ('neutral', 'in_progress', 'completed'));

create index if not exists panel_label_panels_workflow_status_idx
  on public.panel_label_panels (region_id, workflow_status)
  where visible = true;
