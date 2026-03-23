-- ============================================
-- Add Delete Policies for Admin
-- ============================================

-- 1. Policy for user_sessions
DROP POLICY IF EXISTS "Admin can delete all user_sessions" ON public.user_sessions;
CREATE POLICY "Admin can delete all user_sessions"
ON public.user_sessions
FOR DELETE
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');

-- 2. Policy for audit_logs
DROP POLICY IF EXISTS "Admin can delete all audit_logs" ON public.audit_logs;
CREATE POLICY "Admin can delete all audit_logs"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');
