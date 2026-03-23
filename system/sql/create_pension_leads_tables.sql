
-- Drop existing tables if needed (optional)
-- DROP TABLE IF EXISTS pension_lead_tasks;
-- DROP TABLE IF EXISTS pension_lead_logs;
-- DROP TABLE IF EXISTS pension_leads;

-- 1. Table for leads
CREATE TABLE IF NOT EXISTS pension_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    type TEXT DEFAULT 'ביתי',
    size TEXT DEFAULT 'קטן',
    source TEXT,
    status TEXT DEFAULT 'לא פניתי',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table for logs (history of interactions/notes)
CREATE TABLE IF NOT EXISTS pension_lead_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES pension_leads(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table for tasks
CREATE TABLE IF NOT EXISTS pension_lead_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES pension_leads(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open', -- 'open', 'done'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    done_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS (Optional, but recommended for Supabase)
ALTER TABLE pension_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pension_lead_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pension_lead_tasks ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (if that's the current environment)
-- NOTE: In production, these should be restricted to authenticated users.
CREATE POLICY "Allow public select" ON pension_leads FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON pension_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON pension_leads FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON pension_leads FOR DELETE USING (true);

CREATE POLICY "Allow public select logs" ON pension_lead_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert logs" ON pension_lead_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update logs" ON pension_lead_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete logs" ON pension_lead_logs FOR DELETE USING (true);

CREATE POLICY "Allow public select tasks" ON pension_lead_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert tasks" ON pension_lead_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tasks" ON pension_lead_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete tasks" ON pension_lead_tasks FOR DELETE USING (true);

-- Insert sample data (based on INITIAL_LEADS but as SQL)
-- Note: Using arbitrary fixed UUIDs for sample data to maintain relationships if needed
INSERT INTO pension_leads (name, city, address, phone, type, size, source, status, notes)
VALUES 
('הקאנטה של צ''יף', 'בית אלעזרי', 'הזית 2', '0507389272', 'בוטיק', 'קטן', 'איזי', 'לא פניתי', ''),
('הבית של סטארק', 'רחובות', 'המרגנית 12', '0555654666', 'בוטיק', 'בינוני', 'מידרג', 'לא פניתי', ''),
('ליקה חיות', 'ראשון לציון', 'הרצל 102', '0547375454', 'ביתי', 'קטן', 'פייסבוק', 'לא פניתי', ''),
('האוליווד Howlywood', 'גבעת חן', 'משק 15', '0558817691', 'בוטיק', 'בינוני', 'אתר הבית', 'לא פניתי', ''),
('חוות הכלבים של דרור', 'מעש', 'הצבעוני 6', '0586804812', 'בוטיק', 'בינוני', 'המלצה', 'לא פניתי', '');
