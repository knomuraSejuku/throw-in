-- Separate whether a plan is active from whether it is shown to new subscribers.

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true NOT NULL;

UPDATE public.billing_plans
SET is_visible = true
WHERE is_visible IS NULL;

DROP POLICY IF EXISTS "active plans are public" ON public.billing_plans;
DROP POLICY IF EXISTS "visible active plans are public" ON public.billing_plans;
CREATE POLICY "visible active plans are public" ON public.billing_plans
  FOR SELECT USING (is_active = true AND is_visible = true);
