-- ============================================
-- Multi-Tenant / Multi-User Support Migration
-- This script splits Business info from User info
-- ============================================

-- 1. Create the Pensions table (Organizations)
CREATE TABLE IF NOT EXISTS public.pensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    phone TEXT,
    location TEXT,
    max_capacity INTEGER DEFAULT 10,
    default_price INTEGER DEFAULT 130,
    manager_pin TEXT, -- For backward compatibility
    manager_password TEXT DEFAULT '1234', -- New password field
    is_visible BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was created in a previous run
ALTER TABLE public.pensions ADD COLUMN IF NOT EXISTS manager_password TEXT DEFAULT '1234';

-- 2. Migrate existing profile data to pensions table if they have a business name
-- This assumes each current user is a manager of their own business
INSERT INTO public.pensions (name, owner_id, phone, location, max_capacity, default_price, manager_pin, manager_password, is_visible, created_at)
SELECT 
    business_name, 
    user_id, 
    phone, 
    location, 
    COALESCE(max_capacity, 10), 
    COALESCE(default_price, 130), 
    manager_pin,
    COALESCE(manager_pin, '1234'), -- Initialize password with old pin
    COALESCE(is_visible, true),
    created_at
FROM public.profiles
WHERE business_name IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Update Profiles table to link to Pensions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pension_id UUID REFERENCES public.pensions(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT; -- Store email for lookup/invite
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee'; -- 'manager', 'employee', 'admin'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'Password'; -- New password field
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'; -- Array of strings: 'manage_leads', 'manage_orders', 'manage_clients' etc.

-- 4. Link existing profiles to their newly created pensions
UPDATE public.profiles p
SET 
    pension_id = pen.id,
    role = 'manager',
    password = pen.manager_password, -- Migration existing pin to password
    permissions = '["all"]'::jsonb
FROM public.pensions pen
WHERE p.user_id = pen.owner_id;

-- 5. Add pension_id to other relevant tables for multi-tenancy isolation
-- Orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pension_id UUID REFERENCES public.pensions(id);
UPDATE public.orders o
SET pension_id = p.pension_id
FROM public.profiles p
WHERE o.user_id = p.user_id
AND o.pension_id IS NULL;

-- Leads table
ALTER TABLE public.pension_leads ADD COLUMN IF NOT EXISTS pension_id UUID REFERENCES public.pensions(id);
-- Note: existing leads might not have a user_id, so we might need a default or manual assignment if they were global.
-- But usually leads are created within a session.

-- 6. Enable RLS on Pensions
ALTER TABLE public.pensions ENABLE ROW LEVEL SECURITY;

-- 7. SECURITY DEFINER functions to break RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_pension_id()
RETURNS UUID AS $$
  -- Accesses profiles without triggering RLS
  SELECT pension_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  -- Accesses profiles without triggering RLS
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 8. RLS Policies for Pensions (Stable)
DROP POLICY IF EXISTS "Users can view their own pension" ON public.pensions;
CREATE POLICY "Users can view their own pension" ON public.pensions
    FOR SELECT TO authenticated 
    USING (id = public.get_my_pension_id());

DROP POLICY IF EXISTS "Managers can update their own pension" ON public.pensions;
CREATE POLICY "Managers can update their own pension" ON public.pensions
    FOR UPDATE TO authenticated 
    USING (id = public.get_my_pension_id() AND public.get_my_role() = 'manager');

-- 9. Update Profile Policies (Safe & Explicit)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR ALL TO authenticated 
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view profiles in their pension" ON public.profiles;
CREATE POLICY "Users can view profiles in their pension" ON public.profiles
    FOR SELECT TO authenticated 
    USING (pension_id = public.get_my_pension_id());

DROP POLICY IF EXISTS "Managers can insert profiles in their pension" ON public.profiles;
CREATE POLICY "Managers can insert profiles in their pension" ON public.profiles
    FOR INSERT TO authenticated 
    WITH CHECK (
        pension_id = public.get_my_pension_id() 
        AND public.get_my_role() = 'manager'
    );

DROP POLICY IF EXISTS "Managers can update profiles in their pension" ON public.profiles;
CREATE POLICY "Managers can update profiles in their pension" ON public.profiles
    FOR UPDATE TO authenticated 
    USING (
        pension_id = public.get_my_pension_id() 
        AND public.get_my_role() = 'manager'
    );

-- 10. Function to handle new user joins / profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_v2()
RETURNS trigger AS $$
DECLARE
    target_pension_id UUID;
    target_role TEXT;
    existing_profile_id UUID;
BEGIN
  target_pension_id := (new.raw_user_meta_data->>'pension_id')::UUID;
  target_role := COALESCE(new.raw_user_meta_data->>'role', 'manager');

  -- Check if a profile was already created by a manager for this email
  SELECT id INTO existing_profile_id FROM public.profiles WHERE email = new.email LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Link the newly authenticated user to the existing pre-created profile
    UPDATE public.profiles 
    SET user_id = new.id,
        full_name = COALESCE(full_name, new.raw_user_meta_data->>'full_name')
    WHERE id = existing_profile_id;
  ELSE
    -- Completely new user (e.g. new manager signing up)
    INSERT INTO public.profiles (
      user_id, 
      phone, 
      full_name, 
      pension_id, 
      role, 
      permissions,
      email
    )
    VALUES (
      new.id,
      new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'full_name',
      target_pension_id,
      target_role,
      CASE WHEN target_role = 'manager' THEN '["all"]'::jsonb ELSE '[]'::jsonb END,
      new.email
    );
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_v2();

-- 11. Cleanup orphaned profiles from previous failed link attempts
UPDATE public.profiles p1
SET user_id = p2.user_id
FROM public.profiles p2
WHERE p1.email = p2.email 
  AND p1.id != p2.id 
  AND p1.user_id IS NULL 
  AND p2.user_id IS NOT NULL;

DELETE FROM public.profiles WHERE pension_id IS NULL AND role = 'employee';
