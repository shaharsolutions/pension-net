/**
 * Pension-Net - Configuration
 * קובץ קונפיגורציה מרכזי
 */

const APP_CONFIG = {
  APP_NAME: "Pension-Net",
  VERSION: "1.0.0",
  MAX_CAPACITY: 10,
  DEFAULT_PRICE_PER_DAY: 130,
  HISTORY_ROWS_PER_PAGE: 10,
  ADMIN_PHONE: "972528366744",
  CHECKIN_HOURS: "08:00-18:00",
  CHECKOUT_HOURS: "עד 18:00",
  DIRECTORY_ADMIN_PASS: "SC1627s@"
};

const SUPABASE_CONFIG = {
  // אנא וודא שזו הכתובת הנכונה מתוך Supabase Dashboard -> Settings -> API
  URL: "https://smzgfffeehrozxsqtgqa.supabase.co",
  ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtemdmZmZlZWhyb3p4c3F0Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNTU4NTYsImV4cCI6MjA3NDgzMTg1Nn0.LvIQLvj7HO7xXJhTALLO5GeYZ1DU50L3q8Act5wXfi4"
};


// Auth is now handled by Supabase Auth

