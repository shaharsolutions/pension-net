/**
 * Pension-Net - Admin Panel Module
 * פאנל ניהול מתקדם - גישה למנהל בלבד (shaharsolutions@gmail.com)
 */

const ADMIN_EMAIL = 'shaharsolutions@gmail.com';
const SESSION_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in ms
let currentSessionId = null;
let sessionUpdateTimer = null;
let sessionStartTime = null;

// ============================================
// Session Tracking
// ============================================

async function createUserSession() {
    try {
        const session = await Auth.getSession();
        if (!session || !session.user) return;

        const { data, error } = await supabaseClient
            .from('user_sessions')
            .insert([{
                user_id: session.user.id,
                user_email: session.user.email,
                login_time: new Date().toISOString(),
                last_active: new Date().toISOString(),
                duration_minutes: 0
            }])
            .select()
            .single();

        if (error) {
            console.warn('Could not create user session:', error.message);
            return;
        }

        currentSessionId = data.id;
        sessionStartTime = new Date();
        console.log('User session created:', currentSessionId);

        // Start periodic updates
        startSessionTracking();
    } catch (err) {
        console.warn('Session tracking error:', err);
    }
}

function startSessionTracking() {
    if (sessionUpdateTimer) clearInterval(sessionUpdateTimer);

    sessionUpdateTimer = setInterval(async () => {
        await updateSessionActivity();
    }, SESSION_UPDATE_INTERVAL);

    // Update on page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            updateSessionActivity();
        }
    });

    // Update on page unload
    window.addEventListener('beforeunload', () => {
        updateSessionActivity();
    });
}

async function updateSessionActivity() {
    if (!currentSessionId || !sessionStartTime) return;

    try {
        const now = new Date();
        const durationMs = now - sessionStartTime;
        const durationMinutes = Math.round(durationMs / 60000);

        await supabaseClient
            .from('user_sessions')
            .update({
                last_active: now.toISOString(),
                duration_minutes: durationMinutes
            })
            .eq('id', currentSessionId);
    } catch (err) {
        console.warn('Session update error:', err);
    }
}

// ============================================
// Admin Access Check
// ============================================

function isAdminUser(session) {
    return session && session.user && session.user.email === ADMIN_EMAIL;
}

async function checkAdminAccess() {
    const session = await Auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    if (!isAdminUser(session)) {
        showAccessDenied();
        return null;
    }

    return session;
}

function showAccessDenied() {
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'flex';
}

// ============================================
// Admin Panel Navigation Visibility
// ============================================

async function updateAdminNavVisibility() {
    const session = await Auth.getSession();
    const adminLink = document.getElementById('adminPanelLink');
    if (adminLink) {
        if (isAdminUser(session)) {
            adminLink.style.display = 'inline-flex';
        } else {
            adminLink.style.display = 'none';
        }
    }
}

// ============================================
// Tab Switching
// ============================================

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const selectedTab = document.getElementById('adminTab-' + tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    const selectedBtn = document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
}

// ============================================
// Data Loading
// ============================================

async function loadAdminPanelData() {
    showLoadingState();

    try {
        const [sessions, orders, profiles, activityLogs, userPlans, announcement, feedback] = await Promise.all([
            loadAllSessions(),
            loadAllOrders(),
            loadAllProfiles(),
            loadAllActivityLogs(),
            loadAllUserPlans(),
            loadLatestAnnouncement(),
            loadUserFeedback()
        ]);

        renderSummaryCards(sessions, orders, profiles);
        window._cachedAdminData = { sessions, orders, profiles, userPlans };

        renderUsersTable(sessions, orders, profiles, userPlans);
        renderOrdersTable(orders, profiles);
        renderActivityFeed(activityLogs, profiles);
        renderUserFeedback(feedback);
    } catch (err) {
        console.error('Admin panel data load error:', err);
        showToast('שגיאה בטעינת נתוני פאנל ניהול', 'error');
    }
}

function showLoadingState() {
    // Only update tbody content, NOT the entire card body — to preserve table structure
    ['usersTableBody', 'ordersTableBody', 'sessionsTableBody'].forEach(id => {
        const tbody = document.getElementById(id);
        if (tbody) {
            const cols = id === 'sessionsTableBody' ? 4 : (id === 'ordersTableBody' ? 9 : 6);
            tbody.innerHTML = `
                <tr>
                    <td colspan="${cols}" style="text-align: center; padding: 40px;">
                        <div class="admin-loading">
                            <div class="spinner"></div>
                            <span>טוען נתונים...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    });
}

async function loadAllSessions() {
    const { data, error } = await supabaseClient
        .from('user_sessions')
        .select('*')
        .order('login_time', { ascending: false });

    if (error) {
        console.error('Error loading sessions:', error);
        return [];
    }
    return data || [];
}

async function loadAllOrders() {
    const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading orders:', error);
        return [];
    }
    return data || [];
}

async function loadAllProfiles() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*');

    if (error) {
        console.error('Error loading profiles:', error);
        return [];
    }
    return data || [];
}

async function loadAllUserPlans() {
    const { data, error } = await supabaseClient
        .from('user_plan')
        .select('*');

    if (error) {
        console.error('Error loading user plans:', error);
        return [];
    }
    return data || [];
}

async function loadLatestAnnouncement() {
    try {
        const { data, error } = await supabaseClient
            .from('system_announcements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        
        if (data) {
            document.getElementById('announcementContent').value = data.content;
            document.getElementById('announcementActive').checked = data.is_active;
            
            const infoDiv = document.getElementById('lastAnnouncementInfo');
            if (infoDiv) {
                const date = new Date(data.created_at).toLocaleString('he-IL');
                infoDiv.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; padding: 10px 15px; border-radius: 8px; border: 1px solid #dbeafe; color: #1e40af;">
                        <span><i class="fas fa-info-circle"></i> עדכון אחרון פורסם ב-${date} על ידי ${data.created_by || 'מנהל'}</span>
                        <button onclick='viewAnnouncementById("${data.id}")' class="admin-nav-btn" style="background: white; border: 1px solid #bfdbfe; color: #2563eb; padding: 4px 12px; font-size: 12px; font-weight: 600;">
                            <i class="fas fa-eye"></i> צפה בתוכן שפורסם
                        </button>
                    </div>`;
            }
        }
        return data;
    } catch (err) {
        console.warn('Error loading announcement:', err);
        return null;
    }
}

