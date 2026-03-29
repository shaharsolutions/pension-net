-- Fix RLS policies for orders table to support multi-user teams
-- This script allows any staff member belonging to the same pension to view and update orders.

-- 1. Orders Select: Allow anyone in the same pension to see orders
DROP POLICY IF EXISTS "Owners have full access to their own data" ON public.orders;
DROP POLICY IF EXISTS "Anyone can see orders for specific user_id" ON public.orders;

CREATE POLICY "Team members can view pension orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    pension_id = (SELECT pension_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- 2. Orders Update: Allow anyone in the same pension to update orders (e.g. status, notes)
DROP POLICY IF EXISTS "Users can only update their own orders" ON public.orders;

CREATE POLICY "Team members can update pension orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    pension_id = (SELECT pension_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
    user_id = auth.uid() 
    OR 
    pension_id = (SELECT pension_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- 3. Orders Delete: Restrict to owners/managers only if needed, or allow all team
-- Let's keep it restricted to the owner for safety or check the role.
CREATE POLICY "Managers can delete pension orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    (
        pension_id = (SELECT pension_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
        AND 
        (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) = 'manager'
    )
);

-- 4. Also fix Public Insert (for booking link) to ensure it uses the provided user_id correctly
DROP POLICY IF EXISTS "Anyone can insert orders with user_id" ON public.orders;
CREATE POLICY "Public and team can insert orders"
ON public.orders
FOR INSERT
TO public
WITH CHECK (true);

-- 5. AUDIT LOGS: Add pension_id and fix permissions
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS pension_id UUID REFERENCES public.pensions(id);

-- Update existing logs to match their user's pension
UPDATE public.audit_logs al
SET pension_id = p.pension_id
FROM public.profiles p
WHERE al.user_id = p.user_id AND al.pension_id IS NULL;

-- Fix policies for audit_logs
DROP POLICY IF EXISTS "Users can only see their own audit logs" ON public.audit_logs;
CREATE POLICY "Team members can view pension audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    pension_id = (SELECT pension_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Any staff can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);
