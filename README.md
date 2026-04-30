# Throw In

Digital curator app built with Next.js, Supabase, and OpenAI.

## Local Development

Prerequisites: Node.js.

```bash
npm install
npm run dev
```

For local `.env.local`, keep only public Supabase values by default:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

Do not store production `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in local files. Configure production secrets in Vercel Environment Variables. If local AI testing is necessary, use a development-only OpenAI key with strict usage limits.

## Deploy

Deploy through Vercel's GitHub integration. Configure these environment variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` as Sensitive
- `SUPABASE_SERVICE_ROLE_KEY` as Sensitive, production only unless preview account deletion must be tested
- `TRENDING_BOT_SECRET` as Sensitive, used by the trending ingest cron endpoint
- `TRENDING_BOT_USER_ID` as the public.users/auth user id used as the normal-looking bot account

Also configure Supabase Auth redirect URLs for the Vercel production domain.
