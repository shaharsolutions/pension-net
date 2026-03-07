-- ============================================
-- System Feedback Setup
-- ============================================

-- 1. Create system_feedback table
CREATE TABLE IF NOT EXISTS public.system_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    content TEXT NOT NULL,
    announcement_id UUID REFERENCES public.system_announcements(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.system_feedback ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.system_feedback;
CREATE POLICY "Users can insert their own feedback"
ON public.system_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view all feedback" ON public.system_feedback;
CREATE POLICY "Admin can view all feedback"
ON public.system_feedback
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');
