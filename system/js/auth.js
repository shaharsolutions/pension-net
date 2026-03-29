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

    if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('error='))) {
      console.log('⏳ קולט נתוני התחברות חיצונית, ממתין לסיום עיבוד...');
      await new Promise(res => setTimeout(res, 500));
    }

    const session = await this.getSession();
    if (!session) {
      const protectedPages = ["admin.html", "admin_panel.html", "growth.html", "insights.html", "features_guide.html"];
      const currentPage = window.location.pathname.split("/").pop();
      if (protectedPages.includes(currentPage)) {
        console.log('🚫 אין סשן פעיל, עובר לעמוד התחברות');
        window.location.href = "login.html";
      }
      return null;
    }

    // --- New Multi-User Logic (Fetch Profile & Pension) ---
    const user = session.user;
    
    // Fetch profile to get role and pension_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.warn('Profile not found for user:', user.id, profileError);
      const currentPage = window.location.pathname.split("/").pop();
      if (currentPage !== "setup.html") {
         window.location.href = "setup.html";
      }
      return session;
    }

    // Fetch the pension separately (avoids RLS join issues)
    let pension = null;
    if (profile.pension_id) {
      const { data: pensionData } = await supabaseClient
        .from('pensions')
        .select('*')
        .eq('id', profile.pension_id)
        .single();
      pension = pensionData;
    }

    // Store in global state
    window.currentUserProfile = profile;
    window.currentPension = pension;

    // Redirect managers without a pension to setup
    if (!profile.pension_id && profile.role === 'manager') {
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
  },

  hasPermission(permission) {
    if (!window.currentUserProfile) return false;
    const permissions = window.currentUserProfile.permissions || [];
    return permissions.includes('all') || permissions.includes(permission);
  }
};


// Initialize auth check and store the promise so other scripts can await it
if (typeof SUPABASE_CONFIG !== 'undefined') {
    window.authCheckPromise = Auth.checkAuth();
}
