-- Add website column to pension_leads table
ALTER TABLE IF EXISTS public.pension_leads 
ADD COLUMN IF NOT EXISTS website TEXT;
