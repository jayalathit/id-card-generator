alter table public.card_config
add column if not exists admin_signature_text text not null default 'Admin Department';

update public.card_config
set admin_signature_text = 'Admin Department'
where id = 1 and length(btrim(admin_signature_text)) = 0;

drop index if exists public.students_nic_unique_ci;

create unique index if not exists students_nic_designation_unique_ci
on public.students (lower(btrim(nic)), card_designation);
