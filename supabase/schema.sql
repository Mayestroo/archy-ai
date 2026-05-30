-- Create the floor_plans table
CREATE TABLE public.floor_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  enhanced_prompt TEXT NOT NULL,
  floor_plan_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

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

-- Policy: Users can delete their own floor plans
CREATE POLICY "Users can delete their own floor plans"
ON public.floor_plans
FOR DELETE
USING (auth.uid() = user_id);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
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
