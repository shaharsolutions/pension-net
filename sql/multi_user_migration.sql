-- Add user_id column to orders table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'user_id') THEN
        ALTER TABLE orders ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow broad access to orders" ON orders;
DROP POLICY IF EXISTS "Users can only see their own orders" ON orders;
DROP POLICY IF EXISTS "Users can only insert their own orders" ON orders;
DROP POLICY IF EXISTS "Users can only update their own orders" ON orders;
DROP POLICY IF EXISTS "Users can only delete their own orders" ON orders;
DROP POLICY IF EXISTS "Anyone can insert orders with user_id" ON orders;

-- 1. AUTHENTICATED USERS (Owners)
CREATE POLICY "Owners have full access to their own data"
ON orders
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. ANONYMOUS USERS (Customers)
-- Customers need to see existing orders for a specific owner to check capacity and identify their own previous dogs
CREATE POLICY "Anon can see orders for specific user_id"
ON orders
FOR SELECT
TO anon
USING (user_id IS NOT NULL); -- In practice, the app will filter by a specific owner UUID

-- Customers can insert new orders if they specify a user_id
CREATE POLICY "Anon can insert orders with user_id"
ON orders
FOR INSERT
TO anon
WITH CHECK (user_id IS NOT NULL);

-- --- PROFILES TABLE ---
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT,
    full_name TEXT,
    business_name TEXT,
    location TEXT,
    default_price INTEGER DEFAULT 130,
    max_capacity INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_members JSONB DEFAULT '[]';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_pin TEXT;
-- We will keep orders.admin_note as TEXT for now but store JSON string inside it for compatibility,
-- or just use a new column if we want to be safe, but let's stick to JSON within the existing column.


-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- --- TRIGGER FOR AUTOMATIC PROFILE CREATION ---
-- This function runs every time a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone, full_name, max_capacity, business_name, location, default_price)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'full_name',
    COALESCE((new.raw_user_meta_data->>'max_capacity')::integer, 10),
    new.raw_user_meta_data->>'business_name',
    new.raw_user_meta_data->>'location',
    COALESCE((new.raw_user_meta_data->>'default_price')::integer, 130)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
