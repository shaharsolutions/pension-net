-- Fix public access to orders table so that logged-in users (e.g. support/testing) can also use public forms

-- 1. Orders Table - Select Policy
DROP POLICY IF EXISTS "Anyone can see orders for specific user_id" ON public.orders;
DROP POLICY IF EXISTS "Anon can see orders for specific user_id" ON public.orders;
CREATE POLICY "Anyone can see orders for specific user_id"
ON public.orders
FOR SELECT
TO public
USING (user_id IS NOT NULL);

-- 2. Orders Table - Insert Policy
DROP POLICY IF EXISTS "Anyone can insert orders with user_id" ON public.orders;
DROP POLICY IF EXISTS "Anon can insert orders with user_id" ON public.orders;
CREATE POLICY "Anyone can insert orders with user_id"
ON public.orders
FOR INSERT
TO public
WITH CHECK (user_id IS NOT NULL);

-- 3. Profiles Table - Select Policy
DROP POLICY IF EXISTS "Anyone can see public profile info" ON public.profiles;
DROP POLICY IF EXISTS "Anon can see public profile info" ON public.profiles;
CREATE POLICY "Anyone can see public profile info"
ON public.profiles
FOR SELECT
TO public
USING (true);
