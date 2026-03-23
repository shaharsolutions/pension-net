-- Add custom_events column to profiles table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'custom_events') THEN
        ALTER TABLE public.profiles ADD COLUMN custom_events JSONB DEFAULT '[]';
    END IF;
END $$;
