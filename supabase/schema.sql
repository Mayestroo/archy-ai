-- Create the floor_plans table
CREATE TABLE public.floor_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  enhanced_prompt TEXT NOT NULL,
  floor_plan_json JSONB NOT NULL,
  share_token TEXT,
  share_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shared_at TIMESTAMPTZ,
  user_type TEXT CHECK (
    user_type IS NULL OR user_type IN (
      'homeowner',
      'architect_designer',
      'real_estate_builder'
    )
  ),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX floor_plans_share_token_unique
  ON public.floor_plans (share_token)
  WHERE share_token IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own floor plans
CREATE POLICY "Users can insert their own floor plans" 
ON public.floor_plans
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can select (view) their own floor plans
CREATE POLICY "Users can view their own floor plans"
ON public.floor_plans
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Shared plans can be viewed by anyone with the link token
CREATE POLICY "Shared floor plans are publicly viewable"
ON public.floor_plans
FOR SELECT
USING (share_enabled = true AND share_token IS NOT NULL);

-- Policy: Users can update their own floor plans
CREATE POLICY "Users can update their own floor plans"
ON public.floor_plans
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own floor plans
CREATE POLICY "Users can delete their own floor plans"
ON public.floor_plans
FOR DELETE
USING (auth.uid() = user_id);

-- Create immutable floor plan versions table
CREATE TABLE public.floor_plan_versions (
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

CREATE INDEX floor_plan_versions_plan_created_idx
  ON public.floor_plan_versions (floor_plan_id, created_at DESC);

ALTER TABLE public.floor_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own floor plan versions"
ON public.floor_plan_versions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own floor plan versions"
ON public.floor_plan_versions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own floor plan versions"
ON public.floor_plan_versions
FOR DELETE
USING (auth.uid() = user_id);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  user_type TEXT CHECK (
    user_type IS NULL OR user_type IN (
      'homeowner',
      'architect_designer',
      'real_estate_builder'
    )
  ),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profiles" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies for reviews
CREATE POLICY "Reviews are viewable by everyone" 
  ON public.reviews FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own reviews" 
  ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
  ON public.reviews FOR UPDATE 
  USING (auth.uid() = user_id);

-- Function to get global platform stats securely bypassing RLS
CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS JSON AS $$
DECLARE
  project_count INTEGER;
  user_count INTEGER;
  avg_rating FLOAT;
BEGIN
  -- Count all projects
  SELECT count(*) INTO project_count FROM public.floor_plans;
  
  -- Count all registered users
  SELECT count(*) INTO user_count FROM auth.users;

  -- Calculate average rating
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating FROM public.reviews;
  
  RETURN json_build_object(
    'project_count', project_count,
    'user_count', user_count,
    'avg_rating', ROUND(avg_rating::numeric, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
