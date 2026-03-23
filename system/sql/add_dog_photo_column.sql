-- migration for dog_photo column correctly
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'dog_photo') THEN
        ALTER TABLE orders ADD COLUMN dog_photo TEXT;
    END IF;
END $$;
