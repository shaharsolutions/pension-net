/**
 * Pension-Net - Authentication Module
 * handles Supabase Auth
 */

const supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

const Auth = {
  async signUp(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  async login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async logout() {
    const { error } = await supabaseClient.auth.signOut();
    localStorage.removeItem("adminAuth"); // Clear old auth if exists
    window.location.href = "login.html";
    return { error };
  },

  async getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
  },

  async checkAuth() {
    const session = await this.getSession();
    if (!session) {
      // If we are on a protected page and not logged in, redirect to login
      const protectedPages = ["admin.html", "growth.html", "insights.html"];
      const currentPage = window.location.pathname.split("/").pop();
      if (protectedPages.includes(currentPage)) {
        window.location.href = "login.html";
      }
      return null;
    }
    return session;
  },

  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  }
};


// Initialize auth check
if (typeof SUPABASE_CONFIG !== 'undefined') {
    Auth.checkAuth();
}
