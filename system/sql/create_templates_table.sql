-- Create table for message templates
CREATE TABLE IF NOT EXISTS pension_lead_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pension_lead_templates ENABLE ROW LEVEL SECURITY;

-- Allow public access for now
CREATE POLICY "Allow public select templates" ON pension_lead_templates FOR SELECT USING (true);
CREATE POLICY "Allow public insert templates" ON pension_lead_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update templates" ON pension_lead_templates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete templates" ON pension_lead_templates FOR DELETE USING (true);

-- Insert initial templates
INSERT INTO pension_lead_templates (title, content) VALUES 
('הצעה לשיתוף פעולה', 'היי {{name}}, אני שחר, ראיתי את הפנסיון שלכם ונראה מעולה. אני מפתח מערכת ניהול שחוסכת המון זמן בניהול הפנסיון ובוחר מספר מצומצם של עסקים שישתתפו בפיילוט חינמי (משתתפים פעילים יזכו למחיר מיוחד לצמיתות לאחר מכן). אשמח לקבוע פגישה ולהציג את המערכת. מעניין אתכם?'),
('בירור ראשוני', 'שלום, אני שחר, אני פונה לגבי הפנסיון {{name}}. אני מפתח מערכת ניהול שחוסכת המון זמן בניהול היומן וההזמנות, ובוחר מספר מצומצם של פנסיונים שישתתפו בפיילוט חינמי (משתתפים פעילים יזכו למחיר מיוחד לצמיתות). אשמח לקבוע פגישה ולהראות לכם איך זה עובד.'),
('הזמנה להתרשמות', 'היי {{name}}, אני שחר, פיתחתי מערכת ניהול שחוסכת המון זמן בניהול הפנסיון ומפנה אתכם למה שחשוב באמת. אני בוחר מספר מצומצם של פנסיונים שישתתפו בפיילוט חינמי במטרה להקל משמעותית על העבודה היומיומית שלכם (משתתפים פעילים יזכו למחיר מיוחד לצמיתות). אשמח להיפגש ולהציג את המערכת.'),
('הודעה קצרה', 'שלום {{name}}, אני שחר, אני מפתח מערכת ניהול שחוסכת זמן יקר בניהול הפנסיון ומציע לכם להצטרף לפיילוט חינמי (משתתפים פעילים יזכו למחיר מיוחד לצמיתות). אשמח לקבוע פגישה ולהציג את המערכת. אפשר לשלוח פרטים?');
