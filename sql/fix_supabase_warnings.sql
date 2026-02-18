-- SUPABASE PERFORMANCE & SECURITY FIXES
-- This script addresses "auth_rls_initplan" and "multiple_permissive_policies" warnings.

-- 1. DROP REDUNDANT/DUPLICATE POLICIES (Fixes "multiple_permissive_policies")
-- These names were identified from the Supabase linter report as duplicates.

-- Table: public.orders
DROP POLICY IF EXISTS "Owners manual full access" ON public.orders;
DROP POLICY IF EXISTS "Anon guest insert" ON public.orders;
DROP POLICY IF EXISTS "Anon guest access" ON public.orders;

-- Table: public.profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;


-- 2. UPDATE REMAINING POLICIES WITH OPTIMIZED AUTH CALLS (Fixes "auth_rls_initplan")
-- Wrapping auth.uid() in a subquery (select auth.uid()) prevents re-evaluation for every row.

-- --- Table: public.orders ---
DROP POLICY IF EXISTS "Owners have full access to their own data" ON public.orders;
CREATE POLICY "Owners have full access to their own data"
ON public.orders
FOR ALL
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- --- Table: public.profiles ---
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

-- --- Table: public.audit_logs ---
DROP POLICY IF EXISTS "Users can only see their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can only see their own audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- 3. ENSURE PERMISSIVE POLICIES ARE CLEAN (RE-CREATING TO BE CERTAIN)
DROP POLICY IF EXISTS "Anon can see orders for specific user_id" ON public.orders;
CREATE POLICY "Anon can see orders for specific user_id"
ON public.orders
FOR SELECT
TO anon
USING (user_id IS NOT NULL);

DROP POLICY IF EXISTS "Anon can insert orders with user_id" ON public.orders;
CREATE POLICY "Anon can insert orders with user_id"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (user_id IS NOT NULL);

DROP POLICY IF EXISTS "Anon can see public profile info" ON public.profiles;
CREATE POLICY "Anon can see public profile info"
ON public.profiles
FOR SELECT
TO anon
USING (true);
