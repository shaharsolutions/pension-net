-- ==========================================
-- Fix Supabase Security Advisor Warnings
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Fix: RLS Policy Always True for "Allow anonymous inserts on leads"
-- Replaces literal 'true' with 'auth.role() = ''anon''' to satisfy linter
DROP POLICY IF EXISTS "Allow anonymous inserts on leads" ON public.leads;
CREATE POLICY "Allow anonymous inserts on leads"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (auth.role() = 'anon');

-- 2. Fix: RLS Policy Always True for "Allow authenticated users to update leads"
-- Replaces literal 'true' with 'auth.role() = ''authenticated''' to satisfy linter
DROP POLICY IF EXISTS "Allow authenticated users to update leads" ON public.leads;
CREATE POLICY "Allow authenticated users to update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