async function saveAnnouncement() {
    const content = document.getElementById('announcementContent').value.trim();
    const isActive = document.getElementById('announcementActive').checked;
    
    if (!content) {
        showToast('נא להזין תוכן להודעה', 'error');
        return;
    }
    
    try {
        const session = await Auth.getSession();
        const { error } = await supabaseClient
            .from('system_announcements')
            .insert([{
                content: content,
                is_active: isActive,
                created_by: session?.user?.email || ADMIN_EMAIL,
                created_at: new Date().toISOString()
            }]);
            
        if (error) throw error;
        
        showToast('העדכון פורסם בהצלחה!', 'success');
        loadLatestAnnouncement(); // Refresh info
    } catch (err) {
        console.error('Save announcement error:', err);
        showToast('שגיאה בשמירת העדכון', 'error');
    }
}

function previewAnnouncement() {
    const content = document.getElementById('announcementContent').value.trim();
    if (!content) {
        showToast('נא להזין תוכן לתצוגה מקדימה', 'error');
        return;
    }
    
    // Create a temporary overlay for preview
    const overlay = document.createElement('div');
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; direction: rtl;
    `;
    
    const card = document.createElement('div');
    card.style = `
        background: white; width: 90%; max-width: 500px; padding: 32px;
        border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        position: relative; text-align: right;
    `;
    
    card.innerHTML = `
        <h2 style="margin-top: 0; margin-bottom: 20px; color: #1e293b; font-size: 24px; font-weight: 800;">🔍 תצוגה מקדימה</h2>
        <div style="font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 30px; max-height: 400px; overflow-y: auto;">
            ${content}
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
            width: 100%; padding: 14px; background: #6366f1; color: white;
            border: none; border-radius: 12px; font-weight: 700; cursor: pointer;
        ">סגור תצוגה מקדימה</button>
    `;
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

async function viewAnnouncementById(id) {
    if (!id) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('system_announcements')
            .select('*')
            .eq('id', id)
            .maybeSingle();
            
        if (error) throw error;
        if (!data) {
            showToast('העדכון לא נמצא במערכת', 'error');
            return;
        }
        
        const overlay = document.createElement('div');
        overlay.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000; direction: rtl;
        `;
        
        const card = document.createElement('div');
        card.style = `
            background: white; width: 90%; max-width: 500px; padding: 32px;
            border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            position: relative; text-align: right;
        `;
        
        const date = new Date(data.created_at).toLocaleString('he-IL');
        
        card.innerHTML = `
            <h2 style="margin-top: 0; margin-bottom: 5px; color: #1e293b; font-size: 22px; font-weight: 800;">הודעת העדכון שפורסמה</h2>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">תאריך פרסום: ${date}</p>
            <div style="font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 30px; max-height: 400px; overflow-y: auto; padding-left: 10px; border: 1px solid #f1f5f9; padding: 15px; border-radius: 12px; background: #fafafa;">
                ${data.content}
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                width: 100%; padding: 14px; background: #6366f1; color: white;
                border: none; border-radius: 12px; font-weight: 700; cursor: pointer;
            ">סגור</button>
        `;
        
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    } catch (err) {
        console.error('Error viewing announcement:', err);
        showToast('שגיאה בטעינת תוכן העדכון', 'error');
    }
}

async function loadUserFeedback() {
    try {
        const { data, error } = await supabaseClient
            .from('system_feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error loading feedback:', err);
        return [];
    }
}

