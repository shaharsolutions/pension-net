-- ============================================
-- Fix: Pensions Visibility Persistence
-- Ensures is_visible column exists and can be updated by admin.
-- ============================================

-- 1. Ensure is_visible column exists in profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'is_visible') THEN
        ALTER TABLE public.profiles ADD COLUMN is_visible BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 2. Update existing rows to be visible by default if they are null
UPDATE public.profiles SET is_visible = true WHERE is_visible IS NULL;

-- 3. Add update policy for admin to manage profiles
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

CREATE POLICY "Admin can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com'
)
WITH CHECK (
    auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com'
);

-- 4. Ensure admin can also see all profiles regardless of other policies
DROP POLICY IF EXISTS "Admin can view all profiles visibility" ON public.profiles;
CREATE POLICY "Admin can view all profiles visibility"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com'
);
