-- Add is_seen column to orders table
-- This tracks whether the pension admin has seen a new order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_seen BOOLEAN DEFAULT false;

-- Update existing orders to be marked as seen (so they don't trigger the modal)
UPDATE orders SET is_seen = true WHERE is_seen IS NULL;
