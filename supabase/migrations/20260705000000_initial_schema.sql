-- comic book app — initial schema (04b)
-- single-owner app: every table is scoped to auth.uid() = user_id.
-- public share reads go through /api/share/:token using the service role key,
-- not RLS, so no anon policies are defined here.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- comic_books ----------------------------------------------------------

create table comic_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Comic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger comic_books_set_updated_at
  before update on comic_books
  for each row execute function set_updated_at();

alter table comic_books enable row level security;

create policy owner_all on comic_books
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pages ------------------------------------------------------------------

create table pages (
  id uuid primary key default gen_random_uuid(),
  comic_book_id uuid not null references comic_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_order int not null,
  drawing_url text,
  panel_url text,
  raw_transcription text,
  enhanced_narration text,
  narration_bar_text text,
  speech_bubbles jsonb not null default '[]',
  characters_in_scene uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pages_comic_book_id_idx on pages(comic_book_id, page_order);

create trigger pages_set_updated_at
  before update on pages
  for each row execute function set_updated_at();

alter table pages enable row level security;

create policy owner_all on pages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- characters ---------------------------------------------------------------

create table characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  description text not null,
  created_at timestamptz not null default now()
);

alter table characters enable row level security;

create policy owner_all on characters
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- shares ---------------------------------------------------------------------

create table shares (
  id uuid primary key default gen_random_uuid(),
  share_token uuid not null unique default gen_random_uuid(),
  comic_book_id uuid not null references comic_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index shares_share_token_idx on shares(share_token);

alter table shares enable row level security;

create policy owner_all on shares
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
