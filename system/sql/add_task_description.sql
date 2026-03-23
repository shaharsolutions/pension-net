-- Add description column to pension_lead_tasks
ALTER TABLE pension_lead_tasks ADD COLUMN IF NOT EXISTS description TEXT;
