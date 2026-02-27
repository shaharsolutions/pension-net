-- Add email column to profiles and populate from auth.users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Populate email from auth.users for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
AND (p.email IS NULL OR p.email = '');

-- Update the handle_new_user trigger to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, phone, full_name, max_capacity, business_name, location, default_price, manager_pin)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'full_name',
    COALESCE((new.raw_user_meta_data->>'max_capacity')::integer, 10),
    new.raw_user_meta_data->>'business_name',
    new.raw_user_meta_data->>'location',
    COALESCE((new.raw_user_meta_data->>'default_price')::integer, 130),
    new.raw_user_meta_data->>'manager_pin'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
