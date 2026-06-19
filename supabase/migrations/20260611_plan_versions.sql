-- Persist immutable snapshots each time a saved floor plan is saved.
CREATE TABLE IF NOT EXISTS public.floor_plan_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  floor_plan_id UUID NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  prompt TEXT NOT NULL,
  enhanced_prompt TEXT NOT NULL,
  floor_plan_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (floor_plan_id, version_number)
);

CREATE INDEX IF NOT EXISTS floor_plan_versions_plan_created_idx
  ON public.floor_plan_versions (floor_plan_id, created_at DESC);

ALTER TABLE public.floor_plan_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own floor plan versions" ON public.floor_plan_versions;
CREATE POLICY "Users can insert their own floor plan versions"
ON public.floor_plan_versions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own floor plan versions" ON public.floor_plan_versions;
CREATE POLICY "Users can view their own floor plan versions"
ON public.floor_plan_versions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own floor plan versions" ON public.floor_plan_versions;
CREATE POLICY "Users can delete their own floor plan versions"
ON public.floor_plan_versions
FOR DELETE
USING (auth.uid() = user_id);
