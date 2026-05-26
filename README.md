# Forklift Operator ID Generator

React/Vite application for managing operator ID cards and exporting printable PDF cards.

## Supabase Setup

The application stores:

- Operator/student record text in `public.students`
- Card template settings in `public.card_config`
- Photos and signature images in the private `student-assets` Storage bucket

Identity data is protected with Supabase Auth and Row Level Security. Only authenticated users explicitly added to `public.staff_members` can read or modify records and images.

1. Open the Supabase project SQL Editor.
2. Run [`supabase/migrations/202605260001_initial_id_card_schema.sql`](supabase/migrations/202605260001_initial_id_card_schema.sql). It is safe to rerun when applying a policy update.
3. Open **Authentication > Users** and create at least one staff email/password user.
4. In SQL Editor, allow that user to access the app, replacing the email below:

```sql
insert into public.staff_members (user_id)
select id from auth.users where lower(email) = lower('staff@example.com')
on conflict (user_id) do nothing;
```

5. Set these Vercel environment variables for Production, Preview, and Development:

```env
VITE_SUPABASE_URL=https://rnhbmpnwypgpnyxqijky.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BdhicSpQpnISdX5PSlETBg_feI1hMI2
```

The publishable key is intended for frontend use. Never put the database password or a service-role secret in Vercel variables beginning with `VITE_`.

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run build
```
