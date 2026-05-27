create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.students (
  id text primary key,
  nic text not null check (length(btrim(nic)) > 0),
  name text not null check (length(btrim(name)) > 0),
  id_number text not null check (length(btrim(id_number)) > 0),
  grade text not null default 'A',
  course text not null,
  issue_date date not null,
  training_center text not null,
  photo_path text,
  signature_type text not null default 'typed'
    check (signature_type in ('typed', 'handwritten', 'uploaded')),
  signature_text text,
  signature_path text,
  card_designation text not null default 'student'
    check (card_designation in ('student', 'operator')),
  equipment_type text not null default 'forklift'
    check (equipment_type in ('forklift', 'backhoe')),
  equipment_class text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists students_nic_designation_unique_ci
on public.students (lower(btrim(nic)), card_designation);
create unique index if not exists students_id_number_unique_ci
on public.students (lower(btrim(id_number)));

create table if not exists public.card_config (
  id smallint primary key default 1 check (id = 1),
  institution_logo_path text,
  admin_signature_text text not null default 'Admin Department',
  left_main_header text not null,
  left_sub_header text not null,
  right_main_header text not null,
  right_sub_header text not null,
  validity_years integer not null default 2 check (validity_years between 1 and 20),
  back_verification_url text not null,
  back_address text not null,
  back_contact_phone text not null,
  back_contact_email text not null,
  back_logo_label text not null,
  primary_color text not null default '#0c2340',
  accent_color text not null default '#e2a812',
  canvas_elements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create schema if not exists private;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_staff() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists card_config_set_updated_at on public.card_config;
create trigger card_config_set_updated_at
before update on public.card_config
for each row execute function public.set_updated_at();

alter table public.students enable row level security;
alter table public.card_config enable row level security;
alter table public.staff_members enable row level security;

revoke all on public.students from anon;
revoke all on public.card_config from anon;
revoke all on public.staff_members from anon, authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update on public.card_config to authenticated;

drop policy if exists "Authenticated staff can read students" on public.students;
drop policy if exists "Authenticated staff can create students" on public.students;
drop policy if exists "Authenticated staff can update students" on public.students;
drop policy if exists "Authenticated staff can delete students" on public.students;
create policy "Authenticated staff can read students"
on public.students for select to authenticated using ((select private.is_staff()));
create policy "Authenticated staff can create students"
on public.students for insert to authenticated with check ((select private.is_staff()));
create policy "Authenticated staff can update students"
on public.students for update to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));
create policy "Authenticated staff can delete students"
on public.students for delete to authenticated using ((select private.is_staff()));

drop policy if exists "Authenticated staff can read card config" on public.card_config;
drop policy if exists "Authenticated staff can create card config" on public.card_config;
drop policy if exists "Authenticated staff can update card config" on public.card_config;
create policy "Authenticated staff can read card config"
on public.card_config for select to authenticated using ((select private.is_staff()));
create policy "Authenticated staff can create card config"
on public.card_config for insert to authenticated
with check (id = 1 and (select private.is_staff()));
create policy "Authenticated staff can update card config"
on public.card_config for update to authenticated
using (id = 1 and (select private.is_staff()))
with check (id = 1 and (select private.is_staff()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-assets',
  'student-assets',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated staff can read ID assets" on storage.objects;
drop policy if exists "Authenticated staff can upload ID assets" on storage.objects;
drop policy if exists "Authenticated staff can update ID assets" on storage.objects;
drop policy if exists "Authenticated staff can delete ID assets" on storage.objects;
create policy "Authenticated staff can read ID assets"
on storage.objects for select to authenticated
using (bucket_id = 'student-assets' and (select private.is_staff()));
create policy "Authenticated staff can upload ID assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'student-assets' and (select private.is_staff()));
create policy "Authenticated staff can update ID assets"
on storage.objects for update to authenticated
using (bucket_id = 'student-assets' and (select private.is_staff()))
with check (bucket_id = 'student-assets' and (select private.is_staff()));
create policy "Authenticated staff can delete ID assets"
on storage.objects for delete to authenticated
using (bucket_id = 'student-assets' and (select private.is_staff()));

drop function if exists public.is_staff();

insert into public.card_config (
  id,
  admin_signature_text,
  left_main_header,
  left_sub_header,
  right_main_header,
  right_sub_header,
  validity_years,
  back_verification_url,
  back_address,
  back_contact_phone,
  back_contact_email,
  back_logo_label
)
values (
  1,
  'Admin Department',
  'JAYALATH CAMPUS',
  'Career Education & Training Institute',
  'OFFICIAL ID',
  'CREDENTIAL',
  2,
  'jceti.com/verification',
  E'Jayalath Campus\nNo. 123, Training Road,\nKandana, Western Province, Sri Lanka.',
  '070 2 503 503',
  '011 7 503 503',
  'JAYALATH CAMPUS'
)
on conflict (id) do nothing;

insert into public.students (
  id, nic, name, id_number, grade, course, issue_date, training_center,
  signature_type, signature_text, card_designation, equipment_type, equipment_class
)
values
  (
    'student-1', '123456789V', 'John Perera', 'HMA/FL/FC/2026/000001', '',
    'Forklift Operator Training', '2026-05-25', 'Jayalath Campus',
    'typed', 'Admin Department', 'student', 'forklift', 'Counterbalance Forklift / Class A'
  ),
  (
    'student-2', '199524589V', 'Sanduni Jayasekara', 'HMA/BL/FC/2026/000002', '',
    'Backhoe Loader Operator Training', '2026-05-26', 'Jayalath Campus',
    'typed', 'Admin Department', 'student', 'backhoe', 'JCB Backhoe Loader / Class A'
  ),
  (
    'student-3', '198948123V', 'Chamara Silva', 'HMA/FL/TT/2026/000003', 'B',
    'Forklift Operator Certification', '2026-05-24', 'Jayalath Campus',
    'typed', 'Admin Department', 'operator', 'forklift', 'Counterbalance Forklift / Class A'
  )
on conflict (id) do nothing;
