-- הרץ פקודה זו ב-SQL Editor ב-Supabase כדי להוסיף תמיכה במעקב כניסה/יציאה

ALTER TABLE orders 
ADD COLUMN is_arrived BOOLEAN DEFAULT FALSE,
ADD COLUMN is_departed BOOLEAN DEFAULT FALSE;
