-- Billing plans, subscriptions, AI quotas, and admin access.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.users ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.admin_users (user_id)
SELECT id
FROM public.users
WHERE email IN ('knomura@sejuku.net', 'knomura@cyder.studio')
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin users can see themselves" ON public.admin_users;
CREATE POLICY "admin users can see themselves" ON public.admin_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  monthly_price_yen integer NOT NULL DEFAULT 0,
  yearly_price_yen integer NOT NULL DEFAULT 0,
  weekly_ai_limit integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

DROP TRIGGER IF EXISTS set_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER set_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

INSERT INTO public.billing_plans (code, name, description, monthly_price_yen, yearly_price_yen, weekly_ai_limit, sort_order)
VALUES
  ('free', 'Free', '個人で試すための無料プラン', 0, 0, 20, 10),
  ('plus', 'Plus', '日常的に使う個人向けプラン', 980, 9800, 120, 20),
  ('pro', 'Pro', '大量のクリップとAI整理を使うプラン', 1980, 19800, 350, 30)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active plans are public" ON public.billing_plans;
CREATE POLICY "active plans are public" ON public.billing_plans
  FOR SELECT USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.billing_plans ON DELETE RESTRICT NOT NULL,
  billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  current_period_start timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id)
);

DROP TRIGGER IF EXISTS set_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER set_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

INSERT INTO public.user_subscriptions (user_id, plan_id, billing_interval, status)
SELECT u.id, p.id, 'monthly', 'active'
FROM public.users u
CROSS JOIN public.billing_plans p
WHERE p.code = 'free'
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "自分の契約のみ参照可能" ON public.user_subscriptions;
CREATE POLICY "自分の契約のみ参照可能" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
