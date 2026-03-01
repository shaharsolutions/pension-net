-- Setup Storage for Dog Photos
-- 1. Create the bucket if it doesn't exist with a 5MB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dog-photos', 'dog-photos', true, 5242880, '{image/*}')
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 5242880, allowed_mime_types = '{image/*}';

-- 2. Allow Public Access to view photos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'dog-photos' );

-- 3. Allow anonymous uploads (Customers on booking page)
DROP POLICY IF EXISTS "Allow anonymous uploads to dog-photos" ON storage.objects;
CREATE POLICY "Allow anonymous uploads to dog-photos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK ( bucket_id = 'dog-photos' );

-- 4. Allow authenticated users (Owners/Staff) full access to their own folders
DROP POLICY IF EXISTS "Allow owners to manage their folders" ON storage.objects;
CREATE POLICY "Allow owners to manage their folders"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'dog-photos' AND (storage.foldername(name))[1] = auth.uid()::text )
WITH CHECK ( bucket_id = 'dog-photos' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 5. Extra: Allow anonymous users to update if needed? (Usually just insert)
-- For the booking page, we only do INSERT.
