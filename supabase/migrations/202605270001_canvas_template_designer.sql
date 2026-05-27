alter table public.card_config
  add column if not exists primary_color text not null default '#0c2340',
  add column if not exists accent_color text not null default '#e2a812',
  add column if not exists canvas_elements jsonb not null default '[]'::jsonb;

update public.card_config
set
  primary_color = coalesce(nullif(primary_color, ''), '#0c2340'),
  accent_color = coalesce(nullif(accent_color, ''), '#e2a812'),
  canvas_elements = coalesce(canvas_elements, '[]'::jsonb)
where id = 1;
