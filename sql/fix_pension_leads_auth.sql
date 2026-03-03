
-- Ensure public (anon) select access is allowed for the leads system
-- This fixes the 401 Unauthorized errors on page load when not logged in.

DO $$
BEGIN
    -- Table: pension_leads
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pension_leads' AND policyname = 'Allow public select'
    ) THEN
        CREATE POLICY "Allow public select" ON pension_leads FOR SELECT TO anon, authenticated USING (true);
    END IF;

    -- Table: pension_lead_logs
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pension_lead_logs' AND policyname = 'Allow public select logs'
    ) THEN
        CREATE POLICY "Allow public select logs" ON pension_lead_logs FOR SELECT TO anon, authenticated USING (true);
    END IF;

    -- Table: pension_lead_tasks
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pension_lead_tasks' AND policyname = 'Allow public select tasks'
    ) THEN
        CREATE POLICY "Allow public select tasks" ON pension_lead_tasks FOR SELECT TO anon, authenticated USING (true);
    END IF;
END
$$;

-- Ensure write operations are permitted for authenticated users

-- Leads
DROP POLICY IF EXISTS "Allow authenticated insert" ON pension_leads;
CREATE POLICY "Allow authenticated insert" ON pension_leads FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update" ON pension_leads;
CREATE POLICY "Allow authenticated update" ON pension_leads FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete" ON pension_leads;
CREATE POLICY "Allow authenticated delete" ON pension_leads FOR DELETE TO authenticated USING (true);

-- Logs
DROP POLICY IF EXISTS "Allow authenticated insert logs" ON pension_lead_logs;
CREATE POLICY "Allow authenticated insert logs" ON pension_lead_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update logs" ON pension_lead_logs;
CREATE POLICY "Allow authenticated update logs" ON pension_lead_logs FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete logs" ON pension_lead_logs;
CREATE POLICY "Allow authenticated delete logs" ON pension_lead_logs FOR DELETE TO authenticated USING (true);

-- Tasks
DROP POLICY IF EXISTS "Allow authenticated insert tasks" ON pension_lead_tasks;
CREATE POLICY "Allow authenticated insert tasks" ON pension_lead_tasks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update tasks" ON pension_lead_tasks;
CREATE POLICY "Allow authenticated update tasks" ON pension_lead_tasks FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete tasks" ON pension_lead_tasks;
CREATE POLICY "Allow authenticated delete tasks" ON pension_lead_tasks FOR DELETE TO authenticated USING (true);
