-- =====================================================================================
-- Throw In - Initial Schema Definition & RLS Policies
-- =====================================================================================

-- 拡張機能の有効化
create extension if not exists "uuid-ossp";

-- =====================================================================================
-- 1. テーブル定義
-- =====================================================================================

-- ユーザーテーブル (Supabase Authと連携)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- クリップ（メインデータ）テーブル
create table public.clips (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  title text not null,
  url text,
  content_type text not null, -- 'article', 'video', 'image', 'document', 'note'
  preview_image_url text,
  summary text,
  extracted_content text,
  my_note text,
  is_bookmarked boolean default false,
  is_read boolean default false,
  source_domain text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- コレクションテーブル
create table public.collections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- クリップ・コレクション 中間テーブル (M:N)
create table public.clip_collections (
  clip_id uuid references public.clips on delete cascade not null,
  collection_id uuid references public.collections on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (clip_id, collection_id)
);

-- クリップ・タグテーブル
create table public.clip_tags (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  clip_id uuid references public.clips on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 閲覧履歴テーブル
create table public.history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users on delete cascade not null,
  clip_id uuid references public.clips on delete cascade not null,
  viewed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =====================================================================================
-- 2. トランザクション処理 (Triggers)
-- =====================================================================================

-- Supabase Auth に新規ユーザーが作成されたら、public.usersにも自動連携する
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 更新日時の自動更新 (updated_at)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger set_clips_updated_at
  before update on public.clips
  for each row execute procedure public.set_updated_at();

-- =====================================================================================
-- 3. Row Level Security (RLS) ポリシーの設定
-- =====================================================================================

-- RLSの有効化
alter table public.users enable row level security;
alter table public.clips enable row level security;
alter table public.collections enable row level security;
alter table public.clip_collections enable row level security;
alter table public.clip_tags enable row level security;
alter table public.history enable row level security;

-- 自分が所有するデータに対してのみ [CRUD] を許可する
create policy "自分のプロフィールのみ参照可能" on public.users for select using (auth.uid() = id);
create policy "自分のプロフィールのみ更新可能" on public.users for update using (auth.uid() = id);

create policy "自分のクリップのみ操作可能" on public.clips for all using (auth.uid() = user_id);
create policy "自分のコレクションのみ操作可能" on public.collections for all using (auth.uid() = user_id);
create policy "自分のタグのみ操作可能" on public.clip_tags for all using (auth.uid() = user_id);
create policy "自分の履歴のみ操作可能" on public.history for all using (auth.uid() = user_id);

-- 中間テーブルは、該当コレクションが自分のものなら操作可能
create policy "紐づくコレクションの持ち主なら操作可能" on public.clip_collections for all
using (
  exists (
    select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()
  )
);
