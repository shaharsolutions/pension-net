
-- 1. Fix Function Search Path Mutable for public.handle_new_user
-- This prevents search_path from being hijacked by malicious actors in other schemas.
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. Remediate RLS policies that are "Always True" for non-SELECT operations.
-- For the lead management system, we should at least require authentication.
-- We will replace 'true' with '(auth.role() = ''authenticated'')' for INSERT, UPDATE, DELETE.

-- Table: public.pension_leads
DROP POLICY IF EXISTS "Allow public insert" ON pension_leads;
DROP POLICY IF EXISTS "Allow public update" ON pension_leads;
DROP POLICY IF EXISTS "Allow public delete" ON pension_leads;

CREATE POLICY "Allow authenticated insert" ON pension_leads FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON pension_leads FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON pension_leads FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- Table: public.pension_lead_logs
DROP POLICY IF EXISTS "Allow public insert logs" ON pension_lead_logs;
DROP POLICY IF EXISTS "Allow public update logs" ON pension_lead_logs;
DROP POLICY IF EXISTS "Allow public delete logs" ON pension_lead_logs;

CREATE POLICY "Allow authenticated insert logs" ON pension_lead_logs FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update logs" ON pension_lead_logs FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete logs" ON pension_lead_logs FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- Table: public.pension_lead_tasks
DROP POLICY IF EXISTS "Allow public insert tasks" ON pension_lead_tasks;
DROP POLICY IF EXISTS "Allow public update tasks" ON pension_lead_tasks;
DROP POLICY IF EXISTS "Allow public delete tasks" ON pension_lead_tasks;

CREATE POLICY "Allow authenticated insert tasks" ON pension_lead_tasks FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update tasks" ON pension_lead_tasks FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete tasks" ON pension_lead_tasks FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- Note: SELECT policies with USING (true) are usually fine for public read access.
-- If you want to restrict viewing to authenticated users as well:
-- DROP POLICY "Allow public select" ON pension_leads;
-- CREATE POLICY "Allow authenticated select" ON pension_leads FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
-- ... same for logs and tasks.