function renderUserFeedback(feedback) {
    const list = document.getElementById('userFeedbackList');
    if (!list) return;

    if (!feedback || feedback.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--admin-text-muted);">טרם התקבל משוב ממשתמשים</td></tr>';
        return;
    }

    list.innerHTML = feedback.map(item => {
        const date = new Date(item.created_at).toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        
        return `
            <tr>
                <td style="white-space: nowrap;">${date}</td>
                <td style="font-weight: 600;">${item.user_email}</td>
                <td style="max-width: 400px; word-wrap: break-word;">${item.content}</td>
                <td>
                    ${item.announcement_id ? `
                        <button onclick='viewAnnouncementById("${item.announcement_id}")' class="admin-nav-btn" style="padding: 4px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; color: #6366f1; border: 1px solid #e2e8f0;">
                            <i class="fas fa-bullhorn"></i> צפה בעדכון
                        </button>
                    ` : '<span style="color: #94a3b8;">כללי</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// Summary Cards
// ============================================

function renderSummaryCards(sessions, orders, profiles) {
    const filteredSessions = (sessions || []).filter(s => s.user_email !== ADMIN_EMAIL);
    const filteredProfiles = (profiles || []).filter(p => p.email !== ADMIN_EMAIL);

    // Unique users
    const uniqueUsers = new Set(filteredSessions.map(s => s.user_email)).size || filteredProfiles.length;

    // Active users (active in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = new Set(
        filteredSessions.filter(s => new Date(s.last_active) > oneDayAgo).map(s => s.user_email)
    ).size;

    // Total logins
    const totalLogins = filteredSessions.length;

    // Total usage hours
    const totalMinutes = filteredSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    // Total orders
    const totalOrders = orders.length;

    // Total revenue
    const totalRevenue = orders.reduce((sum, o) => {
        const days = calculateOrderDays(o);
        return sum + (days * (o.price_per_day || 0));
    }, 0);

    document.getElementById('summaryActiveUsers').textContent = activeUsers;
    document.getElementById('summaryTotalLogins').textContent = totalLogins.toLocaleString();
    document.getElementById('summaryTotalHours').textContent = totalHours;
    document.getElementById('summaryTotalOrders').textContent = totalOrders.toLocaleString();
    document.getElementById('summaryTotalRevenue').textContent = '₪' + totalRevenue.toLocaleString();
}

function calculateOrderDays(order) {
    if (!order.check_in || !order.check_out) return 0;
    const start = new Date(order.check_in);
    const end = new Date(order.check_out);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// ============================================
// Users Table
// ============================================

let adminSelectedUserId = null;

function renderUsersTable(sessions, orders, profiles, userPlans = []) {
    const usersMap = {};
    const plansMap = (userPlans || []).reduce((acc, p) => {
        acc[p.user_id] = { id: p.plan_id, founder: p.founder_price_locked };
        return acc;
    }, {});

    const renderPlanBadge = (planData, userEmail = null) => {
        const isSystemAdmin = userEmail === 'shaharsolutions@gmail.com';
        if (isSystemAdmin) {
            return `<span class="admin-badge" style="background: #fefce8; color: #854d0e; border: 1px solid #facc15;"><i class="fas fa-shield-alt"></i> Admin</span>`;
        }

        let planId = planData?.id;
        const isFounder = planData?.founder;
        
        // Sliding scale for Founders: Display the FEATURE tier, not the PAYMENT tier
        let displayPlanId = planId;
        if (isFounder) {
            if (planId === 'starter') displayPlanId = 'pro';
            else if (planId === 'pro') displayPlanId = 'pro_plus';
        }

        let badgeHtml = '';

        if (!displayPlanId) {
            badgeHtml = `<span class="admin-badge" style="background: #f1f5f9; color: #64748b;">ללא חבילה</span>`;
        } else if (displayPlanId === 'starter') {
            badgeHtml = `<span class="admin-badge" style="background: #ecfdf5; color: #059669; border: 1px solid #10b981;">Starter</span>`;
        } else if (displayPlanId === 'pro') {
            badgeHtml = `<span class="admin-badge" style="background: #eff6ff; color: #2563eb; border: 1px solid #3b82f6;">Pro</span>`;
        } else if (displayPlanId === 'pro_plus') {
            badgeHtml = `<span class="admin-badge" style="background: #faf5ff; color: #7c3aed; border: 1px solid #8b5cf6;">Pro Plus</span>`;
        } else {
            badgeHtml = `<span class="admin-badge">${displayPlanId}</span>`;
        }

        if (isFounder) {
            badgeHtml += `<span class="admin-badge" style="background: #7c3aed; color: white; border: none; margin-right: 4px;" title="מחיר מופחת לצמיתות"><i class="fas fa-medal"></i> Founder</span>`;
        }
        
        return badgeHtml;
    };

    // Build email lookup from sessions (user_id -> email) as secondary source
    const emailLookup = {};
    sessions.forEach(s => {
        if (s.user_id && s.user_email) {
            emailLookup[s.user_id] = s.user_email;
        }
    });

    // Build users from profiles — use profile.email first, then session lookup
    profiles.forEach(p => {
        usersMap[p.user_id] = {
            user_id: p.user_id,
            email: p.email || emailLookup[p.user_id] || '',
            businessName: p.business_name || '',
            fullName: p.full_name || '',
            totalOrders: 0,
            totalMinutes: 0,
            loginCount: 0,
            lastLogin: null,
            lastSeenAnnouncementId: p.last_seen_announcement_id || null,
            seenAnnouncementAt: p.seen_announcement_at || null
        };
    });

    // Enrich from sessions
    sessions.forEach(s => {
        if (!usersMap[s.user_id]) {
            usersMap[s.user_id] = {
                user_id: s.user_id,
                email: s.user_email,
                businessName: '',
                fullName: '',
                totalOrders: 0,
                totalMinutes: 0,
                loginCount: 0,
                lastLogin: null,
                lastSeenAnnouncementId: null,
                seenAnnouncementAt: null
            };
        }
        const user = usersMap[s.user_id];
        user.email = s.user_email;
        user.loginCount++;
        user.totalMinutes += (s.duration_minutes || 0);
        if (!user.lastLogin || new Date(s.login_time) > new Date(user.lastLogin)) {
            user.lastLogin = s.login_time;
        }
    });

    // Count orders per user
    orders.forEach(o => {
        if (usersMap[o.user_id]) {
            usersMap[o.user_id].totalOrders++;
        }
    });

    // Show all users
    const usersArray = Object.values(usersMap);

    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (usersArray.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
                    <i class="fas fa-users" style="font-size: 32px; color: var(--admin-border); display: block; margin-bottom: 12px;"></i>
                    אין משתמשים רשומים עדיין
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = usersArray.map(user => {
        const hours = (user.totalMinutes / 60).toFixed(1);
        const lastLoginFormatted = user.lastLogin ? formatAdminDate(user.lastLogin) : '---';
        const isActive = user.lastLogin && (new Date(user.lastLogin) > new Date(Date.now() - 24 * 60 * 60 * 1000));
        const isSelected = adminSelectedUserId === user.user_id;
        const displayEmail = user.email || user.businessName || user.fullName || 'ללא אימייל';

        return `
            <tr class="clickable-row ${isSelected ? 'active-row' : ''}" onclick="filterByUser('${user.user_id}')">
                <td class="email-cell">${displayEmail}</td>
                <td>${user.email === ADMIN_EMAIL ? '<span style="color: #6366f1; font-weight: 700;"><i class="fas fa-user-shield"></i> מנהל מערכת</span>' : (user.businessName || user.fullName || '---')}</td>
                <td><strong>${user.totalOrders}</strong></td>
                <td><strong>${user.loginCount}</strong></td>
                <td>${hours} שעות</td>
                <td>
                    ${lastLoginFormatted}
                    ${isActive ? '<span class="admin-badge badge-active" style="margin-right: 8px;"><i class="fas fa-circle" style="font-size: 6px;"></i> פעיל</span>' : ''}
                </td>
                <td onclick="event.stopPropagation()">
                    ${renderPlanBadge(plansMap[user.user_id], user.email)}
                </td>
                <td style="font-size: 11px;" onclick="event.stopPropagation()">
                    ${user.seenAnnouncementAt ? `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="color: #10b981; font-weight: 600;"><i class="fas fa-check-circle"></i> ראה/תה ב-${new Date(user.seenAnnouncementAt).toLocaleDateString('he-IL')}</span>
                            <button onclick='viewAnnouncementById("${user.lastSeenAnnouncementId}")' style="background: none; border: none; color: #6366f1; cursor: pointer; text-decoration: underline; font-size: 10px; padding: 0; text-align: right;">
                                צפה בהודעה שראה/תה
                            </button>
                        </div>
                    ` : '<span style="color: #94a3b8;"><i class="fas fa-times-circle"></i> טרם נחשף</span>'}
                </td>
                <td style="text-align: center;" onclick="event.stopPropagation()">
                    <button class="impersonate-btn" onclick="startImpersonation('${user.user_id}', '${(user.businessName || user.fullName || user.email || '').replace(/'/g, "\\'")}')" title="צפה כמשתמש זה">
                        <i class="fas fa-eye"></i> צפה
                    </button>
                    <button class="impersonate-btn" onclick="openPlanModal('${user.user_id}', '${displayEmail.replace(/'/g, "\\'")}', '${plansMap[user.user_id]?.id || ''}', ${plansMap[user.user_id]?.founder || false})" style="background: #faf5ff; color: #7c3aed; border-color: #d8b4fe; margin-right: 4px;" title="שינוי חבילה">
                        <i class="fas fa-crown"></i> חבילה
                    </button>
                    <button class="impersonate-btn" onclick="openFeatureOverrides('${user.user_id}', '${displayEmail.replace(/'/g, "\\'")}')" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0; margin-right:4px;" title="ניהול החרגות">
                        <i class="fas fa-toggle-on"></i> החרגות
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Updates a user's pricing plan in the database.
 * Restricted by RLS to master admin only.
 */
