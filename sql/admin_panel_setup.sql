-- ============================================
-- Admin Panel Setup SQL
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create user_sessions table for tracking login sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    duration_minutes INTEGER DEFAULT 0
);

-- 2. Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (safe re-run)
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Admin can view all sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Admin can view all user_sessions" ON public.user_sessions;

-- 4. Regular user policies - users can manage their own sessions
CREATE POLICY "Users can insert their own sessions"
ON public.user_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.user_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Combined SELECT policy: users see their own, admin sees all
CREATE POLICY "Users can view their own sessions"
ON public.user_sessions
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com'
);

-- 6. Update orders RLS to allow admin full access
-- Drop and recreate the owner policy to include admin access
DROP POLICY IF EXISTS "Owners have full access to their own data" ON orders;
DROP POLICY IF EXISTS "Admin and owners have full access" ON orders;

CREATE POLICY "Admin and owners have full access"
ON orders
FOR ALL
TO authenticated
USING (
    (select auth.uid()) = user_id
    OR auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com'
)
WITH CHECK (
    (select auth.uid()) = user_id
    OR auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com'
);

-- 7. Update profiles RLS to allow admin to view all profiles
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    (select auth.uid()) = user_id
    OR auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com'
);

-- 8. Update audit_logs RLS to allow admin to view all logs (if table exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admin can view all audit_logs" ON public.audit_logs';
        EXECUTE 'CREATE POLICY "Admin can view all audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.jwt() ->> ''email'' = ''shaharsolutions@gmail.com'')';
    END IF;
END $$;

-- 9. Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_time ON public.user_sessions(login_time DESC);
