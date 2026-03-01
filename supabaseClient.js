import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Fallback values for non-Vite environments
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || "https://smzgfffeehrozxsqtgqa.supabase.co";
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtemdmZmZlZWhyb3p4c3F0Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNTU4NTYsImV4cCI6MjA3NDgzMTg1Nn0.LvIQLvj7HO7xXJhTALLO5GeYZ1DU50L3q8Act5wXfi4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
