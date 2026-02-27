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
        const [sessions, orders, profiles, activityLogs] = await Promise.all([
            loadAllSessions(),
            loadAllOrders(),
            loadAllProfiles(),
            loadAllActivityLogs()
        ]);

        renderSummaryCards(sessions, orders, profiles);
        renderSessionHistory(sessions);

        // Cache data for re-renders (filtering)
        window._cachedAdminData = { sessions, orders, profiles };

        renderUsersTable(sessions, orders, profiles);
        renderOrdersTable(orders, profiles);
        renderActivityFeed(activityLogs, profiles);
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

    // Show all users — exclude system admin from stats/users list
    const usersArray = Object.values(usersMap).filter(u => u.email !== ADMIN_EMAIL);

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
                <td style="text-align: center;" onclick="event.stopPropagation()">
                    <button class="impersonate-btn" onclick="startImpersonation('${user.user_id}', '${(user.businessName || user.fullName || user.email || '').replace(/'/g, "\\'")}')" title="צפה כמשתמש זה">
                        <i class="fas fa-eye"></i> צפה
                    </button>
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

    let filtered = logs;

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
