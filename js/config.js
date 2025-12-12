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
  CHECKOUT_HOURS: "עד 12:00"
};

const SUPABASE_CONFIG = {
  // אנא וודא שזו הכתובת הנכונה מתוך Supabase Dashboard -> Settings -> API
  URL: "https://smzgfffeehrozxsqtgqa.supabase.co",
  ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtemdmZmZlZWhyb3p4c3F0Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNTU4NTYsImV4cCI6MjA3NDgzMTg1Nn0.LvIQLvj7HO7xXJhTALLO5GeYZ1DU50L3q8Act5wXfi4"
};

const GREEN_API_CONFIG = {
  INSTANCE_ID: "7105264953",
  API_TOKEN: "c0e0fdbd81794dfc941722c133598333ad671ebe13af4fe181",
  BASE_URL: "https://api.green-api.com"
};

const AUTH_CONFIG = {
  PASSWORD_HASH: "60275c47",
  SESSION_KEY: "adminAuth"
};
