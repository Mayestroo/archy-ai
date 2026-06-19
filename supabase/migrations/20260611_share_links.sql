-- Enable secure public client-preview links for saved floor plans.
ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS floor_plans_share_token_unique
  ON public.floor_plans (share_token)
  WHERE share_token IS NOT NULL;

DROP POLICY IF EXISTS "Users can update their own floor plans" ON public.floor_plans;
CREATE POLICY "Users can update their own floor plans"
ON public.floor_plans
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Shared floor plans are publicly viewable" ON public.floor_plans;
CREATE POLICY "Shared floor plans are publicly viewable"
ON public.floor_plans
FOR SELECT
USING (share_enabled = true AND share_token IS NOT NULL);
