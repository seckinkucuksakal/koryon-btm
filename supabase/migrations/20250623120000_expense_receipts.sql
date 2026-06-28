-- Harcırah fişleri: seyahat klasörleri ve fiş kayıtları

create table if not exists public.expense_folders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  user_id text not null default 'shared',
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.expense_folders (id) on delete cascade,
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  receipt_date date not null,
  storage_path text not null,
  mime_type text not null default 'image/jpeg',
  user_id text not null default 'shared',
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists expense_receipts_folder_id_idx
  on public.expense_receipts (folder_id);

create index if not exists expense_receipts_receipt_date_idx
  on public.expense_receipts (receipt_date desc);

alter table public.expense_folders enable row level security;
alter table public.expense_receipts enable row level security;

-- Takım içi paylaşımlı erişim (mevcut ünite/oda/pano modeliyle uyumlu)
create policy "expense_folders_select"
  on public.expense_folders for select
  using (visible = true);

create policy "expense_folders_insert"
  on public.expense_folders for insert
  with check (true);

create policy "expense_folders_update"
  on public.expense_folders for update
  using (true);

create policy "expense_folders_delete"
  on public.expense_folders for delete
  using (true);

create policy "expense_receipts_select"
  on public.expense_receipts for select
  using (visible = true);

create policy "expense_receipts_insert"
  on public.expense_receipts for insert
  with check (true);

create policy "expense_receipts_update"
  on public.expense_receipts for update
  using (true);

create policy "expense_receipts_delete"
  on public.expense_receipts for delete
  using (true);
