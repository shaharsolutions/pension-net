-- ============================================
-- Fix: User Plan and Feature Flags RLS Policies
-- Use this script to allow the admin user (shaharsolutions@gmail.com) 
-- to manage user plans and feature overrides.
-- Run this in your Supabase SQL Editor.
-- ============================================

-- 1. Ensure user_plan table has RLS and proper policies
ALTER TABLE IF EXISTS public.user_plan ENABLE ROW LEVEL SECURITY;

-- Clear old policies to avoid duplicates
DROP POLICY IF EXISTS "Admin has full access to user_plan" ON public.user_plan;
DROP POLICY IF EXISTS "Users can view their own plan" ON public.user_plan;

-- Allow admin full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin has full access to user_plan"
ON public.user_plan
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');

-- Allow users to see their own plan
CREATE POLICY "Users can view their own plan"
ON public.user_plan
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Ensure feature_flags table has RLS and proper policies
ALTER TABLE IF EXISTS public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Clear old policies
DROP POLICY IF EXISTS "Admin has full access to feature_flags" ON public.feature_flags;
DROP POLICY IF EXISTS "Users can view their own feature flags" ON public.feature_flags;

-- Allow admin full access
CREATE POLICY "Admin has full access to feature_flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');

-- Allow users to see their own flags
CREATE POLICY "Users can view their own feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Ensure plan_features table (Read-only for app, manageable by admin)
ALTER TABLE IF EXISTS public.plan_features ENABLE ROW LEVEL SECURITY;

-- Clear old policies
DROP POLICY IF EXISTS "Anyone can view plan features" ON public.plan_features;
DROP POLICY IF EXISTS "Admin can manage plan features" ON public.plan_features;

-- Publicly readable for all authenticated users
CREATE POLICY "Anyone can view plan features"
ON public.plan_features
FOR SELECT
TO authenticated
USING (true);

-- Admin can manage
CREATE POLICY "Admin can manage plan features"
ON public.plan_features
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'shaharsolutions@gmail.com');
