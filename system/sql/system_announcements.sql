-- ============================================
-- System Announcements Setup
-- ============================================

-- 1. Create system_announcements table
CREATE TABLE IF NOT EXISTS public.system_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT -- email of the admin
);

-- 2. Enable RLS
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "Everyone can read active announcements" ON public.system_announcements;
CREATE POLICY "Everyone can read active announcements"
ON public.system_announcements
FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Admin can manage announcements" ON public.system_announcements;
CREATE POLICY "Admin can manage announcements"
ON public.system_announcements
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');

-- 4. Add last_seen_announcement_id to profiles (safely)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen_announcement_id') THEN
            ALTER TABLE public.profiles ADD COLUMN last_seen_announcement_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'seen_announcement_at') THEN
            ALTER TABLE public.profiles ADD COLUMN seen_announcement_at TIMESTAMP WITH TIME ZONE;
        END IF;
    ELSE
        RAISE NOTICE 'Table public.profiles does not exist. Please ensure multi_user_migration.sql has been run.';
    END IF;
END $$;

-- 5. Seed an initial announcement (optional, but good for testing)
-- INSERT INTO public.system_announcements (content, is_active, created_by)
-- VALUES ('ברוכים הבאים למערכת פנסיון-נט המעודכנת! הוספנו אפשרות לניהול לקוחות וסטטיסטיקות מתקדמות.', true, 'shaharsolutions@gmail.com');
