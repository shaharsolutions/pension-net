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
        const [sessions, orders, profiles] = await Promise.all([
            loadAllSessions(),
            loadAllOrders(),
            loadAllProfiles()
        ]);

        renderSummaryCards(sessions, orders, profiles);
        renderSessionHistory(sessions);

        // Cache data for re-renders (filtering)
        window._cachedAdminData = { sessions, orders, profiles };

        renderUsersTable(sessions, orders, profiles);
        renderOrdersTable(orders, profiles);
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
    // Exclude admin sessions from display
    return (data || []).filter(s => s.user_email !== ADMIN_EMAIL);
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
    // Exclude admin profile from display
    return (data || []).filter(p => p.email !== ADMIN_EMAIL);
}

// ============================================
// Summary Cards
// ============================================

function renderSummaryCards(sessions, orders, profiles) {
    // Unique users
    const uniqueUsers = new Set(sessions.map(s => s.user_email)).size || profiles.length;

    // Active users (active in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = new Set(
        sessions.filter(s => new Date(s.last_active) > oneDayAgo).map(s => s.user_email)
    ).size;

    // Total logins
    const totalLogins = sessions.length;

    // Total usage hours
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
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

function renderUsersTable(sessions, orders, profiles) {
    const usersMap = {};

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
            lastLogin: null
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
                lastLogin: null
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

    // Show all users — use user_id as display fallback if email is unavailable
    const usersArray = Object.values(usersMap);

    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (usersArray.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
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
                <td>${user.businessName || user.fullName || '---'}</td>
                <td><strong>${user.totalOrders}</strong></td>
                <td><strong>${user.loginCount}</strong></td>
                <td>${hours} שעות</td>
                <td>
                    ${lastLoginFormatted}
                    ${isActive ? '<span class="admin-badge badge-active" style="margin-right: 8px;"><i class="fas fa-circle" style="font-size: 6px;"></i> פעיל</span>' : ''}
                </td>
            </tr>
        `;
    }).join('');
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
        const { sessions, orders, profiles } = window._cachedAdminData;
        renderUsersTable(sessions, orders, profiles);
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
        const { sessions, orders, profiles } = window._cachedAdminData;
        renderUsersTable(sessions, orders, profiles);
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

    // Show last 30 sessions
    const recentSessions = sessions.slice(0, 30);

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
