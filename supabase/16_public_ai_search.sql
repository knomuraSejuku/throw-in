-- Public semantic search over globally shared clips.
-- OpenAI text-embedding-3-small outputs 1536 dimensions by default.

create or replace function public.match_public_clips (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
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
  from public.clips
  where clips.is_global_search = true
    and clips.embedding is not null
    and 1 - (clips.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
