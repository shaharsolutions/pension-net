/**
 * Pension-Net - Features & Plans Module
 * Handles feature flagging and plan restrictions based on Supabase resolution
 */

const Features = {
    _features: {},
    _loading: false,
    _initialized: false,

    async init(userId = null) {
        // Only run once per session load or manually re-triggered
        if (this._loading && !userId) return;
        this._loading = true;

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            this._loading = false;
            return;
        }

        const targetUserId = userId || session.user.id;

        try {
            let featuresData = [];
            
            // If fetching for current user, use secure RPC
            if (targetUserId === session.user.id) {
                const { data, error } = await supabaseClient.rpc('get_my_features');
                if (error) throw error;
                featuresData = data || [];
            } else {
                // If fetching for impersonated user (must be admin), query the resolution view
                const { data, error } = await supabaseClient
                    .from('vw_user_effective_features')
                    .select('feature_key, is_enabled')
                    .eq('user_id', targetUserId);
                if (error) throw error;
                featuresData = data || [];
            }
            
            // Map standard array to a boolean lookup object
            this._features = featuresData.reduce((acc, f) => {
                acc[f.feature_key] = f.is_enabled;
                return acc;
            }, {});

            this._initialized = true;
            console.log('✓ Features resolved for:', targetUserId);
            
            // Proactive UI update
            this.syncUI();
        } catch (e) {
            console.error('Feature resolution failed:', e);
        } finally {
            this._loading = false;
        }
    },

    isEnabled(featureKey) {
        // 1. System administrators have full access
        const userEmail = window.currentUserSession?.user?.email || 
                          window.currentUserSession?.email;
        if (userEmail === 'shaharsolutions@gmail.com') return true;

        // 2. Resolve the effective plan (accounting for the Founder שדרוג)
        const rawPlanId = window.currentPlanId || 'starter';
        const planId = rawPlanId.toLowerCase().trim();
        const isFounder = window.isFounder;
        
        let effectiveTier = 1; // 1 = Starter, 2 = Pro, 3 = Pro Plus
        if (planId === 'pro') effectiveTier = 2;
        if (planId === 'pro_plus') effectiveTier = 3;

        // Founder Bonus: +1 Tier
        if (isFounder) {
            effectiveTier = Math.min(3, effectiveTier + 1);
        }

        console.log(`[Features] Checking: ${featureKey} | Plan: ${planId} | Effective Tier: ${effectiveTier}`);

        // 3. Strict Tier Mapping
        const tierMapping = {
            // TIER 1: Starter
            'ongoing_management': 1,
            'history_tab': 1,
            'calendar_view': 1,
            'occupancy_view': 1,
            'holidays_visible': 1,
            'clients_basic': 1,
            'audit_log': 1,

            // TIER 2: Pro
            'whatsapp_automation': 2,
            'default_price_per_client': 2,

            // TIER 3: Pro Plus
            'staff_management': 3,
            'advanced_reports': 3,
            'beta_access': 3
        };

        const requiredTier = tierMapping[featureKey] || 1;
        
        // 4. Primary Logic: If the user's tier meets or exceeds the required tier, it's ENABLED
        if (effectiveTier >= requiredTier) return true;

        // 5. Fallback: Check for specific database overrides (e.g. manual beta access given to a specific user)
        return this._features[featureKey] === true;
    },

    /**
     * Hides or shows UI elements marked with data-feature.
     * Also handles specific tab gating and navigation prevention.
     */
    syncUI() {
        const elements = document.querySelectorAll('[data-feature]');
        elements.forEach(el => {
            const feature = el.getAttribute('data-feature');
            const isAvailable = this.isEnabled(feature);
            
            if (!isAvailable) {
                // If it is a tab button, hide it
                if (el.classList.contains('tab-btn')) {
                    el.style.display = 'none';
                    // If user is currently ON this tab, force switch
                    if (el.classList.contains('active')) {
                        if (typeof switchTab === 'function') switchTab('ongoing');
                    }
                } else if (el.tagName === 'A') {
                    // Hide navigation links
                    el.style.display = 'none';
                } else if (el.classList.contains('container') || el.classList.contains('tab-content')) {
                    // Inject a restricted message inside large containers instead of just hiding
                    const messageId = `feature-restricted-${feature}`;
                    if (!document.getElementById(messageId)) {
                        const msg = document.createElement('div');
                        msg.id = messageId;
                        msg.className = 'feature-restricted-message';
                        msg.innerHTML = `
                            <div style="text-align: center; padding: 40px; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; margin: 15px 0;">
                                <i class="fas fa-lock" style="font-size: 24px; color: #94a3b8; margin-bottom: 12px;"></i>
                                <h4 style="color: #475569; margin-bottom: 8px;">פיצ'ר זה אינו זמין בחבילה שלך</h4>
                                <p style="font-size: 13px; color: #64748b;">צרו קשר לשדרוג החבילה ופתיחת אפשרויות נוספות</p>
                            </div>
                        `;
                        el.parentNode.insertBefore(msg, el);
                    }
                    el.style.display = 'none';
                } else {
                    el.style.setProperty('display', 'none', 'important');
                }
            } else {
                // Feature is ENABLED: Show element & remove restricted message if exists
                el.style.display = '';
                const messageId = `feature-restricted-${feature}`;
                const existingMsg = document.getElementById(messageId);
                if (existingMsg) existingMsg.remove();
            }
        });
    }
};

// Auto-init handled by admin.js during startup/impersonation check
if (typeof supabaseClient !== 'undefined') {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (!session) {
            Features._features = {};
            Features._initialized = false;
        }
    });
}
