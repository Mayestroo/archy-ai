-- Add credits column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Function: award credits to referrer when a new user signs up with a ref
-- Called via a Supabase Database Webhook or trigger on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_referral_signup()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id UUID;
BEGIN
  -- Extract referrer from raw_user_meta_data (set during signup via ?ref=<uuid>)
  referrer_id := (NEW.raw_user_meta_data->>'referred_by')::UUID;

  IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
    -- Create profile for the new user, storing who referred them
    INSERT INTO public.profiles (id, referred_by, credits, updated_at)
    VALUES (NEW.id, referrer_id, 10, NOW())  -- new user gets 10 credits
    ON CONFLICT (id) DO UPDATE
      SET referred_by = EXCLUDED.referred_by,
          credits = profiles.credits + 10,
          updated_at = NOW();

    -- Award 10 credits to the referrer
    INSERT INTO public.profiles (id, credits, updated_at)
    VALUES (referrer_id, 10, NOW())
    ON CONFLICT (id) DO UPDATE
      SET credits = profiles.credits + 10,
          updated_at = NOW();
  ELSE
    -- New user with no referral: just ensure their profile row exists
    INSERT INTO public.profiles (id, credits, updated_at)
    VALUES (NEW.id, 0, NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire after every new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_referral_signup();

-- Expose credits in getProfile queries (already covered by SELECT * on profiles)
-- Add policy so users can read their own credits
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);