function closePlanModal() {
    const modal = document.getElementById('planManagementModal');
    if (modal) modal.style.display = 'none';
}

function openPlanModal(userId, userEmail, currentPlan, isFounder) {
    document.getElementById('planModalUserEmail').textContent = userEmail;
    document.getElementById('planModalSelect').value = currentPlan;
    document.getElementById('founderLockCheck').checked = isFounder;
    
    // Set save button action
    const saveBtn = document.getElementById('savePlanBtn');
    saveBtn.onclick = () => {
        const newPlan = document.getElementById('planModalSelect').value;
        const isFounderLocked = document.getElementById('founderLockCheck').checked;
        updateUserPlan(userId, newPlan, isFounderLocked);
        closePlanModal();
    };

    const modal = document.getElementById('planManagementModal');
    if (modal) modal.style.display = 'flex';
}

async function updateUserPlan(userId, planId, isFounderLocked = false) {
    try {
        if (!planId) {
            // Remove plan assignment if none selected
            const { error } = await supabaseClient
                .from('user_plan')
                .delete()
                .eq('user_id', userId);
            
            if (error) throw error;
        } else {
            // Upsert the user/plan mapping
            const { error } = await supabaseClient
                .from('user_plan')
                .upsert({ 
                    user_id: userId, 
                    plan_id: planId,
                    founder_price_locked: isFounderLocked,
                    updated_at: new Date().toISOString()
                });
            
            if (error) throw error;
        }
        
        if (typeof showToast === 'function') showToast('החבילה עודכנה בהצלחה', 'success');
        
        // Refresh full data to sync local cache and UI
        await loadAdminPanelData();
        
    } catch (err) {
        console.error('Plan update failed:', err);
        if (typeof showToast === 'function') showToast('שגיאה בעדכון החבילה', 'error');
    }
}

// ---------------------------------------------
// Feature Overrides Management
// ---------------------------------------------

