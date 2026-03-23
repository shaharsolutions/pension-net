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
    // Check for demo mode in URL to prevent redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
      console.log('🛡️ Auth check bypassed for Demo Mode');
      return null;
    }

    // Check if we are in the middle of an OAuth redirect (e.g. Google login)
    // If there is an access_token in the URL hash, Supabase needs time to process it.
    // We should NOT redirect to login.html in this case.
    if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('error='))) {
      console.log('⏳ קולט נתוני התחברות חיצונית, ממתין לסיום עיבוד...');
      // Wait a bit to allow getSession to potentially catch it after internal processing
      await new Promise(res => setTimeout(res, 500));
    }

    const session = await this.getSession();
    if (!session) {
      // If we are on a protected page and not logged in, redirect to login
      const protectedPages = ["admin.html", "admin_panel.html", "growth.html", "insights.html", "features_guide.html"];
      const currentPage = window.location.pathname.split("/").pop();
      if (protectedPages.includes(currentPage)) {
        console.log('🚫 אין סשן פעיל, עובר לעמוד התחברות');
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
