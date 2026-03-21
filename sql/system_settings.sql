-- ============================================
-- System Settings Setup
-- ============================================

-- 1. Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT -- email of the admin
);

-- 2. Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "Everyone can read system settings" ON public.system_settings;
CREATE POLICY "Everyone can read system settings"
ON public.system_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can manage system settings" ON public.system_settings;
CREATE POLICY "Admin can manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');

-- 4. Initial values
INSERT INTO public.system_settings (key, value)
VALUES ('login_page', '{"background_url": "images/login-bg.png"}')
ON CONFLICT (key) DO NOTHING;