async function openFeatureOverrides(userId, userEmail) {
    document.getElementById('overrideUserEmail').textContent = userEmail;
    const container = document.getElementById('featuresListContainer');
    container.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="spinner"></div></div>';
    
    const modal = document.getElementById('featureOverridesModal');
    if (modal) modal.style.display = 'flex';

    try {
        // 1) Fetch user's plan_id
        const { data: userPlanData } = await supabaseClient
            .from('user_plan')
            .select('plan_id')
            .eq('user_id', userId)
            .maybeSingle();
        
        const userPlanId = userPlanData?.plan_id || 'starter';

        // 2) Fetch ALL possible features and their defaults for this plan
        // This ensures we show every feature from the mapping
        const { data: planFeatures } = await supabaseClient
            .from('plan_features')
            .select('*')
            .eq('plan_id', userPlanId)
            .order('feature_key');

        // 3) Fetch existing overrides
        const { data: userOverrides } = await supabaseClient
            .from('feature_flags')
            .select('*')
            .eq('user_id', userId);

        const overridesMap = (userOverrides || []).reduce((acc, o) => {
            acc[o.feature_key] = o.is_enabled;
            return acc;
        }, {});

        // 4) Build UI Table
        let html = `
            <div style="display: flex; padding: 8px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 700; font-size: 13px; color: #475569; border-radius: 8px 8px 0 0;">
                <div style="flex: 2;">פיצ'ר / תכונה</div>
                <div style="flex: 1; text-align: center;">חבילה</div>
                <div style="flex: 1.2; text-align: center;">החרגה ידנית</div>
            </div>
        `;

        if (!planFeatures || planFeatures.length === 0) {
            html += '<div style="padding: 20px; text-align: center; color: #64748b;">לא נמצאו תכונות מוגדרות במערכת</div>';
        } else {
            html += planFeatures.map(pf => {
                const key = pf.feature_key;
                const planDefault = pf.is_enabled;
                const override = overridesMap[key];
                const isOverrideActive = override !== undefined;
                
                return `
                    <div style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f1f5f9; background: ${isOverrideActive ? '#f0f9ff' : 'white'};">
                        <div style="flex: 2; display: flex; flex-direction: column;">
                            <span style="font-weight: 700; font-size: 14px; color: #1e293b; direction: ltr; text-align: right;">${key}</span>
                            ${isOverrideActive ? '<span style="font-size: 10px; color: #3b82f6; font-weight: 600;">החרגה פעילה (Override)</span>' : '<span style="font-size: 10px; color: #94a3b8;">לפי ברירת מחדל</span>'}
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <span class="admin-badge" style="background: ${planDefault ? '#ecfdf5' : '#fff1f2'}; color: ${planDefault ? '#059669' : '#e11d48'}; padding: 2px 8px; font-size: 11px; border: none;">
                                ${planDefault ? 'פעיל' : 'כבוי'}
                            </span>
                        </div>
                        <div style="flex: 1.2; text-align: center;">
                            <select onchange="updateFeatureOverride('${userId}', '${key}', this.value, ${planDefault})" 
                                    style="width: 100%; padding: 4px; border-radius: 6px; border: 1px solid ${isOverrideActive ? '#3b82f6' : '#cbd5e1'}; font-size: 11px; outline: none; background: white; cursor: pointer;">
                                <option value="default" ${!isOverrideActive ? 'selected' : ''}>כמו בחבילה</option>
                                <option value="true" ${isOverrideActive && override === true ? 'selected' : ''}>תמיד פעיל</option>
                                <option value="false" ${isOverrideActive && override === false ? 'selected' : ''}>תמיד כבוי</option>
                            </select>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = html;

    } catch (err) {
        console.error('Failed to load overrides:', err);
        container.innerHTML = '<div style="color:red; text-align:center; padding: 20px;">שגיאה בטעינ ה: ' + err.message + '</div>';
    }
}

async function updateFeatureOverride(userId, featureKey, value, planDefault) {
    try {
        const isDefaultSelected = value === 'default';
        const isValueSameAsPlan = (value === 'true' && planDefault === true) || (value === 'false' && planDefault === false);

        if (isDefaultSelected || isValueSameAsPlan) {
            // Delete override if selecting default OR selecting state that matches plan anyway
            const { error } = await supabaseClient
                .from('feature_flags')
                .delete()
                .eq('user_id', userId)
                .eq('feature_key', featureKey);
            if (error) throw error;
        } else {
            // Upsert the override
            const isEnabled = value === 'true';
            const { error } = await supabaseClient
                .from('feature_flags')
                .upsert({ 
                    user_id: userId, 
                    feature_key: featureKey, 
                    is_enabled: isEnabled,
                    created_at: new Date().toISOString()
                });
            if (error) throw error;
        }
        
        showToast('ההחרגה עודכנה', 'success');
        
        // Refresh UI only for this modal
        const currentEmail = document.getElementById('overrideUserEmail').textContent;
        openFeatureOverrides(userId, currentEmail);
        
    } catch (err) {
        console.error('Update override error:', err);
        showToast('שגיאה בעדכון ההחרגה', 'error');
    }
}

function closeFeatureOverridesModal() {
    const modal = document.getElementById('featureOverridesModal');
    if (modal) modal.style.display = 'none';
}

function filterByUser(userId) {
    if (adminSelectedUserId === userId) {
        adminSelectedUserId = null; // Toggle off
    } else {
        adminSelectedUserId = userId;
    }

    // Update filter dropdown
    const filterSelect = document.getElementById('ordersUserFilter');
    if (filterSelect) {
        filterSelect.value = adminSelectedUserId || '';
    }

    // Switch to orders tab so the user sees the filtered result
    if (adminSelectedUserId) {
        switchAdminTab('orders');
    }

    // Re-render with cached data (no need to reload from DB)
    if (window._cachedAdminData) {
        const { sessions, orders, profiles, userPlans } = window._cachedAdminData;
        renderUsersTable(sessions, orders, profiles, userPlans);
        renderOrdersTable(orders, profiles);
    }
}

// ============================================
// Orders Table
// ============================================

function renderOrdersTable(orders, profiles) {
    // Build user email map from profiles + sessions
    const userMap = {};
    profiles.forEach(p => {
        userMap[p.user_id] = p.business_name || p.full_name || p.user_id;
    });

    // Populate filter dropdown
    const filterSelect = document.getElementById('ordersUserFilter');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">כל המשתמשים</option>';
        const uniqueUsers = new Set();

        orders.forEach(o => {
            if (o.user_id && !uniqueUsers.has(o.user_id)) {
                uniqueUsers.add(o.user_id);
                const label = userMap[o.user_id] || o.user_id;
                filterSelect.innerHTML += `<option value="${o.user_id}">${label}</option>`;
            }
        });

        // Restore filter
        if (adminSelectedUserId) {
            filterSelect.value = adminSelectedUserId;
        } else if (currentVal) {
            filterSelect.value = currentVal;
        }
    }

    // Apply filter
    let filteredOrders = orders;
    if (adminSelectedUserId) {
        filteredOrders = orders.filter(o => o.user_id === adminSelectedUserId);
    } else {
        const filterValue = filterSelect?.value;
        if (filterValue) {
            filteredOrders = orders.filter(o => o.user_id === filterValue);
        }
    }

    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
                    <i class="fas fa-clipboard-list" style="font-size: 32px; color: var(--admin-border); display: block; margin-bottom: 12px;"></i>
                    אין הזמנות${adminSelectedUserId ? ' למשתמש זה' : ''}
                </td>
            </tr>
        `;
        return;
    }

    // Show most recent 100 orders
    const displayOrders = filteredOrders.slice(0, 100);

    tbody.innerHTML = displayOrders.map(order => {
        const owner = userMap[order.user_id] || '---';
        const days = calculateOrderDays(order);
        const total = days * (order.price_per_day || 0);
        const orderDate = order.created_at ? formatAdminDate(order.created_at) : '---';
        const checkIn = order.check_in ? formatAdminDateShort(order.check_in) : '---';
        const checkOut = order.check_out ? formatAdminDateShort(order.check_out) : '---';

        const statusClass = order.status === 'מאושר' ? 'color: #047857; background: #ecfdf5;' :
                           order.status === 'בוטל' ? 'color: #dc2626; background: #fef2f2;' :
                           'color: #d97706; background: #fffbeb;';

        return `
            <tr>
                <td style="font-weight: 600;">${owner}</td>
                <td>${order.owner_name || '---'}</td>
                <td>${order.dog_name || '---'}</td>
                <td style="font-size: 12px; color: var(--admin-text-muted);">${orderDate}</td>
                <td>${checkIn}</td>
                <td>${checkOut}</td>
                <td><strong>${days}</strong> ימים</td>
                <td><span style="padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; ${statusClass}">${order.status || 'ממתין'}</span></td>
                <td style="font-weight: 700;">₪${total.toLocaleString()}</td>
            </tr>
        `;
    }).join('');
}

function filterOrdersTable() {
    adminSelectedUserId = null;
    // Re-render with cached data
    if (window._cachedAdminData) {
        const { sessions, orders, profiles, userPlans } = window._cachedAdminData;
        renderUsersTable(sessions, orders, profiles, userPlans);
        renderOrdersTable(orders, profiles);
    }
}

// ============================================
// Session History Table
// ============================================

function renderSessionHistory(sessions) {
    window._adminSessions = sessions; // Cache for cross-filtering

    const tbody = document.getElementById('sessionsTableBody');
    if (!tbody) return;

    // Filter out admin sessions from the history display
    const filteredSessions = (sessions || []).filter(s => s.user_email !== ADMIN_EMAIL);

    // Show last 30 sessions
    const recentSessions = filteredSessions.slice(0, 30);

    if (recentSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
                    <i class="fas fa-clock" style="font-size: 32px; color: var(--admin-border); display: block; margin-bottom: 12px;"></i>
                    אין היסטוריית כניסות
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = recentSessions.map(session => {
        const loginTime = formatAdminDate(session.login_time);
        const duration = session.duration_minutes || 0;
        const durationDisplay = duration < 1 ? '< 1 דקה' : duration + ' דקות';

        return `
            <tr>
                <td class="email-cell">${session.user_email}</td>
                <td>${loginTime}</td>
                <td>${durationDisplay}</td>
                <td>${formatAdminDate(session.last_active)}</td>
            </tr>
        `;
    }).join('');
}

// ============================================
// Activity Feed (Audit Logs)
// ============================================

const ACTIVITY_PER_PAGE = 50;
window._activityCurrentPage = 1;
window._cachedActivityLogs = [];

async function loadAllActivityLogs() {
    try {
        const { data, error } = await supabaseClient
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) {
            console.error('Error loading audit logs:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Activity logs load error:', err);
        return [];
    }
}

function renderActivityFeed(logs, profiles) {
    window._cachedActivityLogs = logs;

    // Build user lookup
    const userMap = {};
    (profiles || []).forEach(p => {
        userMap[p.user_id] = {
            email: p.email || '',
            name: p.business_name || p.full_name || ''
        };
    });

    // Populate user filter dropdown
    const userFilter = document.getElementById('activityUserFilter');
    if (userFilter) {
        const currentVal = userFilter.value;
        userFilter.innerHTML = '<option value="">כל המשתמשים</option>';
        const uniqueUsers = new Set();
        logs.forEach(log => {
            if (log.user_id && !uniqueUsers.has(log.user_id)) {
                uniqueUsers.add(log.user_id);
                let label = userMap[log.user_id]?.name || userMap[log.user_id]?.email || log.user_id.slice(0, 8) + '...';
                if (userMap[log.user_id]?.email === ADMIN_EMAIL) label = '🛡️ מנהל מערכת';
                userFilter.innerHTML += `<option value="${log.user_id}">${label}</option>`;
            }
        });
        if (currentVal) userFilter.value = currentVal;
    }

    // Store for filtering
    window._activityUserMap = userMap;
    filterActivityFeed();
}

function filterActivityFeed() {
    const logs = window._cachedActivityLogs || [];
    const userMap = window._activityUserMap || {};
    const userFilterVal = document.getElementById('activityUserFilter')?.value || '';
    const typeFilterVal = document.getElementById('activityTypeFilter')?.value || '';
    const searchTerm = (document.getElementById('activitySearchInput')?.value || '').toLowerCase().trim();

    let filtered = logs.filter(l => {
        const u = userMap[l.user_id];
        return u?.email !== ADMIN_EMAIL;
    });

    if (userFilterVal) {
        filtered = filtered.filter(l => l.user_id === userFilterVal);
    }

    if (typeFilterVal) {
        filtered = filtered.filter(l => l.action_type === typeFilterVal);
    }

    if (searchTerm) {
        filtered = filtered.filter(l =>
            (l.description || '').toLowerCase().includes(searchTerm) ||
            (l.staff_name || '').toLowerCase().includes(searchTerm) ||
            (l.action_type || '').toLowerCase().includes(searchTerm)
        );
    }

    // Pagination
    const totalLogs = filtered.length;
    const maxPage = Math.max(1, Math.ceil(totalLogs / ACTIVITY_PER_PAGE));
    if (window._activityCurrentPage > maxPage) window._activityCurrentPage = maxPage;

    const startIdx = (window._activityCurrentPage - 1) * ACTIVITY_PER_PAGE;
    const pageLogs = filtered.slice(startIdx, startIdx + ACTIVITY_PER_PAGE);

    const container = document.getElementById('activityFeedContainer');
    if (!container) return;

    if (pageLogs.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--admin-text-muted);">
                <i class="fas fa-stream" style="font-size: 40px; color: var(--admin-border); display: block; margin-bottom: 16px;"></i>
                ${searchTerm || userFilterVal || typeFilterVal ? 'לא נמצאו פעולות התואמות לסינון' : 'אין פעילות מתועדת עדיין'}
            </div>
        `;
        renderActivityPagination(0, 1, 1);
        return;
    }

    // Group logs by date
    const groupedByDate = {};
    pageLogs.forEach(log => {
        const dateKey = new Date(log.created_at).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
        groupedByDate[dateKey].push(log);
    });

    let html = '';
    for (const [dateLabel, dateLogs] of Object.entries(groupedByDate)) {
        html += `<div class="activity-date-group">
            <div class="activity-date-header">
                <i class="fas fa-calendar-day"></i> ${dateLabel}
                <span class="activity-date-count">${dateLogs.length} פעולות</span>
            </div>`;

        dateLogs.forEach(log => {
            let userName = userMap[log.user_id]?.name || userMap[log.user_id]?.email || 'משתמש לא ידוע';
            
            // Special case for system admin
            if (log.user_id && userMap[log.user_id]?.email === ADMIN_EMAIL) {
                userName = 'מנהל מערכת (שלך)';
            } else if (!log.user_id) {
                userName = 'מערכת';
            }
            const userInitial = userName.charAt(0).toUpperCase();
            const timeStr = new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const relativeTime = getRelativeTime(log.created_at);

            let iconClass, iconBg, iconColor, actionLabel;
            switch (log.action_type) {
                case 'INSERT':
                    iconClass = 'fa-plus-circle';
                    iconBg = '#ecfdf5';
                    iconColor = '#047857';
                    actionLabel = 'הוספה';
                    break;
                case 'DELETE':
                    iconClass = 'fa-trash-alt';
                    iconBg = '#fef2f2';
                    iconColor = '#dc2626';
                    actionLabel = 'מחיקה';
                    break;
                default: // UPDATE
                    iconClass = 'fa-edit';
                    iconBg = '#eef2ff';
                    iconColor = '#4f46e5';
                    actionLabel = 'עדכון';
                    break;
            }

            // Color for user avatar based on user_id hash
            const avatarColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
            const colorIdx = log.user_id ? log.user_id.charCodeAt(0) % avatarColors.length : 0;
            const avatarColor = avatarColors[colorIdx];

            html += `
                <div class="activity-item">
                    <div class="activity-item-avatar" style="background: ${avatarColor};">
                        ${userInitial}
                    </div>
                    <div class="activity-item-content">
                        <div class="activity-item-header">
                            <span class="activity-item-user">${userName}</span>
                            ${log.staff_name ? `<span class="activity-item-staff"><i class="fas fa-user-tag"></i> ${log.staff_name}</span>` : ''}
                            <span class="activity-item-badge" style="background: ${iconBg}; color: ${iconColor};">
                                <i class="fas ${iconClass}"></i> ${actionLabel}
                            </span>
                        </div>
                        <div class="activity-item-desc">${log.description || 'ללא תיאור'}</div>
                        <div class="activity-item-time">
                            <i class="fas fa-clock"></i> ${timeStr}
                            <span class="activity-item-relative">${relativeTime}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
    }

    container.innerHTML = html;
    renderActivityPagination(totalLogs, window._activityCurrentPage, maxPage);
}

function renderActivityPagination(totalLogs, currentPage, maxPage) {
    const container = document.getElementById('activityPagination');
    if (!container) return;

    if (totalLogs <= ACTIVITY_PER_PAGE) {
        container.innerHTML = `<span class="activity-pagination-info">${totalLogs} פעולות</span>`;
        return;
    }

    container.innerHTML = `
        <button class="admin-nav-btn" onclick="window._activityCurrentPage--; filterActivityFeed()" ${currentPage <= 1 ? 'disabled' : ''} style="padding: 8px 16px; font-size: 13px;">
            <i class="fas fa-chevron-right"></i> הקודם
        </button>
        <span class="activity-pagination-info">עמוד ${currentPage} מתוך ${maxPage} (${totalLogs} פעולות)</span>
        <button class="admin-nav-btn" onclick="window._activityCurrentPage++; filterActivityFeed()" ${currentPage >= maxPage ? 'disabled' : ''} style="padding: 8px 16px; font-size: 13px;">
            הבא <i class="fas fa-chevron-left"></i>
        </button>
    `;
}

function getRelativeTime(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'הרגע';
    if (diffMin < 60) return `לפני ${diffMin} דקות`;
    if (diffHour < 24) return `לפני ${diffHour} שעות`;
    if (diffDay === 1) return 'אתמול';
    if (diffDay < 7) return `לפני ${diffDay} ימים`;
    if (diffDay < 30) return `לפני ${Math.floor(diffDay / 7)} שבועות`;
    return `לפני ${Math.floor(diffDay / 30)} חודשים`;
}

// ============================================
// Date Formatting
// ============================================

function formatAdminDate(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAdminDateShort(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// ============================================
// Page Init
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAdminAccess();
    if (!session) return;

    // Clear any active impersonation when returning to the main dashboard
    sessionStorage.removeItem('pensionet_impersonate_user_id');
    sessionStorage.removeItem('pensionet_impersonate_user_name');

    document.getElementById('adminContent').style.display = 'block';

    // Create session for tracking
    await createUserSession();

    // Load panel data
    await loadAdminPanelData();

    // Tab switching
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) switchAdminTab(tab);
        });
    });

    console.log('Admin panel initialized successfully');
});

