-- Capture the primary user segment selected during signup.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type TEXT;

ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS user_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_type_check
      CHECK (
        user_type IS NULL OR user_type IN (
          'homeowner',
          'architect_designer',
          'real_estate_builder'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'floor_plans_user_type_check'
  ) THEN
    ALTER TABLE public.floor_plans
      ADD CONSTRAINT floor_plans_user_type_check
      CHECK (
        user_type IS NULL OR user_type IN (
          'homeowner',
          'architect_designer',
          'real_estate_builder'
        )
      );
  END IF;
END $$;
