-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Add an embedding column to the clips table
-- OpenAI's text-embedding-3-small outputs 1536 dimensions by default
alter table public.clips add column if not exists embedding vector(1536);

-- Create a function to search for matching clips using cosine similarity
create or replace function match_clips (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  title text,
  summary text,
  content_type text,
  similarity float
)
language sql stable
as $$
  select
    clips.id,
    clips.title,
    clips.summary,
    clips.content_type,
    1 - (clips.embedding <=> query_embedding) as similarity
  from clips
  where 1 - (clips.embedding <=> query_embedding) > match_threshold
    and clips.user_id = p_user_id
  order by similarity desc
  limit match_count;
$$;
