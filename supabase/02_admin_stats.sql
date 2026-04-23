-- ユーザー別統計取得用 RPC
create or replace function get_user_stats(p_user_id uuid)
returns json
language sql
security definer
as $$
  select json_build_object(
    'total_clips',          (select count(*) from clips where user_id = p_user_id),
    'unread_clips',         (select count(*) from clips where user_id = p_user_id and is_read = false),
    'bookmarked_clips',     (select count(*) from clips where user_id = p_user_id and is_bookmarked = true),
    'clips_without_summary',(select count(*) from clips where user_id = p_user_id and summary is null),
    'recent_clips_7d',      (select count(*) from clips where user_id = p_user_id and created_at > now() - interval '7 days'),
    'total_tags',           (select count(*) from clip_tags where user_id = p_user_id),
    'total_collections',    (select count(*) from collections where user_id = p_user_id),
    'clips_by_type', (
      select coalesce(json_object_agg(content_type, cnt), '{}'::json)
      from (
        select content_type, count(*) as cnt
        from clips
        where user_id = p_user_id
        group by content_type
      ) t
    )
  );
$$;