// ============================================
// User Impersonation
// ============================================

function startImpersonation(userId, userName) {
    if (!userId) return;
    
    const displayName = userName || userId.slice(0, 8) + '...';
    
    showConfirmModal(
        'אישור מעבר למצב צפייה',
        `האם ברצונך לצפות במערכת כמשתמש <strong>"${displayName}"</strong>?<br><br>תועבר לעמוד הניהול ותראה את כל הנתונים של המשתמש הזה.<br>לחץ "סיום צפייה" בבאנר העליון כדי לחזור.`,
        () => {
            // Confirm callback
            sessionStorage.setItem('pensionet_impersonate_user_id', userId);
            sessionStorage.setItem('pensionet_impersonate_user_name', displayName);
            window.location.href = 'admin.html';
        }
    );
}

function stopImpersonation() {
    sessionStorage.removeItem('pensionet_impersonate_user_id');
    sessionStorage.removeItem('pensionet_impersonate_user_name');
    window.location.href = 'admin_panel.html';
}

// ============================================
// Modal Helpers
// ============================================

function showConfirmModal(title, text, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const textEl = document.getElementById('confirmModalText');
    const okBtn = document.getElementById('confirmOkBtn');

    if (!modal || !titleEl || !textEl || !okBtn) return;

    titleEl.innerText = title;
    textEl.innerHTML = text; // Use innerHTML as requested

    // Clone button to remove old event listeners
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.onclick = () => {
        closeConfirmModal();
        if (onConfirm) onConfirm();
    };

    modal.classList.add('show');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('show');
}

