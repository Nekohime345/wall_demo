create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author text not null default 'Alex Morgan',
  content text not null check (char_length(content) between 1 and 280),
  created_at timestamptz not null default now()
);

alter table public.posts add column if not exists image_url text;
alter table public.posts alter column author set default 'Wall visitor';

alter table public.posts enable row level security;

grant select, insert on public.posts to anon, authenticated;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts" on public.posts
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can share posts" on public.posts;
create policy "Anyone can share posts" on public.posts
  for insert to anon, authenticated with check (
    author = btrim(author)
    and char_length(author) between 1 and 40
    and char_length(btrim(content)) between 1 and 280
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wall-photos', 'wall-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view wall photos" on storage.objects;
create policy "Anyone can view wall photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'wall-photos');

drop policy if exists "Anyone can upload wall photos" on storage.objects;
create policy "Anyone can upload wall photos" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'wall-photos');
