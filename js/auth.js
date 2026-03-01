/**
 * Pension-Net - Authentication Module
 * handles Supabase Auth
 */

const supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

const Auth = {
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
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
      const protectedPages = ["admin.html", "admin_panel.html", "growth.html", "insights.html", "features_guide.html"];
      const currentPage = window.location.pathname.split("/").pop();
      if (protectedPages.includes(currentPage)) {
        window.location.href = "login.html";
      }
      return null;
    }

    // New check: if logged in but metadata (setup) missing
    const user = session.user;
    if (user && (!user.user_metadata || !user.user_metadata.business_name)) {
        const currentPage = window.location.pathname.split("/").pop();
        if (currentPage !== "setup.html") {
            window.location.href = "setup.html";
        }
    }

    return session;
  },

  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  },

  async updatePassword(newPassword) {
    const { data, error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  },

  isAdmin(session) {
    const ADMIN_EMAIL = 'shaharsolutions@gmail.com';
    return session && session.user && session.user.email === ADMIN_EMAIL;
  }
};


// Initialize auth check
if (typeof SUPABASE_CONFIG !== 'undefined') {
    Auth.checkAuth();
}
