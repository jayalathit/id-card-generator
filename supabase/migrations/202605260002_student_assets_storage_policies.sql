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
