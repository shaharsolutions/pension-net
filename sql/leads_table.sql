-- ==============================
-- Leads Table - טופס השארת פרטים
-- ==============================

CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    pension_size TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed'))
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from the landing page form)
CREATE POLICY "Allow anonymous inserts on leads"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow authenticated users to read all leads (for admin)  
CREATE POLICY "Allow authenticated users to read leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update leads (for admin)
CREATE POLICY "Allow authenticated users to update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true);

-- Index for faster queries
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_status ON public.leads(status);
