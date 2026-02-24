-- Add clients_data column to profiles table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'clients_data') THEN
        ALTER TABLE public.profiles ADD COLUMN clients_data JSONB DEFAULT '{}';
    END IF;
END $$;