// ============================================
// Data Management (Export / Reset)
// ============================================

async function exportAllUsageToExcel() {
    try {
        showToast('מפיק דו"ח שימוש...', 'info');
        
        // Fetch sessions and activity logs
        const [sessions, logs] = await Promise.all([
            loadAllSessions(),
            loadAllActivityLogs()
        ]);

        if (!sessions.length && !logs.length) {
            showToast('אין נתונים לייצוא', 'info');
            return;
        }

        // Build user map for names
        const profiles = window._cachedAdminData?.profiles || [];
        const userMap = {};
        profiles.forEach(p => {
            userMap[p.user_id] = p.business_name || p.full_name || p.email;
        });

        // Create CSV content (Excel-friendly with BOM for Hebrew)
        let csv = '\uFEFF';
        
        // Sessions Section
        csv += 'דו"ח כניסות ושימוש במערכת\n';
        csv += 'אימייל,שם משתמש,זמן כניסה,זמן פעילות אחרון,משך שימוש (דקות)\n';
        sessions.forEach(s => {
            const userName = userMap[s.user_id] || 'לא ידוע';
            csv += `${s.user_email},${userName},${s.login_time},${s.last_active},${s.duration_minutes || 0}\n`;
        });

        csv += '\n\n';
        
        // Activity Logs Section
        csv += 'יומן פעילות מלא\n';
        csv += 'זמן,אימייל/מבצע,סוג פעולה,תיאור,שם איש צוות\n';
        logs.forEach(l => {
            const userName = userMap[l.user_id] || (l.user_id === null ? 'מערכת' : l.user_id);
            const desc = (l.description || '').replace(/"/g, '""'); // Escape quotes
            csv += `${l.created_at},${userName},${l.action_type},"${desc}",${l.staff_name || ''}\n`;
        });

        // Download Procedure
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `pension_net_usage_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('הקובץ יוצא בהצלחה כקובץ CSV', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showToast('שגיאה בתהליך הייצוא', 'error');
    }
}

function confirmResetUsageData() {
    showConfirmModal(
        'איפוס נתוני שימוש במערכת',
        'האם אתה בטוח שברצונך למחוק את כל נתוני השימוש (כניסות ופעילות)?<br><br><span style="color: var(--admin-danger); font-weight: bold;"><i class="fas fa-exclamation-triangle"></i> שים לב:</span> פעולה זו תמחק לצמיתות את כל היסטוריית הכניסות ויומן הפעולות מכל הזמנים. לא ניתן לשחזר נתונים אלו.',
        resetUsageData
    );
}

async function resetUsageData() {
    try {
        showToast('מנקה נתוני מערכת...', 'info');
        
        // 1. Delete sessions (all rows where login_time exists)
        const { error: sessionError } = await supabaseClient
            .from('user_sessions')
            .delete()
            .gte('login_time', '1970-01-01'); 

        // 2. Delete audit logs (all rows where created_at exists)
        const { error: logError } = await supabaseClient
            .from('audit_logs')
            .delete()
            .gte('created_at', '1970-01-01');

        if (sessionError || logError) {
            console.error('Reset error:', sessionError || logError);
            showToast('שגיאה במחיקת הנתונים. ייתכן שאין הרשאות מתאימות.', 'error');
            return;
        }

        showToast('כל נתוני השימוש אופסו בהצלחה', 'success');
        
        // Refresh the whole panel
        await loadAdminPanelData();
    } catch (err) {
        console.error('Reset crash:', err);
        showToast('שגיאה קריטית באיפוס הנתונים', 'error');
    }
}
