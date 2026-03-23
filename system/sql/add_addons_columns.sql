-- Add addons columns to orders and profiles tables
DO $$ 
BEGIN 
    -- Add addons column to orders table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'addons') THEN
        ALTER TABLE public.orders ADD COLUMN addons JSONB DEFAULT '[]';
    END IF;

    -- Add addons_definitions column to profiles table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'addons_definitions') THEN
        ALTER TABLE public.profiles ADD COLUMN addons_definitions JSONB DEFAULT '[]';
    END IF;
END $$;
