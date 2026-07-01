-- Pano etiket: bulunamadı iş akışı durumu

alter table public.panel_label_panels
  drop constraint if exists panel_label_panels_workflow_status_check;

alter table public.panel_label_panels
  add constraint panel_label_panels_workflow_status_check
  check (workflow_status in ('neutral', 'in_progress', 'completed', 'not_found'));
