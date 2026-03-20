window.isSessionVerified = false;
window.businessName = '';
window.lastPinVerificationTime = parseInt(localStorage.getItem('pensionet_last_pin_verified') || '0');
const PIN_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Hours in MS


// --- Supabase Auth Integration ---
async function checkAuthStatus() {
  // Check for demo mode in URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') {
    console.log('🚀 Running in Demo Mode');
    window.isDemoMode = true;
    return { user: { id: 'demo-user', email: 'demo@example.com' } };
  }

  const session = await Auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// Alias for safety
const checkAuth = checkAuthStatus;

async function logout() {
  localStorage.removeItem('pensionet_last_pin_verified');
  localStorage.removeItem('pensionNet_activeStaff');
  window.lastPinVerificationTime = 0;
  window.isSessionVerified = false;
  window.isAdminMode = false;
  window.overlayManuallyClosed = false;
  await Auth.logout();
}

// Make logout globally accessible
window.logout = logout;

window.overlayManuallyClosed = false;

function closeProfileOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    overlay.style.setProperty('display', 'none', 'important');
    window.overlayManuallyClosed = true;
    
    // If no valid session exists, ensure identity is reset to 'צוות'
    const now = Date.now();
    const pinValid = window.lastPinVerificationTime && (now - window.lastPinVerificationTime < PIN_EXPIRATION_MS);
    
    if (!pinValid) {
      const activeSelect = document.getElementById('activeStaffSelect');
      if (activeSelect) activeSelect.value = 'צוות';
      localStorage.setItem('pensionNet_activeStaff', 'צוות');
      window.isSessionVerified = false;
      
      // Update UI to reflect 'צוות' permissions
      if (typeof updateModeUI === 'function') updateModeUI();
    }
  }
}

// Make closeProfileOverlay globally accessible
window.closeProfileOverlay = closeProfileOverlay;

async function copyBookingLink(event) {
  if (event) event.preventDefault();
  
  const session = window.currentUserSession || await Auth.getSession();
  if (session && session.user) {
    // Construct the absolute URL to order.html
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const directory = pathname.substring(0, pathname.lastIndexOf('/'));
    const bookingUrl = `${origin}${directory}/order.html?owner=${session.user.id}`;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(bookingUrl);
        
        // Alert user if business name is still the default/missing
        if (!window.businessName || window.businessName === 'פנסיון לכלבים') {
          showToast('הקישור הועתק! שים לב: שם הפנסיון עדיין לא הוגדר בהגדרות.', 'info');
        } else {
          showToast('הקישור להזמנות הועתק! ניתן לשלוח אותו ללקוחות.', 'success');
        }
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement("textarea");
        textArea.value = bookingUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('הקישור הועתק (שיטת גיבוי)!', 'success');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      // Last resort fallback
      prompt('העתק את הקישור שלך מכאן:', bookingUrl);
    }
  } else {
    showToast('שגיאה: לא נמצא סשן פעיל. נא להתחבר מחדש.', 'error');
  }
}


document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') {
     window.isDemoMode = true;
     window.currentPlanId = 'pro_plus'; // Show all features in demo
     window.managerName = 'מנהל דמו';
     window.currentStaffMembers = [{ name: 'עובד לדוגמה', pin: '1234', permissions: { edit_status: true, edit_details: true } }];
     document.body.classList.add('demo-mode');
     const overlay = document.getElementById('login-overlay');
     if (overlay) overlay.style.setProperty('display', 'none', 'important');
  }

  const session = await checkAuthStatus();
  if (session) {
    window.currentUserSession = session; // Cache session

    // --- Feature Gating Initialization ---
    const impersonateUserId = sessionStorage.getItem('pensionet_impersonate_user_id');
    const targetUserId = impersonateUserId || session.user.id;

    if (typeof Features !== 'undefined') {
      await Features.init(targetUserId);
    }
    
    // --- Impersonation Mode ---
    const impersonateUserName = sessionStorage.getItem('pensionet_impersonate_user_name');
    const ADMIN_EMAIL_CHECK = 'shaharsolutions@gmail.com';
    
    if (impersonateUserId && session.user.email === ADMIN_EMAIL_CHECK) {
      // Override the user.id in the session to load impersonated user's data
      window.isImpersonating = true;
      window.impersonateOriginalSession = { ...session, user: { ...session.user } };
      
      // Bypass PIN/Overlay for impersonation
      window.isAdminMode = true; 
      window.lastPinVerificationTime = Date.now();
      window.overlayManuallyClosed = true;

      // Create a proxy session with the impersonated user's id
      window.currentUserSession = {
        ...session,
        user: {
          ...session.user,
          id: impersonateUserId,
          // Keep the admin's email for auth checks but override ID for data
        }
      };
      
      // Inject impersonation banner
      const banner = document.createElement('div');
      banner.id = 'impersonation-banner';
      banner.innerHTML = `
        <div style="
          position: relative; z-index: 99999;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white; padding: 12px 20px;
          display: flex; align-items: center; justify-content: center; gap: 15px;
          font-weight: 700; font-size: 14px;
          box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
          direction: rtl; font-family: 'Heebo', sans-serif;
          animation: impersonateBannerSlide 0.3s ease;
          flex-wrap: wrap; text-align: center;
          margin: -20px -20px 20px -20px;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-user-secret" style="font-size: 18px;"></i>
            <span>מצב צפייה כמשתמש: <strong>${impersonateUserName || 'משתמש'}</strong></span>
          </div>
          <span style="opacity: 0.8; font-size: 12px; font-weight: 400;">
            (הנתונים מוצגים בקריאה בלבד)
          </span>
          <button onclick="stopImpersonationFromAdmin()" style="
            background: rgba(255,255,255,0.25); color: white; border: 2px solid rgba(255,255,255,0.5);
            padding: 6px 18px; border-radius: 8px; cursor: pointer;
            font-family: inherit; font-weight: 700; font-size: 13px;
            transition: all 0.2s; display: flex; align-items: center; gap: 6px;
            margin-right: auto;
          " onmouseover="this.style.background='rgba(255,255,255,0.4)'" 
             onmouseout="this.style.background='rgba(255,255,255,0.25)'">
            <i class="fas fa-arrow-right"></i> סיום צפייה
          </button>
        </div>
      `;
      document.body.prepend(banner);
      document.body.classList.add('impersonation-mode');
      
      // Close the login overlay if open
      const overlay = document.getElementById('login-overlay');
      if (overlay) {
        if (window.isDemoMode) {
          overlay.style.setProperty('display', 'none', 'important');
        } else {
          overlay.style.display = 'none';
        }
      }

      // Add a CSS rule to help make it read-only and handle banner layout
      const style = document.createElement('style');
      style.innerHTML = `
        body.impersonation-mode {
          /* Keep the body padding to ensure flow works */
        }

        #impersonation-banner {
            margin-bottom: 25px;
        }

        /* Offset toast notifications since banner is now in flow */
        body.impersonation-mode #toast-container {
          top: 100px !important;
        }

        body.impersonation-mode .movement-action-btn,
        body.impersonation-mode .view-notes-btn,
        body.impersonation-mode .save-note-btn,
        body.impersonation-mode .edit-booking-btn,
        body.impersonation-mode .status-select,
        body.impersonation-mode button[onclick*=\"openEditClientModal\"],
        body.impersonation-mode button[onclick*=\"saveEditClient\"],
        body.impersonation-mode .header-btn:not([onclick*=\"stopImpersonation\"]),
        body.impersonation-mode .delete-btn,
        body.impersonation-mode #deleteAllBtn,
        body.impersonation-mode .admin-action-btn {
          pointer-events: none !important;
          opacity: 0.6 !important;
          filter: grayscale(0.6) !important;
          cursor: not-allowed !important;
        }

        @keyframes impersonateBannerSlide {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);

      console.log(`🕵️ Impersonating user: ${impersonateUserName} (${impersonateUserId})`);
    }
    
    document.getElementById("mainContent").style.display = "block";
    switchCalendarView(window.currentView);
    await loadSettings(); // Load profile settings & plan first
    loadData(); // Then load data (which will use the resolved plan)

    // Toggle PIN visibility
    document.getElementById('togglePinVisibility')?.addEventListener('click', function() {
      const pinInput = document.getElementById('settings-admin-pin');
      const icon = this.querySelector('i');
      if (pinInput.type === 'password') {
        pinInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        pinInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });

    // Handle password change
    document.getElementById('changePasswordBtn')?.addEventListener('click', async function() {
      const newPassword = document.getElementById('settings-new-password').value;
      const confirmPassword = document.getElementById('settings-confirm-password').value;

      if (!newPassword || newPassword.length < 6) {
        showToast('הסיסמה חייבת להכיל לפחות 6 תווים', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast('הסיסמאות אינן תואמות', 'error');
        return;
      }

      this.disabled = true;
      this.textContent = 'מעדכן...';

      try {
        const { error } = await Auth.updatePassword(newPassword);
        if (error) throw error;

        showToast('הסיסמה עודכנה בהצלחה!', 'success');
        document.getElementById('settings-new-password').value = '';
        document.getElementById('settings-confirm-password').value = '';
      } catch (err) {
        console.error('Password update error:', err);
        showToast('שגיאה בעדכון הסיסמה: ' + err.message, 'error');
      } finally {
        this.disabled = false;
        this.textContent = 'עדכן סיסמת כניסה';
      }
    });

    // Check for announcements after data is loaded
    setTimeout(() => checkForAnnouncements(), 1500); 
  }

  
  // Event delegation for movement buttons
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.movement-action-btn');
    if (btn) {
      e.preventDefault();
      console.log('Button clicked:', btn.id); // Debug log
      const id = btn.id;
      // Adjusted regex to match any ID format (numeric or UUID)
      const match = id.match(/^movement-(entering|leaving)-(.+)$/);
      if (match) {
        const type = match[1];
        const orderId = match[2]; // Keep as string to support UUIDs
        // Only parse if it looks like a pure number, otherwise keep string
        const finalId = /^\d+$/.test(orderId) ? parseInt(orderId, 10) : orderId;
        
        console.log('Toggling:', type, finalId); // Debug log
        toggleMovementChecked(type, finalId);
      } else {
        console.warn('Regex did not match for ID:', id);
      }
    }
  });
});

// Login is now handled by login.html


const pensionNetSupabase = supabaseClient;

// Stop impersonation and go back to admin panel
function stopImpersonationFromAdmin() {
  sessionStorage.removeItem('pensionet_impersonate_user_id');
  sessionStorage.removeItem('pensionet_impersonate_user_name');
  window.location.href = 'admin_panel.html';
}


const HISTORY_ROWS_PER_PAGE = 10;
window.pastOrdersSearchTerm = "";
window.pastOrdersCurrentPage = 1;
window.pastOrdersRawData = [];

// --- לוגיקת לוח שנה חדשה ---
window.currentCalendarDate = new Date();
window.allOrdersCache = []; // שמירת הנתונים המלאים
window.currentView = localStorage.getItem('pensionet_calendar_view') || "calendar"; // 'calendar' או 'dogs' או 'weekly'

function calculateDays(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end - start);
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return nights + 1;
}

function initFlatpickr() {
  if (typeof flatpickr === 'undefined') return;
  
  flatpickr(".date-input", {
    locale: "he",
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    allowInput: false,
    disableMobile: true,
    // static: true, // הסרתי כי זה עלול להפריע לסגירה בלחיצה בחוץ
    // theme: "material_blue", // Styling via admin.css
    onOpen: function(selectedDates, dateStr, instance) {
      instance.calendarContainer.classList.add("premium-datepicker");
    },
    onChange: function(selectedDates, dateStr, instance) {
      const row = instance.element.closest("tr");
      if (row) {
        if (instance.element.dataset.field === "check_in") {
          updateCheckOutFromDays(row);
        } else if (instance.element.dataset.field === "check_out") {
          updateDaysFromDates(row);
        }
        // Refresh day name display if exists
        const displayDiv = instance.element.nextElementSibling;
        if (displayDiv && selectedDates.length > 0) {
          const date = selectedDates[0];
          const dayName = date.toLocaleDateString("he-IL", { weekday: "long" });
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          displayDiv.textContent = `${day}/${month}/${year} (${dayName})`;
        }
      }
    }
  });
}

function updateCheckOutFromDays(row) {
  const daysInput = row.querySelector(".days-input");
  const checkInInput = row.querySelector('.date-input[data-field="check_in"]');
  const checkOutInput = row.querySelector('.date-input[data-field="check_out"]');

  if (!daysInput || !checkInInput || !checkOutInput) return;

  const days = parseInt(daysInput.value);
  const checkInDate = checkInInput.value;

  if (!checkInDate || isNaN(days)) return;

  const parts = checkInDate.split("-");
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);

  const date = new Date(year, month, day);
  date.setDate(date.getDate() + (days - 1));

  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  const newDay = String(date.getDate()).padStart(2, "0");

  checkOutInput.value = `${newYear}-${newMonth}-${newDay}`;

  const displayDiv = checkOutInput.nextElementSibling;
  if (displayDiv) {
    const dayName = date.toLocaleDateString("he-IL", { weekday: "long" });
    displayDiv.textContent = `${newDay}/${newMonth}/${newYear} (${dayName})`;
  }
}
function updateDaysFromDates(row) {
  const checkInInput = row.querySelector('.date-input[data-field="check_in"]');
  const checkOutInput = row.querySelector('.date-input[data-field="check_out"]');
  const daysInput = row.querySelector(".days-input");

  if (!checkInInput || !checkOutInput || !daysInput) return;

  const checkIn = checkInInput.value;
  const checkOut = checkOutInput.value;

  if (!checkIn || !checkOut) return;

  const days = calculateDays(checkIn, checkOut);
  daysInput.value = days;
  
  // Sync price/total display
  const priceInput = row.querySelector(".price-input");
  const tooltip = row.querySelector(".tooltip");
  const totalLabel = row.querySelector(".total-price-display");

  if (priceInput) {
    const price = parseInt(priceInput.value) || 0;
    const total = days * price;
    if (tooltip) tooltip.textContent = `עלות שהייה: ${formatNumber(total)}₪`;
    if (totalLabel) totalLabel.textContent = `סה"כ: ${formatNumber(total)}₪`;
  }
}


function addDaysToDate(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const pad = (n) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const pad = (n) => n.toString().padStart(2, "0");
  const dayName = d.toLocaleDateString("he-IL", { weekday: "long" });
  return `${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()} (${dayName})`;
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/[\s\-]/g, "");
  const withCountryCode = cleaned.replace(/^0/, "972");
  return withCountryCode;
}

function createWhatsAppLink(phone) {
  if (!phone) return "";
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const cleanPhone = phone.replace(/[\s\-]/g, "");
  return `
    <div class="phone-actions">
      <a href="tel:${cleanPhone}" class="phone-link">${phone}</a>
      <a href="https://wa.me/${formattedPhone}" target="_blank" class="whatsapp-icon-link" title="פתיחת צ'אט בווטסאפ">
        <i class="fab fa-whatsapp"></i>
      </a>
    </div>
  `;
}

function generateWhatsAppConfirmationLink(row) {
  // Feature Check: Prevent rendering if not enabled for user
  if (typeof Features !== 'undefined' && !Features.isEnabled('whatsapp_automation')) {
    return '';
  }
  
  if (!row.phone) return '';
  
  // Calculate total price
  const days = calculateDays(row.check_in, row.check_out);
  const pricePerDay = row.price_per_day || 130;
  const totalPrice = days * pricePerDay;
  
  // Helper to format dates for message
  const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      return `${day}/${month}/${d.getFullYear()}`;
  };

  const params = {
      customer_name: (row.owner_name || 'לקוח').split(' ')[0],
      dog_name: row.dog_name || 'הכלב',
      check_in: formatDate(row.check_in),
      check_out: formatDate(row.check_out),
      total_price: totalPrice
  };

  // Ultra-safe manual encoding strategy
  // We avoid passing emojis to encodeURIComponent() entirely to prevent encoding mismatches
  const enc = (str) => encodeURIComponent(str);
  
  // URL-encoded Emoji Sequences (Safe ASCII strings)
  const DOG_CODE = '%F0%9F%90%B6';      // 🐶
  const CALENDAR_CODE = '%F0%9F%93%85'; // 📅
  const MONEY_CODE = '%F0%9F%92%B0';    // 💰
  const SMILE_CODE = '%F0%9F%99%82';    // 🙂
  const NEWLINE = '%0A';
  
  // Build pieces
  const p1 = enc(`היי ${params.customer_name},`);
  const bNamePrefix = window.businessName ? enc(` מ-${window.businessName}`) : '';
  const p2 = enc(`מאשרים את ההזמנה של ${params.dog_name}`) + bNamePrefix + enc(` `) + DOG_CODE;
  
  // Get owner phone from session metadata if available
  const ownerPhone = window.currentUserSession?.user?.user_metadata?.phone || '';
  const ownerContact = ownerPhone ? enc(` (טלפון לבירורים: ${ownerPhone})`) : '';

  const p3 = CALENDAR_CODE + enc(', תאריכים: ' + params.check_in + ' עד ' + params.check_out);
  const p4 = MONEY_CODE + enc(` מחיר כולל: ${params.total_price} ש"ח`);
  const p5 = enc(`אם יש שאלה או שינוי - נשמח שתכתבו לנו כאן`) + ownerContact + enc(` `) + SMILE_CODE;

  // Concatenate without further encoding
  const fullEncodedText = p1 + NEWLINE + p2 + NEWLINE + NEWLINE + p3 + NEWLINE + p4 + NEWLINE + NEWLINE + p5;
  
  const phone = formatPhoneForWhatsApp(row.phone);
  const finalUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${fullEncodedText}`;
  
  // Check if already sent or if status is 'מאושר'
  const sentConfirmations = JSON.parse(localStorage.getItem('sentConfirmations') || '{}');
  const isSent = sentConfirmations[row.id] || row.status === 'מאושר';
  
  if (isSent) {
    return `<div class="whatsapp-confirm-container" id="confirm-container-${row.id}">
      <span class="whatsapp-sent-badge">נשלח ✓</span>
      <button class="whatsapp-reset-btn" data-reset-order="${row.id}" title="אפס סטטוס">↺</button>
    </div>`;
  }
  
  return `<div class="whatsapp-confirm-container" id="confirm-container-${row.id}" data-feature="whatsapp_automation">
    <a href="${finalUrl}" target="_blank" class="whatsapp-confirm-btn" data-order-id="${row.id}"><span class="icon"><i class="fab fa-whatsapp"></i></span> שלח אישור</a>
  </div>`;
}

async function markConfirmationSent(orderId) {
  const finalId = /^\d+$/.test(orderId) ? parseInt(orderId, 10) : orderId;
  const sentConfirmations = JSON.parse(localStorage.getItem('sentConfirmations') || '{}');
  sentConfirmations[orderId] = Date.now();
  localStorage.setItem('sentConfirmations', JSON.stringify(sentConfirmations));
  
  // Update UI immediately
  const container = document.getElementById(`confirm-container-${orderId}`);
      container.innerHTML = `
        <span class="whatsapp-sent-badge">נשלח ✓</span>
        <button class="whatsapp-reset-btn" data-reset-order="${orderId}" title="אפס סטטוס">↺</button>
      `;
  
  // Update order status to 'מאושר' in database
  try {
    const { error } = await pensionNetSupabase
      .from('orders')
      .update({ status: 'מאושר' })
      .eq('id', finalId);
    
    if (error) {
      console.error('Error updating order status:', error);
    } else {
      console.log('Order status updated to מאושר for order:', finalId);
      // Reload data to update the status column in the table
      await loadData();
    }
  } catch (err) {
    console.error('Error updating order status:', err);
  }
}

async function resetConfirmationState(orderId) {
  const finalId = /^\d+$/.test(orderId) ? parseInt(orderId, 10) : orderId;
  const sentConfirmations = JSON.parse(localStorage.getItem('sentConfirmations') || '{}');
  delete sentConfirmations[orderId];
  localStorage.setItem('sentConfirmations', JSON.stringify(sentConfirmations));
  
  // Update order status back to 'ממתין' in database
  try {
    const { error } = await pensionNetSupabase
      .from('orders')
      .update({ status: 'ממתין' })
      .eq('id', finalId);
    
    if (error) {
      console.error('Error resetting order status:', error);
    } else {
      console.log('Order status reset to ממתין for order:', finalId);
    }
  } catch (err) {
    console.error('Error resetting order status:', err);
  }
  
  // Reload data to refresh the button and status
  await loadData();
}

// --- System Announcements (What's New) ---
async function checkForAnnouncements(force = false) {
    // Only show to authenticated users, not in demo mode or impersonation mode
    const impersonating = sessionStorage.getItem('pensionet_impersonate_user_id');
    if (window.isDemoMode || !window.currentUserSession || impersonating) return;
    
    try {
        // 1. Fetch latest active announcement
        const { data: announcement, error } = await pensionNetSupabase
            .from('system_announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        if (error || !announcement) {
            if (force) showToast('לא נמצאו עדכונים חדשים כעת.', 'info');
            return;
        }
        
        // 2. Check if user has seen this specific announcement
        const userId = window.currentUserSession.user.id;
        const { data: profile } = await pensionNetSupabase
            .from('profiles')
            .select('last_seen_announcement_id')
            .eq('user_id', userId)
            .maybeSingle();
            
        if (!force && profile && profile.last_seen_announcement_id === announcement.id) {
            // User already saw this one
            return;
        }
        
        // 3. Show the popup
        showAnnouncementModal(announcement);
        
    } catch (err) {
        console.warn('Announcement check failed:', err);
    }
}

function showAnnouncementModal(announcement) {
    const overlay = document.createElement('div');
    overlay.id = 'announcement-overlay';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        z-index: 20000; direction: rtl; font-family: 'Heebo', sans-serif;
        animation: fadeIn 0.4s ease;
    `;
    
    const card = document.createElement('div');
    card.style = `
        background: white; width: 90%; max-width: 500px; 
        border-radius: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        position: relative; text-align: right; overflow: hidden;
        animation: slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
    `;
    
    card.innerHTML = `
        <button id="announcementCloseX" style="
            position: absolute; top: 15px; right: 15px; 
            background: rgba(255,255,255,0.2); border: none; 
            color: white; font-size: 20px; cursor: pointer;
            width: 32px; height: 32px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s; z-index: 10;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.1)';" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)';">
            <i class="fas fa-times"></i>
        </button>
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; color: white; text-align: center;">
            <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                <i class="fas fa-rocket" style="font-size: 28px;"></i>
            </div>
            <h2 style="margin: 0; font-size: 24px; font-weight: 800;">מה חדש ב-Pension-Net?</h2>
            <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">עדכונים ושיפורים אחרונים למערכת</p>
        </div>
        <div style="padding: 30px;">
            <div style="font-size: 16px; line-height: 1.7; color: #334155; margin-bottom: 25px; max-height: 250px; overflow-y: auto; padding-left: 10px;">
                ${announcement.content}
            </div>
            
            <div style="margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                <label style="display: block; font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 8px;">יש לך הערות או הצעות לשיפור?</label>
                <textarea id="announcementFeedback" style="width: 100%; min-height: 80px; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.2s;" placeholder="נשמח לשמוע את דעתך..."></textarea>
            </div>

            <button id="closeAnnouncementBtn" style="
                width: 100%; padding: 16px; background: #6366f1; color: white;
                border: none; border-radius: 16px; font-weight: 700; font-size: 16px;
                cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                margin-top: 20px;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(99, 102, 241, 0.4)';" 
               onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(99, 102, 241, 0.3)';">
                הבנתי, תודה!
            </button>
        </div>
    `;
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Focus textarea logic
    const textarea = document.getElementById('announcementFeedback');
    textarea.onfocus = () => textarea.style.borderColor = '#6366f1';
    textarea.onblur = () => textarea.style.borderColor = '#e2e8f0';
    
    // Auto-scroll styles to head
    if (!document.getElementById('announcement-styles')) {
        const style = document.createElement('style');
        style.id = 'announcement-styles';
        style.innerHTML = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            #announcement-overlay div::-webkit-scrollbar { width: 6px; }
            #announcement-overlay div::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('announcementCloseX').onclick = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
        // Mark as seen anyway so it doesn't pop up again
        pensionNetSupabase
            .from('profiles')
            .update({ 
                last_seen_announcement_id: announcement.id,
                seen_announcement_at: new Date().toISOString()
            })
            .eq('user_id', window.currentUserSession.user.id)
            .then(({error}) => { if (error) console.warn('Seen mark failed', error); });
    };

    document.getElementById('closeAnnouncementBtn').onclick = async () => {
        const feedback = textarea.value.trim();
        const userId = window.currentUserSession.user.id;
        const userEmail = window.currentUserSession.user.email;

        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
        
        try {
            const promises = [
                // 1. Mark as seen
                pensionNetSupabase
                    .from('profiles')
                    .update({ 
                        last_seen_announcement_id: announcement.id,
                        seen_announcement_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)
            ];

            // 2. Save feedback if exists
            if (feedback) {
                promises.push(
                    pensionNetSupabase
                        .from('system_feedback')
                        .insert([{
                            user_id: userId,
                            user_email: userEmail,
                            content: feedback,
                            announcement_id: announcement.id
                        }])
                );
            }

            await Promise.all(promises);
            if (feedback && typeof showToast === 'function') {
                showToast('תודה על המשוב! ההערה נשלחה למנהל המערכת.', 'success');
            }
        } catch (e) {
            console.warn('Failed to update announcement status or save feedback:', e);
        }
    };
}
document.addEventListener('click', function(e) {
  // Handle send confirmation click
  const confirmBtn = e.target.closest('.whatsapp-confirm-btn[data-order-id]');
  if (confirmBtn) {
    const orderId = confirmBtn.getAttribute('data-order-id');
    if (orderId) {
      markConfirmationSent(orderId);
    }
  }
  
  // Handle reset button click
  const resetBtn = e.target.closest('.whatsapp-reset-btn[data-reset-order]');
  if (resetBtn) {
    e.preventDefault();
    const orderId = resetBtn.getAttribute('data-reset-order');
    if (orderId) {
      resetConfirmationState(orderId);
    }
  }
});

function assignDogTracks(orders, startDate, endDate) {
  // Filter confirmed orders that overlap with the range
  const monthOrders = orders.filter(ord => {
    if (ord.status !== 'מאושר') return false;
    const start = new Date(ord.check_in);
    start.setHours(0,0,0,0);
    const end = new Date(ord.check_out);
    end.setHours(23,59,59,999);
    return start <= endDate && end >= startDate;
  });

  // Sort by start date, then end date
  monthOrders.sort((a, b) => new Date(a.check_in) - new Date(b.check_in) || new Date(a.check_out) - new Date(b.check_out));

  const tracks = []; // Array of arrays (each sub-array is a track)
  const orderToTrack = {};

  monthOrders.forEach(ord => {
    const ordStart = new Date(ord.check_in);
    ordStart.setHours(0,0,0,0);
    const ordEnd = new Date(ord.check_out);
    ordEnd.setHours(23,59,59,999);

    let assigned = false;
    for (let i = 0; i < tracks.length; i++) {
        // Check if overlaps with any order already in this track
        const overlaps = tracks[i].some(existing => {
            const exStart = new Date(existing.check_in);
            exStart.setHours(0,0,0,0);
            const exEnd = new Date(existing.check_out);
            exEnd.setHours(23,59,59,999);
            return ordStart.getTime() <= exEnd.getTime() && ordEnd.getTime() >= exStart.getTime();
        });

        if (!overlaps) {
            tracks[i].push(ord);
            orderToTrack[ord.id] = i;
            assigned = true;
            break;
        }
    }

    if (!assigned) {
        tracks.push([ord]);
        orderToTrack[ord.id] = tracks.length - 1;
    }
  });

  return { orderToTrack, numTracks: tracks.length, monthOrders };
}

function getDogsForDay(data, date) {
  const targetDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  targetDate.setHours(0, 0, 0, 0);

  const activeDogs = data.filter((row) => {
    if (row.status !== "מאושר") return false;

    // Check-in date at midnight
    const checkIn = new Date(row.check_in);
    checkIn.setHours(0, 0, 0, 0);

    // Check-out date at end of day (so it's inclusive)
    const checkOut = new Date(row.check_out);
    checkOut.setHours(23, 59, 59, 999);

    return checkIn <= targetDate && checkOut >= targetDate;
  });

  // Grouping by dog_breed (size)
  const dogsBySize = activeDogs.reduce((acc, dog) => {
    const size =
      dog.dog_breed && dog.dog_breed.trim()
      ? dog.dog_breed.trim()
      : "לא ידוע";
    if (!acc[size]) {
      acc[size] = [];
    }
    acc[size].push(dog);
    return acc;
  }, {});

  return dogsBySize;
}

function safeParseNotes(noteStr) {
  if (!noteStr) return [];
  let cleanStr = String(noteStr);
  if (cleanStr.includes(' (DEMO_DATA)')) {
    cleanStr = cleanStr.replace(' (DEMO_DATA)', '');
  }
  try {
    const notes = JSON.parse(cleanStr);
    const parsed = Array.isArray(notes) ? notes : [];
    // Only filter out the specific system-generated marker note content
    return parsed.filter(n => n.content !== 'נתוני דמו (DEMO_DATA)');
  } catch(e) {
    if (cleanStr.includes('DEMO_DATA') || cleanStr.includes('דוגמה')) return [];
    return [{ content: cleanStr, author: 'מנהל', timestamp: new Date().toISOString() }];
  }
}

function formatOrderNotes(notes) {
  if (!notes) return '<span style="color:#999;">-</span>';
  
  const termsText = '✅ הלקוח/ה אישר/ה תנאי שימוש';
  if (notes.includes(termsText)) {
    const cleanNotes = notes.replace(termsText, '').trim();
    return `
      <div style="display: flex; flex-direction: column; gap: 5px;">
        ${cleanNotes ? `<div style="color: #1e293b; line-height: 1.4;">${cleanNotes}</div>` : ''}
        <div style="font-size: 11px; background: #f0fdf4; color: #166534; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid #bbf7d0; width: fit-content; font-weight: 600; white-space: nowrap;">
           <i class="fas fa-check-circle" style="font-size: 10px; color: #22c55e;"></i> תנאי שימוש אושרו
        </div>
      </div>
    `;
  }
  return notes;
}

window.jewishHolidaysCache = {};

async function getJewishHolidays(year, month) {
  if (localStorage.getItem('pensionNet_showHolidays') === 'false') return {};
  
  if (!year || isNaN(year) || isNaN(month)) return {};
  
  const cacheKey = `${year}-${month}`;
  if (window.jewishHolidaysCache[cacheKey]) {
    return window.jewishHolidaysCache[cacheKey];
  }

  try {
    const res = await fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&nx=on&il=on&year=${year}&month=${month+1}`);
    const data = await res.json();
    const holidays = {};
    if (data && data.items) {
      data.items.forEach(item => {
        if (item.category === 'holiday') {
          holidays[item.date] = holidays[item.date] 
            ? holidays[item.date] + ', ' + item.hebrew 
            : item.hebrew;
        }
      });
    }
    window.jewishHolidaysCache[cacheKey] = holidays;
    return holidays;
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return {};
  }
}

async function renderMonthlyCalendar(allOrders) {
  const calendarGrid = document.getElementById("monthlyCalendarGrid");
  let dateObj = window.currentCalendarDate;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    dateObj = new Date();
    window.currentCalendarDate = dateObj;
  }
  const date = dateObj;
  
  // Update Selects
  const monthSelect = document.getElementById("calendarMonth");
  const yearSelect = document.getElementById("calendarYear");
  
  if (monthSelect) monthSelect.value = date.getMonth();
  
  if (yearSelect) {
    if (yearSelect.options.length === 0) {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 2; y <= currentYear + 5; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }
    }
    yearSelect.value = date.getFullYear();
  }

  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  
  const calendarRangeStart = new Date(firstDayOfMonth);
  calendarRangeStart.setDate(calendarRangeStart.getDate() - firstDayOfMonth.getDay());
  
  const calendarRangeEnd = new Date(lastDayOfMonth);
  calendarRangeEnd.setDate(calendarRangeEnd.getDate() + (6 - lastDayOfMonth.getDay()));

  const { orderToTrack, numTracks, monthOrders } = assignDogTracks(allOrders, firstDayOfMonth, lastDayOfMonth);

  // PRE-PROCESS orders by day for O(1) lookup
  const dogsByDayMap = {};
  monthOrders.forEach(ord => {
      const startDay = ord._check_in || new Date(ord.check_in + 'T00:00:00');
      const endDay = ord._check_out || new Date(ord.check_out + 'T00:00:00');
      
      let temp = new Date(Math.max(startDay.getTime(), firstDayOfMonth.getTime()));
      const loopEnd = new Date(Math.min(endDay.getTime(), lastDayOfMonth.getTime()));
      
      while (temp <= loopEnd) {
          const dateKey = temp.getDate();
          if (!dogsByDayMap[dateKey]) dogsByDayMap[dateKey] = [];
          dogsByDayMap[dateKey].push(ord);
          temp.setDate(temp.getDate() + 1);
      }
  });

  const todayStr = new Date().toDateString();


  let calendarHTML = '<table class="calendar-table"><thead><tr>';
  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  dayNames.forEach((day) => {
    calendarHTML += `<th>${day}</th>`;
  });
  calendarHTML += "</tr></thead><tbody><tr>";

  const firstDayIndex = firstDayOfMonth.getDay();
  for (let i = 0; i < firstDayIndex; i++) {
    calendarHTML += '<td class="empty-day"></td>';
  }

  let dayCounter = 1;
  let currentDayOfWeek = firstDayIndex;
  
  const monthHolidays = await getJewishHolidays(date.getFullYear(), date.getMonth());

  while (dayCounter <= lastDayOfMonth.getDate()) {
    const currentDate = new Date(date.getFullYear(), date.getMonth(), dayCounter);
    currentDate.setHours(0,0,0,0);
    const dogsToday = dogsByDayMap[dayCounter] || [];
    const currentDateTimestamp = currentDate.toDateString();
    
    let classes = "calendar-day";
    if (currentDateTimestamp === todayStr) classes += " today";
    if (dogsToday.length > 0) classes += " busy";

    let dogsContentHTML = "";
    
    // Render tracks
    for (let i = 0; i < numTracks; i++) {
        const dogInTrack = dogsToday.find(d => orderToTrack[d.id] === i);
        if (dogInTrack) {
            const stayStart = dogInTrack._check_in || new Date(dogInTrack.check_in + 'T00:00:00');
            const stayEnd = dogInTrack._check_out || new Date(dogInTrack.check_out + 'T00:00:00');

            const isStartOfStay = stayStart.getDate() === dayCounter && stayStart.getMonth() === date.getMonth();
            const isEndOfStay = stayEnd.getDate() === dayCounter && stayEnd.getMonth() === date.getMonth();
            
            const isFirstDayOfMonth = currentDate.getDate() === 1;
            const isSunday = currentDate.getDay() === 0;
            const isSaturday = currentDate.getDay() === 6;

            const canBridgeLeft = !isEndOfStay && !isSaturday;
            const canBridgeRight = !isStartOfStay && !isSunday;

            let trackClasses = ["dog-label-unified"];
            if (canBridgeLeft) trackClasses.push("bridge-left");
            if (canBridgeRight) trackClasses.push("bridge-right");
            
            // RTL Rounding: Start (right) is rounded, End (left) is rounded.
            if (isStartOfStay) trackClasses.push("round-right");
            if (isEndOfStay) trackClasses.push("round-left");
            if (isStartOfStay && isEndOfStay) trackClasses.push("single-day");

            // Extension indicators (Cross-month logic remains same)
            const isLastDayOfMonth = (new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)).getDate() === currentDate.getDate();
            if (isLastDayOfMonth && !isEndOfStay) trackClasses.push("continues-next");
            if (isFirstDayOfMonth && !isStartOfStay) trackClasses.push("starts-prev");

            const dogName = dogInTrack.dog_name || "ללא שם";
            const ownerName = dogInTrack.owner_name ? ` (${dogInTrack.owner_name})` : "";
            
            // Show text on every day as requested
            const showText = true;

            const trackColor = getDogColor(dogInTrack.dog_name, dogInTrack.phone);

            const isFirstDayOfView = dayCounter === 1;
            const atBeginning = isStartOfStay || isFirstDayOfView;
            let dogPhotoHtml = '';
            
            if (atBeginning) {
                const dogNameEscaped = (dogInTrack.dog_name || 'כלב').replace(/'/g, "\\'");
                const openPreviewCall = `event.stopPropagation(); openImagePreview('${dogInTrack.dog_photo}', '${dogNameEscaped}', '${dogInTrack.id}', '${dogInTrack.phone}')`;
                const uploadPhotoCall = `event.stopPropagation(); triggerDogPhotoUploadFromTable('${dogInTrack.id}', '${dogNameEscaped}', '${dogInTrack.phone}')`;

                if (dogInTrack.dog_photo) {
                    dogPhotoHtml = `<img src="${dogInTrack.dog_photo}" class="calendar-dog-photo clickable-photo" alt="" onclick="${openPreviewCall}">`;
                } else {
                    dogPhotoHtml = `<div class="calendar-dog-photo-placeholder clickable-photo" onclick="${uploadPhotoCall}"><i class="fas fa-camera"></i></div>`;
                }
            }

            const dogDisplayName = atBeginning ? `${dogName}${ownerName}` : '';

            const reverseClass = currentDayOfWeek === 6 ? " reverse-tooltip" : "";
            dogsContentHTML += `
                <div class="${trackClasses.join(" ")}${reverseClass}" 
                     data-order-id="${dogInTrack.id}"
                     style="background: ${trackColor.bg} !important; border-color: ${trackColor.border} !important; color: ${trackColor.text} !important;">
                    <div class="dog-label-name">${dogPhotoHtml}${dogDisplayName}</div>
                    <div class="dog-tooltip"><div class="dog-tooltip-content">
                        <div class="dog-tooltip-item"><strong>${dogName}</strong>${ownerName}</div>
                    </div></div>
                </div>
            `;
        } else {
            dogsContentHTML += `<div class="dog-label-spacer"></div>`;
        }
    }

    const dayName = dayLabels[currentDayOfWeek];
    const pD = (n) => n < 10 ? '0'+n : n;
    const dateFormattedPart = `${date.getFullYear()}-${pD(date.getMonth() + 1)}`;
    const holidayFormattedDate = `${dateFormattedPart}-${pD(dayCounter)}`;
    const holidayHebrew = monthHolidays[holidayFormattedDate];
    
    let customEventsHTML = '';
    const currentDayTime = currentDate.getTime();
    if (window.pensionCustomEvents) {
        window.pensionCustomEvents.forEach(ev => {
           let eStart = new Date(ev.start_date); eStart.setHours(0,0,0,0);
           let eEnd = new Date(ev.end_date); eEnd.setHours(23,59,59,999);
           if (currentDayTime >= eStart.getTime() && currentDayTime <= eEnd.getTime()) {
               customEventsHTML += `<div class="holiday-label custom-evt" style="font-size: 11px; color: #fff; background: ${ev.color || '#60a5fa'}; padding: 2px 4px; border-radius: 4px; font-weight: 600; text-align: center; margin-bottom: 2px; cursor: pointer;" onclick="promptDeleteCustomEvent('${ev.id}')">${ev.title}</div>`;
           }
        });
    }

    calendarHTML += `<td class="${classes}">
          <div class="calendar-cell-header">
            <div class="day-number">${dayCounter} (${dayName})</div>
            ${holidayHebrew ? `<div class="holiday-label" style="font-size: 11px; color: #b45309; background: #fef3c7; padding: 2px 4px; border-radius: 4px; font-weight: 600; text-align: center; margin-bottom: 2px; border: 1px solid #fde68a;">${holidayHebrew}</div>` : ''}
            ${customEventsHTML}
            ${dogsToday.length > 0 ? `<div style="text-align: center; font-size: 0.85em; font-weight: bold; color: #555; margin-bottom: 4px;">${dogsToday.length} כלבים</div>` : ''}
          </div>
          <div class="day-content" style="padding: 0;">${dogsContentHTML}</div>
      </td>`;

    currentDayOfWeek++;
    if (currentDayOfWeek > 6) {
      calendarHTML += "</tr><tr>";
      currentDayOfWeek = 0;
    }
    dayCounter++;
  }

  while (currentDayOfWeek > 0 && currentDayOfWeek <= 6) {
    calendarHTML += '<td class="empty-day"></td>';
    currentDayOfWeek++;
  }

  if (calendarHTML.endsWith("<tr>")) {
    calendarHTML = calendarHTML.substring(0, calendarHTML.length - 4);
  }
  calendarHTML += "</tr></tbody></table>";

  calendarGrid.innerHTML = calendarHTML;
}

async function renderWeeklyCalendar(allOrders) {
  const calendarGrid = document.getElementById("monthlyCalendarGrid");
  let dateObj = window.currentCalendarDate;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    dateObj = new Date();
    window.currentCalendarDate = dateObj;
  }
  const date = new Date(dateObj);

  // Update Selects if present
  const monthSelect = document.getElementById("calendarMonth");
  const yearSelect = document.getElementById("calendarYear");
  
  if (monthSelect) monthSelect.value = date.getMonth();
  if (yearSelect) {
    if (yearSelect.options.length === 0) {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 2; y <= currentYear + 5; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }
    }
    yearSelect.value = date.getFullYear();
  }
  
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const { orderToTrack, numTracks, monthOrders } = assignDogTracks(allOrders, weekStart, weekEnd);

  const todayStr = new Date().toDateString();
  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  let calendarHTML = '<table class="calendar-table weekly-view"><thead><tr>';
  dayLabels.forEach((day, idx) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + idx);
    calendarHTML += `<th>${day} (${d.getDate()}/${d.getMonth() + 1})</th>`;
  });
  calendarHTML += "</tr></thead><tbody><tr>";

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        currentDate.setHours(0,0,0,0);
        
        const dayHolidays = await getJewishHolidays(currentDate.getFullYear(), currentDate.getMonth());
        const holidayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const holidayHebrew = dayHolidays[holidayKey];

        const dogsToday = monthOrders.filter(ord => {
          const start = new Date(ord.check_in + 'T00:00:00');
          const end = new Date(ord.check_out + 'T00:00:00');
          return currentDate >= start && currentDate <= end;
        });

        let classes = "calendar-day";
        if (currentDate.toDateString() === todayStr) classes += " today";
        if (dogsToday.length > 0) classes += " busy";

        let dogsContentHTML = "";
        for (let trackIdx = 0; trackIdx < numTracks; trackIdx++) {
          const dogInTrack = dogsToday.find(d => orderToTrack[d.id] === trackIdx);
          if (dogInTrack) {
            const stayStart = new Date(dogInTrack.check_in + 'T00:00:00');
            const stayEnd = new Date(dogInTrack.check_out + 'T00:00:00');

            const isStartOfStay = stayStart.getTime() === currentDate.getTime();
            const isEndOfStay = stayEnd.getTime() === currentDate.getTime();
            
            const isSunday = currentDate.getDay() === 0;
            const isSaturday = currentDate.getDay() === 6;

            const canBridgeLeft = !isEndOfStay && !isSaturday;
            const canBridgeRight = !isStartOfStay && !isSunday;

            let trackClasses = ["dog-label-unified"];
            if (canBridgeLeft) trackClasses.push("bridge-left");
            if (canBridgeRight) trackClasses.push("bridge-right");
            
            if (isStartOfStay) trackClasses.push("round-right");
            if (isEndOfStay) trackClasses.push("round-left");
            if (isStartOfStay && isEndOfStay) trackClasses.push("single-day");

            const trackColor = getDogColor(dogInTrack.dog_name, dogInTrack.phone);

            const isFirstDayOfView = i === 0;
            const atBeginning = isStartOfStay || isFirstDayOfView;
            let dogPhotoHtml = '';
            
            if (atBeginning) {
                const dogNameEscaped = (dogInTrack.dog_name || 'כלב').replace(/'/g, "\\'");
                const openPreviewCall = `event.stopPropagation(); openImagePreview('${dogInTrack.dog_photo}', '${dogNameEscaped}', '${dogInTrack.id}', '${dogInTrack.phone}')`;
                const uploadPhotoCall = `event.stopPropagation(); triggerDogPhotoUploadFromTable('${dogInTrack.id}', '${dogNameEscaped}', '${dogInTrack.phone}')`;

                if (dogInTrack.dog_photo) {
                    dogPhotoHtml = `<img src="${dogInTrack.dog_photo}" class="calendar-dog-photo clickable-photo" alt="" onclick="${openPreviewCall}">`;
                } else {
                    dogPhotoHtml = `<div class="calendar-dog-photo-placeholder clickable-photo" onclick="${uploadPhotoCall}"><i class="fas fa-camera"></i></div>`;
                }
            }

            const dogDisplayName = atBeginning ? `${dogInTrack.dog_name} (${dogInTrack.owner_name})` : '';

            const reverseClass = i === 6 ? " reverse-tooltip" : "";
            dogsContentHTML += `
              <div class="${trackClasses.join(" ")}${reverseClass}" 
                   data-order-id="${dogInTrack.id}"
                   style="background: ${trackColor.bg} !important; border-color: ${trackColor.border} !important; color: ${trackColor.text} !important; height: 32px; font-size: 11px; margin-bottom: 2px;">
                  <div class="dog-label-name" style="line-height: 24px;">${dogPhotoHtml}${dogDisplayName}</div>
              </div>
            `;
          } else {
            dogsContentHTML += `<div class="dog-label-spacer" style="height: 32px; margin-bottom: 2px; visibility: hidden;"></div>`;
          }
        }

        let customEventsHTML = '';
        if (window.pensionCustomEvents) {
            window.pensionCustomEvents.forEach(ev => {
               let eStart = new Date(ev.start_date); eStart.setHours(0,0,0,0);
               let eEnd = new Date(ev.end_date); eEnd.setHours(23,59,59,999);
               if (currentDate >= eStart && currentDate <= eEnd) {
                   customEventsHTML += `<div class="holiday-label custom-evt" style="font-size: 11px; color: #fff; background: ${ev.color || '#60a5fa'}; padding: 2px 4px; border-radius: 4px; font-weight: 600; text-align: center; margin-bottom: 2px; cursor: pointer;" onclick="promptDeleteCustomEvent('${ev.id}')">${ev.title}</div>`;
               }
            });
        }

        calendarHTML += `<td class="${classes}" style="min-height: 300px;">
              <div class="calendar-cell-header" style="height: 100px !important; margin-bottom: 10px; border-bottom: 1px dashed #f1f5f9; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
                <div class="day-number" style="font-size: 22px; margin-bottom: 4px;">${currentDate.getDate()}</div>
                ${holidayHebrew ? `<div class="holiday-label" style="font-size: 11px; color: #b45309; background: #fef3c7; padding: 2px 4px; border-radius: 4px; font-weight: 600; text-align: center; margin-bottom: 2px; border: 1px solid #fde68a;">${holidayHebrew}</div>` : ''}
                ${customEventsHTML}
                <div style="margin-top: auto; text-align: center; font-size: 0.9em; font-weight: bold; color: #555; padding-bottom: 2px;">
                  ${dogsToday.length > 0 ? `${dogsToday.length} כלבים` : ''}
                </div>
              </div>
              <div class="day-content" style="padding: 0;">${dogsContentHTML}</div>
          </td>`;
    }


  calendarHTML += "</tr></tbody></table>";
  calendarGrid.innerHTML = calendarHTML;
  
  const viewTitle = document.getElementById("viewTitle");
  if (viewTitle) {
    const options = { day: 'numeric', month: 'long' };
    viewTitle.textContent = `תצוגה שבועית: ${weekStart.toLocaleDateString('he-IL', options)} - ${weekEnd.toLocaleDateString('he-IL', options)}`;
  }
}


function renderCurrentDogsColumnView(allOrders) {
  const dogsView = document.getElementById("currentDogsColumnView");
  const title = document.getElementById("viewTitle");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dogsBySize = getDogsForDay(allOrders, today);
  const sizeOrder = { 'קטן': 1, 'בינוני': 2, 'גדול': 3 };
  const sizes = Object.keys(dogsBySize).sort((a, b) => (sizeOrder[a] || 99) - (sizeOrder[b] || 99));
  
  // Calculate total dogs count
  const totalDogsCount = Object.values(dogsBySize).flat().length;

  // Update title with count
  if (title && window.currentView === "dogs") {
    title.textContent = `כלבים בפנסיון היום (${totalDogsCount} כלבים)`;
  }

  let dogsHTML = "";

  if (sizes.length === 0) {
    dogsHTML =
      '<div style="padding: 20px; text-align: center; color: #777;">אין כלבים בפנסיון היום.</div>';
  } else {
    sizes.forEach((size) => {
      const dogs = dogsBySize[size];
      let dogEntries = dogs
        .map((d) => {
          const checkOutDate = formatDateOnly(d.check_out);
          const contactLink = createWhatsAppLink(d.phone);

          return `
              <div class="dog-entry">
                  <strong>${d.dog_name || "ללא שם"}</strong>
                  <span>בעלים: ${d.owner_name || "לא ידוע"}</span>
                  <span>יוצא ב: ${checkOutDate}</span>
                  <span>טלפון: ${contactLink}</span>
              </div>
          `;
        })
        .join("");

      dogsHTML += `
          <div class="dog-column">
              <h4>${size} (${dogs.length} כלבים)</h4>
              <div>${dogEntries}</div>
          </div>
      `;
    });
  }

  dogsView.innerHTML = dogsHTML;
}

function changeMonth(delta) {
  if (window.currentView === "calendar") {
    window.currentCalendarDate.setMonth(
      window.currentCalendarDate.getMonth() + delta
    );
  } else if (window.currentView === "weekly") {
    window.currentCalendarDate.setDate(
      window.currentCalendarDate.getDate() + (delta * 7)
    );
  } else {
    // Navigate by day for 'dogs' view? Usually better to just skip
    return;
  }

  if (window.allOrdersCache.length > 0) {
    if (window.currentView === "weekly") {
      renderWeeklyCalendar(window.allOrdersCache);
    } else {
      renderMonthlyCalendar(window.allOrdersCache);
    }
  } else {
    loadData();
  }
}

function jumpToDate() {
    const monthSelect = document.getElementById("calendarMonth");
    const yearSelect = document.getElementById("calendarYear");
    if (!monthSelect || !yearSelect) return;
    
    const monthVal = monthSelect.value;
    const yearVal = yearSelect.value;
    
    if (!monthVal || !yearVal) return;
    
    const month = parseInt(monthVal);
    const year = parseInt(yearVal);
    
    if (isNaN(month) || isNaN(year)) return;
    
    window.currentCalendarDate = new Date(year, month, 1);
    
    if (window.allOrdersCache.length > 0) {
        if (window.currentView === "weekly") {
            renderWeeklyCalendar(window.allOrdersCache);
        } else {
            renderMonthlyCalendar(window.allOrdersCache);
        }
    } else {
        loadData();
    }
}

function toggleCalendarCollapse(button) {
  const viewContent = document.getElementById("calendarViewContent");

  if (window.currentView === "dogs") return;

  const isCollapsed = viewContent.classList.toggle("collapsed");

  if (isCollapsed) {
    button.innerHTML = 'פתח <i class="fas fa-chevron-down"></i>';
  } else {
    button.innerHTML = 'כווץ <i class="fas fa-chevron-up"></i>';
  }
}

function switchCalendarView(newView) {
  const calendarContent = document.getElementById("calendarViewContent");
  const monthlyGrid = document.getElementById("monthlyCalendarGrid");
  const dogsView = document.getElementById("currentDogsColumnView");
  const title = document.getElementById("viewTitle");
  const collapseBtn = document.getElementById("toggleCalendarCollapseBtn");
  const monthHeader = document.getElementById("calendarHeader");

  // Reset all buttons
  document.querySelectorAll('.view-switch-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`viewBtn-${newView}`);
  if (activeBtn) activeBtn.classList.add('active');

  window.currentView = newView;
  localStorage.setItem('pensionet_calendar_view', newView);

  // Defaults
  calendarContent.style.display = "block";
  dogsView.style.display = "none";
  collapseBtn.style.display = "block";
  monthHeader.style.display = "block";

  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");

  if (newView === "calendar") {
    title.textContent = "לוח זמנים חודשי (נוכחות כלבים)";
    if (prevBtn) prevBtn.innerHTML = "&lt; חודש קודם";
    if (nextBtn) nextBtn.innerHTML = "חודש הבא &gt;";
    renderMonthlyCalendar(window.allOrdersCache);
  } else if (newView === "weekly") {
    if (prevBtn) prevBtn.innerHTML = "&lt; שבוע קודם";
    if (nextBtn) nextBtn.innerHTML = "שבוע הבא &gt;";
    renderWeeklyCalendar(window.allOrdersCache);
  } else if (newView === "dogs") {
    calendarContent.style.display = "none";
    dogsView.style.display = "flex";
    collapseBtn.style.display = "none";
    renderCurrentDogsColumnView(window.allOrdersCache);
  }
}

// Keep old function for compatibility during transition
window.toggleCalendarView = function(btn) {
    if (window.currentView === "calendar") switchCalendarView("dogs");
    else switchCalendarView("calendar");
};

function updatePriceWithButtons(input, delta) {
  const currentValue = parseInt(input.value) || 0;
  const newValue = Math.max(0, currentValue + delta);
  input.value = newValue;

  const row = input.closest("tr");
  const daysInput = row.querySelector(".days-input");
  const tooltip = row.querySelector(".tooltip");

  if (daysInput) {
    const days = parseInt(daysInput.value) || 0;
    const total = newValue * days;
    if (tooltip) tooltip.textContent = `עלות שהייה: ${formatNumber(total)}₪`;
    const totalLabel = row.querySelector(".total-price-display");
    if (totalLabel) totalLabel.textContent = `סה"כ: ${formatNumber(total)}₪`;
  }
}

function updateDaysWithButtons(input, delta) {
  const currentValue = parseInt(input.value) || 1;
  const newValue = Math.max(1, currentValue + delta);
  input.value = newValue;

  const row = input.closest("tr");
  updateCheckOutFromDays(row);
  
  const priceInput = row.querySelector(".price-input");
  const tooltip = row.querySelector(".tooltip");

  if (priceInput) {
    const price = parseInt(priceInput.value) || 0;
    const total = newValue * price;
    if (tooltip) tooltip.textContent = `עלות שהייה: ${formatNumber(total)}₪`;
    const totalLabel = row.querySelector(".total-price-display");
    if (totalLabel) totalLabel.textContent = `סה"כ: ${formatNumber(total)}₪`;
  }
}

function filterPastOrdersData() {
  if (!window.pastOrdersRawData) return [];
  const term = (window.pastOrdersSearchTerm || "").trim();
  if (!term) return window.pastOrdersRawData.slice();
  const lowerTerm = term.toLowerCase();
  return window.pastOrdersRawData.filter((row) =>
    Object.values(row).some((val) =>
      (val + "").toLowerCase().includes(lowerTerm)
    )
  );
}

function renderPastOrdersTable() {
  const tbody = document.querySelector("#pastOrdersTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const filtered = filterPastOrdersData();
  const totalRows = filtered.length;
  const maxPage = Math.max(
    1,
    Math.ceil(totalRows / HISTORY_ROWS_PER_PAGE)
  );

  if (window.pastOrdersCurrentPage > maxPage)
    window.pastOrdersCurrentPage = maxPage;
  if (window.pastOrdersCurrentPage < 1) window.pastOrdersCurrentPage = 1;

  const startIdx =
    (window.pastOrdersCurrentPage - 1) * HISTORY_ROWS_PER_PAGE;
  const pageRows = filtered.slice(
    startIdx,
    startIdx + HISTORY_ROWS_PER_PAGE
  );

  pageRows.forEach((row) => {
    let tr = document.createElement("tr");
    const days = calculateDays(row.check_in, row.check_out);
    const pricePerDay = row.price_per_day || 130;
    const totalPrice = days * pricePerDay;

    // Calculate permissions
    const activeStaffName = document.getElementById('activeStaffSelect')?.value;
    const activeStaff = window.currentStaffMembers.find(s => (typeof s === 'string' ? s : s.name) === activeStaffName);
    const perms = (activeStaff && typeof activeStaff === 'object') ? activeStaff.permissions : { edit_details: false, edit_status: false };
    
    const detailsDisabled = (!window.isAdminMode && !perms.edit_details) ? "disabled" : "";
    const statusDisabled = (!window.isAdminMode && !perms.edit_status && !perms.edit_details) ? "disabled" : "";

    tr.innerHTML = `
    <td data-label="תאריך הזמנה">${formatDateTime(row.order_date || row.created_at)}</td>
    <td data-label="בעלים">${row.owner_name}</td>
    <td data-label="טלפון">${createWhatsAppLink(row.phone)}</td>
    <td data-label="אישור" data-feature="whatsapp_automation">${generateWhatsAppConfirmationLink(row)}</td>
    <td data-label="כניסה" class="wide-date-column">
      <input type="text" class="date-input" ${detailsDisabled} data-id="${
        row.id
      }" data-field="check_in" value="${formatDateForInput(
      row.check_in
    )}" readonly />
    <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
      row.check_in
    )}</div>
    </td>
    <td data-label="יציאה" class="wide-date-column">
      <input type="text" class="date-input" ${detailsDisabled} data-id="${
        row.id
      }" data-field="check_out" value="${formatDateForInput(
      row.check_out
    )}" readonly />
    <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
      row.check_out
    )}</div>
    </td>
    <td data-label="כלב">
      <div style="display: flex; align-items: center; gap: 10px;">
        ${row.dog_photo ? `
          <img src="${row.dog_photo}" class="dog-thumbnail" onclick="openImagePreview('${row.dog_photo}', '${(row.dog_name || 'כלב').replace(/'/g, "\\'")}', '${row.id}', '${row.phone}')" />
        ` : `
          <div class="dog-thumbnail-placeholder" title="${window.isDemoMode ? '' : 'לחצו להעלאת תמונה'}" ${window.isDemoMode ? '' : `onclick="triggerDogPhotoUploadFromTable('${row.id}', '${(row.dog_name || 'כלב').replace(/'/g, "\\'")}', '${row.phone}')"`}>
            <i class="fas fa-camera" ${window.isDemoMode ? 'style="opacity: 0.3; cursor: default;"' : ''}></i>
          </div>
        `}
        <span style="font-weight: 600;">${row.dog_name || ""}</span>
      </div>
    </td>
    <td data-label="גיל">${row.dog_age}</td>
    <td data-label="גודל">${row.dog_breed}</td>
    <td data-label="סירס/עיקור">
      ${row.neutered || ""}
      ${row.neutered ? `
        <div style="font-size: 11px; color: #3b82f6; margin-top: 2px; font-weight: 500;">
          ${(row.neutered.includes('מסורס') ? 'זכר' : (row.neutered.includes('מעוקרת') ? 'נקבה' : ''))}
        </div>
      ` : ''}
    </td>
    <td data-label="הערות" style="text-align: right; padding: 12px; line-height: 1.6; max-width: 250px; white-space: normal;">
      ${formatOrderNotes(row.notes)}
    </td>
    <td data-label="מחיר" class="price-cell" style="vertical-align: top;">
      <div class="price-wrapper">
        <div class="price-controls" ${detailsDisabled ? 'style="opacity:0.3;pointer-events:none;"' : ''}>
          <button class="price-btn" ${detailsDisabled} onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), 10)">▲</button>
          <button class="price-btn" ${detailsDisabled} onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), -10)">▼</button>
        </div>
        <div class="price-input-container">
          <input type="number" class="price-input" ${detailsDisabled} data-id="${
            row.id
          }" value="${pricePerDay}" min="0" step="10" />
        </div>
      </div>
      <div class="total-price-display" style="font-size: 11px; color: #666; margin-top: 4px; font-weight: 500;">סה"כ: ${formatNumber(totalPrice)}₪</div>
      <div class="tooltip">עלות שהייה: ${formatNumber(totalPrice)}₪</div>
    </td>
    <td data-label="ימים" style="vertical-align: top;">
      <div class="days-wrapper">
        <div class="days-controls" ${detailsDisabled ? 'style="opacity:0.3;pointer-events:none;"' : ''}>
          <button class="price-btn" ${detailsDisabled} onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), 1)">▲</button>
          <button class="price-btn" ${detailsDisabled} onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), -1)">▼</button>
        </div>
        <div class="days-input-container">
          <input type="number" class="days-input" ${detailsDisabled} data-id="${
            row.id
          }" data-checkin="${
          row.check_in
        }" value="${days}" min="1" max="365" />
        </div>
      </div>
    </td>
    <td data-label="סטטוס">
      <select data-id="${row.id}" ${statusDisabled} class="status-select ${
        row.status === "מאושר"
          ? "status-approved"
          : row.status === "בוטל"
          ? "status-cancelled"
          : ""
      }">
        <option value="ממתין" ${
          row.status === "ממתין" ? "selected" : ""
        }>ממתין</option>
        <option value="מאושר" ${
          row.status === "מאושר" ? "selected" : ""
        }>מאושר</option>
        <option value="בוטל" ${
          row.status === "בוטל" ? "selected" : ""
        }>בוטל</option>
      </select>
    </td>
    <td data-label="ניהול" class="manager-note-column">
      <button type="button" class="view-notes-btn" onclick="openNotesModal('${row.id}', '${row.dog_name.replace(/'/g, "\\'")}', '${row.owner_name.replace(/'/g, "\\'")}')">
         <i class="fas fa-comments"></i> הערות (${safeParseNotes(row.admin_note).length})
      </button>
    </td>
  `;
    tbody.appendChild(tr);
  });
  
  initFlatpickr();
  renderPastOrdersPagination(
    totalRows,
    window.pastOrdersCurrentPage,
    maxPage
  );



  document
    .querySelectorAll(
      "#pastOrdersTable .price-input, #pastOrdersTable .days-input"
    )
    .forEach((input) => {
      input.addEventListener("input", function () {
        const row = this.closest("tr");
        if (this.classList.contains("days-input")) {
          updateCheckOutFromDays(row);
        }
        const priceInput = row.querySelector(".price-input");
        const daysInput = row.querySelector(".days-input");
        const priceCell = row.querySelector(".price-cell");
        const tooltip = priceCell ? priceCell.querySelector(".tooltip") : null;
        const totalLabel = row.querySelector(".total-price-display");

        const price = parseInt(priceInput.value) || 0;
        const days = parseInt(daysInput.value) || 0;
        const total = price * days;

        const text = `עלות שהייה: ${formatNumber(total)}₪`;
        if (tooltip) tooltip.textContent = text;
        if (totalLabel) totalLabel.textContent = `סה"כ: ${formatNumber(total)}₪`;
      });
    });

    // Handle status color classes
    document.querySelectorAll('#pastOrdersTable .status-select').forEach(select => {
      select.addEventListener('change', function() {
        this.classList.remove('status-approved', 'status-cancelled');
        if (this.value === 'מאושר') this.classList.add('status-approved');
        if (this.value === 'בוטל') this.classList.add('status-cancelled');
      });
    });

    if (typeof Features !== 'undefined') Features.syncUI();
}

function renderPastOrdersPagination(totalRows, currentPage, maxPage) {
  const pagDiv = document.getElementById("historyPagination");
  if (!pagDiv) return;
  pagDiv.innerHTML = "";
  if (maxPage <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "הקודם";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = function () {
    window.pastOrdersCurrentPage = Math.max(
      1,
      window.pastOrdersCurrentPage - 1
    );
    renderPastOrdersTable();
  };

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "הבא";
  nextBtn.disabled = currentPage === maxPage;
  nextBtn.onclick = function () {
    window.pastOrdersCurrentPage = Math.min(
      maxPage,
      window.pastOrdersCurrentPage + 1
    );
    renderPastOrdersTable();
  };

  const infoSpan = document.createElement("span");
  infoSpan.textContent = `עמוד ${currentPage} מתוך ${maxPage}`;

  pagDiv.appendChild(prevBtn);
  pagDiv.appendChild(infoSpan);
  pagDiv.appendChild(nextBtn);
}

const searchInput = document.getElementById("historySearchInput");
if (searchInput) {
  const debouncedSearch = debounce(() => {
    window.pastOrdersSearchTerm = searchInput.value;
    window.pastOrdersCurrentPage = 1;
    renderPastOrdersTable();
  }, 300);
  searchInput.addEventListener("input", debouncedSearch);
}

// --- לוגיקת סטטיסטיקת תנועות (נכנסים/יוצאים) ---
function getMovementStorageKey(type) {
  const today = new Date().toISOString().split('T')[0];
  return `movement_${type}_${today}`;
}

// Expose to global scope for onclick handlers
window.toggleMovementChecked = toggleMovementChecked;

async function toggleMovementChecked(type, orderId) {
  // Find current state from cache
  const order = window.allOrdersCache.find(o => o.id === parseInt(orderId) || o.id === orderId);
  if (!order) return;

  const field = type === 'entering' ? 'is_arrived' : 'is_departed';
  const currentState = !!order[field];
  const newState = !currentState;

  // Optimistic UI Update
  const btn = document.getElementById(`movement-${type}-${orderId}`);
  const row = btn?.closest('.movement-row');
  
  if (btn && row) {
      btn.textContent = 'מעדכן...';
      btn.style.opacity = '0.7';
  }

  const updateData = { [field]: newState };
  
  // Custom request: If marking as departed, also mark as paid
  if (type === 'leaving' && newState === true && !order.is_paid) {
    updateData.is_paid = true;
    if (!order.amount_paid) {
      const days = calculateDays(order.check_in, order.check_out);
      updateData.amount_paid = days * (order.price_per_day || 130);
    }
    if (!order.payment_method) {
      updateData.payment_method = 'מזומן';
    }
  }

  try {
    const { error } = await pensionNetSupabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) throw error;

    // Update local cache
    order[field] = newState;
    if (updateData.is_paid) {
      order.is_paid = true;
      if (updateData.amount_paid) order.amount_paid = updateData.amount_paid;
      if (updateData.payment_method) order.payment_method = updateData.payment_method;
    }

    // Re-render UI to reflect final state
    if (btn && row) {
        const isNowChecked = newState;
        row.classList.toggle('completed', isNowChecked);
        btn.classList.toggle('checked', isNowChecked);
        
        const actionText = type === 'entering' ? 'נכנס' : 'יצא';
        btn.textContent = isNowChecked ? `${actionText} ✓` : `סמן ש${actionText}`;
        btn.style.opacity = '1';

        let auditDesc = isNowChecked ? 
            `סימון ${actionText} עבור ${order.dog_name} (${order.owner_name})` : 
            `ביטול סימון ${actionText} עבור ${order.dog_name} (${order.owner_name})`;
            
        createAuditLog('UPDATE', auditDesc, orderId);
    }

  } catch (err) {
    console.error('Error updating movement:', err);
    showToast('שגיאה בעדכון הסטטוס. אנא נסה שוב.', 'error');
    // Revert UI if needed (simple reload or re-render)
    loadData(); 
  }
}

function renderMovementStats(data) {
  const enteringCountEl = document.getElementById("dogsEnteringCount");
  const enteringListEl = document.getElementById("dogsEnteringList");
  const leavingCountEl = document.getElementById("dogsLeavingCount");
  const leavingListEl = document.getElementById("dogsLeavingList");
  
  if (!enteringCountEl || !leavingCountEl) return;

  const today = new Date();
  
  // Helper to check if two dates are the same calendar day
  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Entering Today
  const enteringDogs = data.filter(row => {
    if (row.status !== "מאושר") return false;
    const checkIn = new Date(row.check_in);
    return isSameDay(checkIn, today);
  });

  // Leaving Today
  const leavingDogs = data.filter(row => {
     if (row.status !== "מאושר") return false;
     const checkOut = new Date(row.check_out);
     return isSameDay(checkOut, today);
  });

  // Render Entering
  enteringCountEl.textContent = enteringDogs.length;
  if (enteringDogs.length === 0) {
    enteringListEl.innerHTML = '<span style="color: #999;">אין כניסות היום</span>';
  } else {
    enteringListEl.innerHTML = enteringDogs.map(d => {
      const isChecked = !!d.is_arrived;
      const btnText = isChecked ? 'נכנס ✓' : 'סמן שנכנס';
      
      return `<div class="movement-row${isChecked ? ' completed' : ''}" style="padding: 6px 0; border-bottom: 1px solid #efefef; display: flex; align-items: center; gap: 8px;">
         <button class="movement-action-btn${isChecked ? ' checked' : ''}" id="movement-entering-${d.id}">${btnText}</button>
         <div style="flex: 1;">
           <div style="font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d.dog_name || 'כלב'} <span style="font-weight: normal; font-size: 0.9em;">(${d.owner_name || '?'})</span></div>
           <div style="font-size: 13px;">${createWhatsAppLink(d.phone)}</div>

         </div>
       </div>`;
    }).join('');
  }

  // Render Leaving
  leavingCountEl.textContent = leavingDogs.length;
  if (leavingDogs.length === 0) {
    leavingListEl.innerHTML = '<span style="color: #999;">אין יציאות היום</span>';
  } else {
    leavingListEl.innerHTML = leavingDogs.map(d => {
      const days = calculateDays(d.check_in, d.check_out);
      const ppd = d.price_per_day || 130;
      const total = days * ppd;
      const isChecked = !!d.is_departed;
      const btnText = isChecked ? 'יצא ✓' : 'סמן שיצא';
      
      return `<div class="movement-row${isChecked ? ' completed' : ''}" style="padding: 6px 0; border-bottom: 1px solid #efefef; display: flex; align-items: center; gap: 8px;">
         <button class="movement-action-btn${isChecked ? ' checked' : ''}" id="movement-leaving-${d.id}">${btnText}</button>
         <div style="flex: 1;">
           <div style="font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d.dog_name || 'כלב'} <span style="font-weight: normal; font-size: 0.9em;">(${d.owner_name || '?'})</span></div>
           <div style="font-size: 13px;">${createWhatsAppLink(d.phone)}</div>

         </div>
       </div>`;
    }).join('');
  }
}

async function loadData() {
  if (window.isDemoMode) {
    console.log('📦 Loading mock demo data...');
    const demoData = generateLocalDemoData(); 
    window.allOrdersCache = demoData;
    
    // Call the correct rendering functions
    renderCurrentDogsColumnView(demoData);
    renderMovementStats(demoData);
    renderFutureOrdersTable();
    
    // Set past orders for history tab
    const now = new Date();
    window.pastOrdersRawData = demoData.filter(row => new Date(row.check_out) < now);
    renderPastOrdersTable();
    
    // Process clients for clients tab
    processClientsData();
    
    if (window.currentView === "calendar") {
      renderMonthlyCalendar(demoData);
    } else if (window.currentView === "weekly") {
      renderWeeklyCalendar(demoData);
    } else {
      renderCurrentDogsColumnView(demoData);
    }
    
    // Enforce read-only UI
    document.body.classList.add('demo-read-only');
    return;
  }
  const session = window.currentUserSession || await Auth.getSession();
  if (!session) return;

  try {
    const { data, error } = await pensionNetSupabase
      .from("orders")
      .select("id, dog_name, owner_name, check_in, check_out, status, created_at, phone, price_per_day, is_arrived, is_departed, admin_note, dog_photo, dog_breed, dog_age, neutered")
      .eq("user_id", session.user.id) // חיפוש רק של המשתמש הנוכחי
      .order("check_out", { ascending: true });

    if (error) throw error;

    console.log("Data loaded:", data.length, "rows");

    // --- Retroactive Dog Photo Propagation ---
    const dogPhotoMap = new Map();
    // Build a map of the latest photo for each unique dog (phone + name)
    // Since data is ordered by check_out ASC, later orders will overwrite earlier ones in the map
    data.forEach(order => {
      if (order.dog_photo && order.dog_name && order.phone) {
        const dogKey = `${order.phone.replace(/[\s\-]/g, "")}_${order.dog_name.trim().toLowerCase()}`;
        dogPhotoMap.set(dogKey, order.dog_photo);
      }
    });

    window.allOrdersCache = data.map(o => {
      const dogKey = `${o.phone?.replace(/[\s\-]/g, "")}_${o.dog_name?.trim().toLowerCase()}`;
      const latestPhoto = dogPhotoMap.get(dogKey);
      
      return {
        ...o,
        dog_photo: o.dog_photo || latestPhoto,
        _check_in: new Date(o.check_in + 'T00:00:00'),
        _check_out: new Date(o.check_out + 'T00:00:00')
      };
    });

    if (window.currentView === "calendar") {
      renderMonthlyCalendar(window.allOrdersCache);
    } else if (window.currentView === "weekly") {
      renderWeeklyCalendar(window.allOrdersCache);
    } else {
      renderCurrentDogsColumnView(window.allOrdersCache);
    }
    renderMovementStats(window.allOrdersCache);

    if (data.length > 0) {
      console.log("Sample data:", {
        notes: data[0].notes,
      });
    }

    const now = new Date();
    renderFutureOrdersTable();
    
    window.pastOrdersRawData = window.allOrdersCache.filter((row) => {
      const checkOut = new Date(row.check_out);
      return checkOut < now;
    });
    renderPastOrdersTable();
    processClientsData();

    document
      .querySelectorAll("textarea.admin-note")
      .forEach((textarea) => {
        const adjustWidth = () => {
          textarea.style.width = "80ch";
          textarea.style.height = "auto";
          textarea.style.height = textarea.scrollHeight + "px";
        };
        adjustWidth();
        textarea.addEventListener("input", adjustWidth);
      });
  } catch (error) {
    console.error("Error loading data:", error);
    showToast("שגיאה בטעינת הנתונים", 'error');
  }
}

function filterFutureOrdersData() {
  if (!window.allOrdersCache) return [];
  const now = new Date();
  let data = window.allOrdersCache.filter(row => new Date(row.check_out) >= now);

  const searchTerm = document.getElementById('futureSearchInput')?.value.toLowerCase();
  const statusFilter = document.getElementById('futureStatusFilter')?.value;
  const sortVal = document.getElementById('futureSortSelect')?.value;

  if (searchTerm) {
    data = data.filter(row => 
      (row.owner_name?.toLowerCase().includes(searchTerm)) ||
      (row.dog_name?.toLowerCase().includes(searchTerm)) ||
      (row.phone?.includes(searchTerm))
    );
  }

  if (statusFilter && statusFilter !== 'all') {
    data = data.filter(row => row.status === statusFilter);
  }

  if (sortVal) {
    switch(sortVal) {
      case 'check_in_asc':
        data.sort((a,b) => new Date(a.check_in) - new Date(b.check_in));
        break;
      case 'check_in_desc':
        data.sort((a,b) => new Date(b.check_in) - new Date(a.check_in));
        break;
      case 'order_date_desc':
        data.sort((a,b) => new Date(b.order_date || b.created_at) - new Date(a.order_date || a.created_at));
        break;
      case 'dog_name':
        data.sort((a,b) => (a.dog_name || '').localeCompare(b.dog_name || '', 'he'));
        break;
    }
  } else {
      // Default: Approved first, then by date
      const activeOrders = data.filter(o => o.status === "מאושר");
      const others = data.filter(o => o.status !== "מאושר");
      data = [...activeOrders, ...others];
  }

  return data;
}

function renderFutureOrdersTable() {
  const futureTbody = document.querySelector("#futureOrdersTable tbody");
  if (!futureTbody) return;

  const data = filterFutureOrdersData();
  futureTbody.innerHTML = "";

  data.forEach((row) => {
      // --- ניקוי הערות כפולות אם נשארו ---
      let notes = row.notes ? row.notes.trim() : "";

      row.notes = notes;

      let tr = document.createElement("tr");
      const days = calculateDays(row.check_in, row.check_out);
      const pricePerDay = row.price_per_day || 130;
      const totalPrice = days * pricePerDay;

      // Calculate permissions
      const activeStaffName = document.getElementById('activeStaffSelect')?.value;
      const activeStaff = window.currentStaffMembers.find(s => (typeof s === 'string' ? s : s.name) === activeStaffName);
      const perms = (activeStaff && typeof activeStaff === 'object') ? activeStaff.permissions : { edit_details: false, edit_status: false };
      
      const detailsDisabled = (!window.isAdminMode && !perms.edit_details) ? "disabled" : "";
      const statusDisabled = (!window.isAdminMode && !perms.edit_status && !perms.edit_details) ? "disabled" : "";

      tr.innerHTML = `
      <td data-label="תאריך הזמנה">${formatDateTime(row.order_date || row.created_at)}</td>
      <td data-label="בעלים">${row.owner_name || ""}</td>
      <td data-label="טלפון">${createWhatsAppLink(row.phone)}</td>
      <td data-label="אישור" data-feature="whatsapp_automation">${generateWhatsAppConfirmationLink(row)}</td>
      <td data-label="כניסה" class="wide-date-column">
        <input type="text" class="date-input" ${detailsDisabled} data-id="${
          row.id
        }" data-field="check_in" value="${formatDateForInput(
        row.check_in
      )}" readonly />
      <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
        row.check_in
      )}</div>
      </td>
      <td data-label="יציאה" class="wide-date-column">
        <input type="text" class="date-input" ${detailsDisabled} data-id="${
          row.id
        }" data-field="check_out" value="${formatDateForInput(
        row.check_out
      )}" readonly />
      <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
        row.check_out
      )}</div>
      </td>
      <td data-label="כלב">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${row.dog_photo ? `
            <img src="${row.dog_photo}" class="dog-thumbnail" onclick="openImagePreview('${row.dog_photo}', '${(row.dog_name || 'כלב').replace(/'/g, "\\'")}', '${row.id}', '${row.phone}')" />
          ` : `
            <div class="dog-thumbnail-placeholder" title="${window.isDemoMode ? '' : 'לחצו להעלאת תמונה'}" ${window.isDemoMode ? '' : `onclick="triggerDogPhotoUploadFromTable('${row.id}', '${(row.dog_name || 'כלב').replace(/'/g, "\\'")}', '${row.phone}')"`}>
              <i class="fas fa-camera" ${window.isDemoMode ? 'style="opacity: 0.3; cursor: default;"' : ''}></i>
            </div>
          `}
          <span style="font-weight: 600;">${row.dog_name || ""}</span>
        </div>
      </td>
      <td data-label="גיל">${row.dog_age || ""}</td>
      <td data-label="גודל">${row.dog_breed || ""}</td>
      <td data-label="סירס/עיקור">
        ${row.neutered || ""}
        ${row.neutered ? `
          <div style="font-size: 11px; color: #3b82f6; margin-top: 2px; font-weight: 500;">
            ${(row.neutered.includes('מסורס') ? 'זכר' : (row.neutered.includes('מעוקרת') ? 'נקבה' : ''))}
          </div>
        ` : ''}
      </td>
      <td data-label="הערות" style="text-align: right; padding: 12px; line-height: 1.6; max-width: 250px; white-space: normal;">
        ${formatOrderNotes(row.notes)}
      </td>
      <td data-label="מחיר" class="price-cell" style="vertical-align: top;">
        <div class="price-wrapper">
          <div class="price-controls" ${detailsDisabled ? 'style="opacity:0.3;pointer-events:none;"' : ''}>
            <button class="price-btn" ${detailsDisabled} onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), 10)">▲</button>
            <button class="price-btn" ${detailsDisabled} onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), -10)">▼</button>
          </div>
          <div class="price-input-container">
            <input type="number" class="price-input" ${detailsDisabled} data-id="${
              row.id
            }" value="${pricePerDay}" min="0" step="10" />
          </div>
        </div>
        <div class="total-price-display" style="font-size: 11px; color: #666; margin-top: 4px; font-weight: 500;">סה"כ: ${formatNumber(totalPrice)}₪</div>
        <div class="tooltip">עלות שהייה: ${formatNumber(totalPrice)}₪</div>
      </td>
      <td data-label="ימים" style="vertical-align: top;">
        <div class="days-wrapper">
          <div class="days-controls" ${detailsDisabled ? 'style="opacity:0.3;pointer-events:none;"' : ''}>
            <button class="price-btn" ${detailsDisabled} onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), 1)">▲</button>
            <button class="price-btn" ${detailsDisabled} onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), -1)">▼</button>
          </div>
          <div class="days-input-container">
            <input type="number" class="days-input" ${detailsDisabled} data-id="${
              row.id
            }" data-checkin="${
            row.check_in
          }" value="${days}" min="1" max="365" />
          </div>
        </div>
      </td>
      <td data-label="סטטוס">
        <select data-id="${row.id}" ${statusDisabled} class="status-select ${
        row.status === "מאושר"
          ? "status-approved"
          : row.status === "בוטל"
          ? "status-cancelled"
          : ""
      }">
          <option value="ממתין" ${
            row.status === "ממתין" ? "selected" : ""
          }>ממתין</option>
          <option value="מאושר" ${
            row.status === "מאושר" ? "selected" : ""
          }>מאושר</option>
          <option value="בוטל" ${
            row.status === "בוטל" ? "selected" : ""
          }>בוטל</option>
        </select>
      </td>
      <td data-label="ניהול" class="manager-note-column">
        <button type="button" class="view-notes-btn" onclick="openNotesModal('${row.id}', '${row.dog_name.replace(/'/g, "\\'")}', '${row.owner_name.replace(/'/g, "\\'")}')">
          <i class="fas fa-comments"></i> הערות (${safeParseNotes(row.admin_note).length})
      </button>
      </td>
    `;
      futureTbody.appendChild(tr);
    });

    document
      .querySelectorAll(
        "#futureOrdersTable .price-input, #futureOrdersTable .days-input"
      )
      .forEach((input) => {
        input.addEventListener("input", function () {
          const row = this.closest("tr");
          if (this.classList.contains("days-input")) {
            updateCheckOutFromDays(row);
          }
          const priceInput = row.querySelector(".price-input");
          const daysInput = row.querySelector(".days-input");
          const priceCell = row.querySelector(".price-cell");
          const tooltip = priceCell ? priceCell.querySelector(".tooltip") : null;
          const totalLabel = row.querySelector(".total-price-display");

          const price = parseInt(priceInput.value) || 0;
          const days = parseInt(daysInput.value) || 0;
          const total = price * days;

          const text = `עלות שהייה: ${formatNumber(total)}₪`;
          if (tooltip) tooltip.textContent = text;
          if (totalLabel) totalLabel.textContent = `סה"כ: ${formatNumber(total)}₪`;
        });
      });

    // Handle status change to 'בוטל' - prompt for reason
    document.querySelectorAll('#futureOrdersTable .status-select').forEach(select => {
      select.addEventListener('change', async function() {
        if (this.value === 'בוטל') {
          const orderId = this.dataset.id;
          const dogName = this.closest('tr').querySelector('td[data-label="כלב"]')?.textContent || 'הכלב';
          
          const reason = prompt(`מהי סיבת הביטול עבור ${dogName}?`);
          if (reason) {
            try {
              // Replace ALL notes with ONLY the cancellation reason for cancelled orders
              const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
              if (order) {
                const activeStaffName = document.getElementById('activeStaffSelect')?.value || 'מנהל';
                let notes = [{
                  content: `סיבת ביטול: ${reason}`,
                  author: activeStaffName === 'צוות' ? 'מנהל' : activeStaffName,
                  timestamp: new Date().toISOString()
                }];
                
                // Update in Supabase immediately for notes
                const { error } = await pensionNetSupabase
                  .from('orders')
                  .update({ admin_note: JSON.stringify(notes) + (order.admin_note?.includes('(DEMO_DATA)') ? ' (DEMO_DATA)' : '') })
                  .eq('id', orderId);

                if (!error) {
                  order.admin_note = JSON.stringify(notes) + (order.admin_note?.includes('(DEMO_DATA)') ? ' (DEMO_DATA)' : '');
                  showToast('סיבת הביטול נשמרה בהערות', 'success');
                  // Update the note count in the button
                  const noteBtn = this.closest('tr').querySelector('.view-notes-btn');
                  if (noteBtn) noteBtn.innerHTML = `<i class="fas fa-comments"></i> הערות (${notes.length})`;
                }
              }
            } catch (err) {
              console.error('Error adding cancellation reason:', err);
            }
          }
        }
      });
    });
    // Handle status color classes
    document.querySelectorAll('#futureOrdersTable .status-select').forEach(select => {
      select.addEventListener('change', function() {
        this.classList.remove('status-approved', 'status-cancelled');
        if (this.value === 'מאושר') this.classList.add('status-approved');
        if (this.value === 'בוטל') this.classList.add('status-cancelled');
      });
    });

    initFlatpickr();
    if (typeof Features !== 'undefined') Features.syncUI();
}

// Event Listeners for Future Orders Filtering
document.getElementById('futureSearchInput')?.addEventListener('input', debounce(() => {
  renderFutureOrdersTable();
}, 300));

document.getElementById('futureStatusFilter')?.addEventListener('change', () => {
  renderFutureOrdersTable();
});

document.getElementById('futureSortSelect')?.addEventListener('change', () => {
  renderFutureOrdersTable();
});

document
  .getElementById("saveButton")
  .addEventListener("click", async () => {
    if (!window.currentUserSession) {
      showToast("אין הרשאה - אנא התחבר מחדש", 'error');
      return;
    }

    const saveBtn = document.getElementById("saveButton");
    saveBtn.classList.add("loading");
    saveBtn.disabled = true;

    // Check permissions
    if (!window.isAdminMode) {
      const activeStaffName = document.getElementById('activeStaffSelect')?.value;
      const activeStaff = window.currentStaffMembers.find(s => (typeof s === 'string' ? s : s.name) === activeStaffName);
      const perms = (activeStaff && typeof activeStaff === 'object') ? activeStaff.permissions : { edit_details: false };
      
      if (!perms.edit_details && !perms.edit_status) {
        showToast("אין לך הרשאה לבצע שינויים אלו", 'error');
        saveBtn.disabled = false;
        saveBtn.classList.remove("loading");
        return;
      }
    }

    let clientsDataUpdated = false;

    try {
      const rows = document.querySelectorAll(
        "#futureOrdersTable tbody tr, #pastOrdersTable tbody tr"
      );

      for (const row of rows) {
        const id = row.querySelector("select, .price-input")?.dataset?.id;
        if (!id) continue;

        const select = row.querySelector("select");
        const status = select?.value;
        const adminNote = row.querySelector("textarea.admin-note")?.value;
        const pricePerDay = row.querySelector(".price-input")?.value;
        const daysInput = row.querySelector(".days-input");

        const checkInInput = row.querySelector(
          '.date-input[data-field="check_in"]'
        );
        const checkOutInput = row.querySelector(
          '.date-input[data-field="check_out"]'
        );

        const updateData = {};

        if (status) updateData.status = status;
        if (adminNote !== undefined) updateData.admin_note = adminNote;
        if (pricePerDay) updateData.price_per_day = parseInt(pricePerDay);

        if (checkInInput && checkInInput.value) {
          updateData.check_in = checkInInput.value;
        }
        if (checkOutInput && checkOutInput.value) {
          updateData.check_out = checkOutInput.value;
        }

        if (daysInput && !checkInInput && !checkOutInput) {
          const newDays = parseInt(daysInput.value);
          const checkInDate = daysInput.dataset.checkin;

          if (checkInDate && newDays > 0) {
            const newCheckOut = addDaysToDate(checkInDate, newDays);
            updateData.check_out = newCheckOut;
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error } = await pensionNetSupabase
            .from("orders")
            .update(updateData)
            .eq("id", id);

          if (error) {
            console.error("Error updating row:", id, error);
            throw error;
          }
          
          // --- סינכרון מחיר ברירת מחדל ללקוח ---
          if (updateData.price_per_day) {
            const order = window.allOrdersCache.find(o => String(o.id) === String(id));
            if (order && order.phone) {
              const phoneKey = formatPhoneKey(order.phone);
              if (!window.clientsData) window.clientsData = {};
              if (!window.clientsData[phoneKey]) window.clientsData[phoneKey] = {};
              window.clientsData[phoneKey].default_price = updateData.price_per_day;
              clientsDataUpdated = true;
            }
          }
          // ------------------------------------

          if (select) {
            select.classList.remove(
              "status-approved",
              "status-cancelled"
            );
            if (status === "מאושר")
              select.classList.add("status-approved");
            if (status === "בוטל")
              select.classList.add("status-cancelled");
          }
        }
      }

      // --- שמירת שינויי נתוני לקוחות (מחיר ברירת מחדל) למסד הנתונים ---
      if (clientsDataUpdated) {
        const { error: profileError } = await pensionNetSupabase
          .from('profiles')
          .update({ clients_data: window.clientsData })
          .eq('user_id', window.currentUserSession.user.id);
          
        if (profileError) console.warn('Note: Could not sync clients_data:', profileError);
      }
      // ------------------------------------------------------------

      await createAuditLog('UPDATE', 'ביצוע שמירה גורפת של שינויים בטבלאות הניהול');

      const savedBanner = document.createElement("div");
      savedBanner.className = "success-banner";
      savedBanner.innerHTML = '<i class="fas fa-check-circle"></i> השינויים נשמרו בהצלחה';
      document.body.appendChild(savedBanner);

      setTimeout(async () => {
        savedBanner.remove();
        await loadData();
        saveBtn.disabled = false;
        saveBtn.classList.remove("loading");
      }, 2000);
    } catch (error) {
      console.error("Error saving:", error);
      showToast("שגיאה בשמירת הנתונים: " + error.message, 'error');
      saveBtn.classList.remove("loading");
      saveBtn.disabled = false;
    }
  });

// Removed redundant loadData() call
// Auto-restore saved profile if PIN is still valid
async function initializeProfile() {
  // Check if we just logged in (from login.html or google)
  if (localStorage.getItem('pensionet_just_logged_in') === 'true') {
    localStorage.removeItem('pensionet_just_logged_in');
    localStorage.setItem('pensionet_last_pin_verified', Date.now().toString());
    window.lastPinVerificationTime = Date.now();
    if (window.managerName) {
      localStorage.setItem('pensionNet_activeStaff', window.managerName);
    }
  }
  
  const savedProfile = localStorage.getItem('pensionNet_activeStaff');
  const now = Date.now();
  const pinValid = window.lastPinVerificationTime && (now - window.lastPinVerificationTime < PIN_EXPIRATION_MS);
  
  if (savedProfile && savedProfile !== 'צוות' && pinValid) {
    // PIN is still valid, restore profile without asking again
    const activeSelect = document.getElementById('activeStaffSelect');
    const initialSelect = document.getElementById('initialProfileSelect');
    
    if (activeSelect) activeSelect.value = savedProfile;
    if (initialSelect) initialSelect.value = savedProfile;
    
    window.isSessionVerified = true;
    window.isAdminMode = (savedProfile === window.managerName);
    updateModeUI();
    
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.setProperty('display', 'none', 'important');
  } else if (!pinValid) {
    // NEW logic: if only manager profile exists, auto-select it and skip overlay
    const staffNames = (window.currentStaffMembers || []).map(s => typeof s === 'string' ? s : s.name);
    if (staffNames.length === 0 && window.managerName) {
      localStorage.setItem('pensionNet_activeStaff', window.managerName);
      window.isAdminMode = true;
      window.isSessionVerified = true;
      window.lastPinVerificationTime = Date.now();
      localStorage.setItem('pensionet_last_pin_verified', window.lastPinVerificationTime.toString());
      updateModeUI();
      const overlay = document.getElementById('login-overlay');
      if (overlay) overlay.style.setProperty('display', 'none', 'important');
    } else {
      // PIN expired or no session, ensure staff is 'צוות'
      localStorage.setItem('pensionNet_activeStaff', 'צוות');
      const activeSelect = document.getElementById('activeStaffSelect');
      if (activeSelect) activeSelect.value = 'צוות';
      window.isAdminMode = false;
      updateModeUI();
    }
  }
}


async function switchTab(tabName) {
  // --- Feature Gating Check ---
  if (typeof Features !== 'undefined') {
    const tabFeatureMap = {
      'audit': 'audit_log'
    };
    const requiredFeature = tabFeatureMap[tabName];
    if (requiredFeature && !Features.isEnabled(requiredFeature)) {
      showToast("פיצ'ר זה אינו זמין בחבילה שלך", "error");
      return;
    }
  }

  // If moving to settings or audit, verify PIN first
  if (tabName === 'settings' || tabName === 'audit') {
    if (!(await verifyManagerAccess())) return;
  }

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const selectedTab = document.getElementById('tab-' + tabName);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }
  
  const selectedBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('active');
  }

  // Ensure global save button is visible on ongoing and history tabs
  const globalSaveBtn = document.getElementById('saveButtonContainer');
  if (globalSaveBtn) {
    globalSaveBtn.style.display = (tabName === 'ongoing' || tabName === 'history') ? 'block' : 'none';
  }

  // Handle data loading for specific tabs
  if (tabName === 'settings') {
    loadSettings();
  } else if (tabName === 'audit') {
    loadAuditLogs();
  }
}

// --- Staff Management ---
window.currentStaffMembers = [];

window.staffDeleteConfirmIndex = -1;

function renderStaffList() {
  const list = document.getElementById('staff-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (window.currentStaffMembers.length === 0) {
    list.innerHTML = '<div style="color: #94a3b8; font-size: 14px; padding: 10px;">אין עובדים רשומים במערכת</div>';
    return;
  }

  window.currentStaffMembers.forEach((staff, index) => {
    // Ensure permissions exist
    if (!staff.permissions) {
      staff.permissions = { edit_status: false, edit_details: false };
    }

    const card = document.createElement('div');
    card.className = 'staff-permission-card';
    
    const isConfirming = window.staffDeleteConfirmIndex === index;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        <span style="font-weight: 800; color: #1e293b;">${staff.name}</span>
        ${isConfirming ? `
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 11px; color: #ef4444; font-weight: bold;">בטוח?</span>
            <button onclick="executeRemoveStaff(${index})" class="header-btn" style="background:#ef4444; color:white; padding: 2px 8px; font-size: 11px; border-radius: 4px;">כן</button>
            <button onclick="cancelRemoveStaff()" class="header-btn" style="background:#64748b; color:white; padding: 2px 8px; font-size: 11px; border-radius: 4px;">לא</button>
          </div>
        ` : `
          <button onclick="requestRemoveStaff(${index})" class="delete-note-btn" title="הסר עובד/ת"><i class="fas fa-trash"></i></button>
        `}
      </div>
      <div style="display: grid; grid-template-columns: 1fr; gap: 4px; ${isConfirming ? 'opacity: 0.3; pointer-events: none;' : ''}">
        <label>
          <span>שינוי סטטוס הזמנות</span>
          <input type="checkbox" ${staff.permissions.edit_status ? 'checked' : ''} onchange="toggleStaffPermission(${index}, 'edit_status')">
        </label>
        <label>
          <span>עריכת פרטי הזמנה</span>
          <input type="checkbox" ${staff.permissions.edit_details ? 'checked' : ''} onchange="toggleStaffPermission(${index}, 'edit_details')">
        </label>
        <div style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          <label style="font-size: 11px; color: #64748b;">קוד PIN (4 ספרות):</label>
          <input type="password" value="${staff.pin || ''}" maxlength="4" 
                 onchange="updateStaffPin(${index}, this.value)" 
                 style="width: 100%; padding: 4px 8px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  // Also update modal author select and active staff select
  updateStaffSelectors();
}

async function saveStaffToDB() {
  const session = window.currentUserSession;
  if (!session) return;
  
  try {
    const { error } = await pensionNetSupabase
      .from('profiles')
      .update({ staff_members: window.currentStaffMembers })
      .eq('user_id', session.user.id);
      
    if (error) throw error;
    console.log('Staff members persisted to database');
  } catch (err) {
    console.error('Error persisting staff:', err);
    showToast('שגיאה בשמירת נתוני צוות', 'error');
  }
}

async function updateStaffPin(index, newPin) {
  if (window.currentStaffMembers[index]) {
    if (newPin && newPin.length === 4) {
      window.currentStaffMembers[index].pin = newPin;
      await saveStaffToDB();
    } else {
      showToast('קוד PIN חייב להכיל 4 ספרות', 'error');
      renderStaffList();
    }
  }
}

async function toggleStaffPermission(index, permKey) {
  if (window.currentStaffMembers[index]) {
    window.currentStaffMembers[index].permissions[permKey] = !window.currentStaffMembers[index].permissions[permKey];
    await saveStaffToDB();
  }
}

function updateStaffSelectors() {
  const staffNames = getStaffNames();
  
  // 0. Update initial login overlay select
  const initialSelect = document.getElementById('initialProfileSelect');
  if (initialSelect) {
    initialSelect.innerHTML = '<option value="">בחר פרופיל...</option>';
    staffNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      initialSelect.appendChild(opt);
    });
  }
  
  // 1. Update notes modal select
  const select = document.getElementById('noteAuthorSelect');
  if (select) {
    const currentVal = select.value;
    select.innerHTML = '<option value="">בחר עובד/ת...</option>';
    staffNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    select.value = currentVal;
    
    // Protect manager selection in notes
    if (!select.hasAttribute('listener-added')) {
      select.setAttribute('listener-added', 'true');
      let prevAuthor = select.value;
      
      select.addEventListener('focus', function() {
        prevAuthor = this.value;
      });

      select.addEventListener('change', async function() {
        if (this.value === window.managerName && !window.isAdminMode) {
          const success = await verifyManagerAccess();
          if (!success) {
            this.value = prevAuthor;
            return;
          }
        }
        prevAuthor = this.value;
      });
    }
  }

  // 2. Update active staff select (for staff mode)
  const activeSelect = document.getElementById('activeStaffSelect');
  if (activeSelect) {
    let currentVal = activeSelect.value;
    
    // If current value is default, try to load from localStorage
    if (currentVal === 'צוות') {
      const savedAuth = localStorage.getItem('pensionNet_activeStaff');
      if (savedAuth && staffNames.includes(savedAuth)) {
        currentVal = savedAuth;
      }
    }

    activeSelect.innerHTML = '<option value="צוות">זהות עובד/ת...</option>';
    staffNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      activeSelect.appendChild(opt);
    });
    activeSelect.value = currentVal;
  }
}

window.isVerifyingManager = false;
async function verifyManagerAccess(targetName = null, force = false) {
  // If targetName is provided, we verify that specific person (manager or staff)
  // If no targetName, we verify manager
  
  const isVerifyingStaff = targetName && targetName !== window.managerName;
  const staffObj = isVerifyingStaff ? window.currentStaffMembers.find(s => (typeof s === 'string' ? s : s.name) === targetName) : null;
  
  // NEW: Cancel PIN in the entire system, unless forced (e.g. for adding employees)
  if (!force) {
    window.isAdminMode = !isVerifyingStaff;
    window.isSessionVerified = true;
    localStorage.setItem('pensionet_last_pin_verified', Date.now().toString());
    window.lastPinVerificationTime = Date.now();
    return true;
  }

  // Check for 5-minute cooldown (only relevant if forced or staff verify)
  const now = Date.now();
  if (window.lastPinVerificationTime && (now - window.lastPinVerificationTime < PIN_EXPIRATION_MS)) {
    if (targetName) {
      window.isAdminMode = !isVerifyingStaff;
    }
    return true;
  }

  if (window.isVerifyingManager) return false;
  
  window.isVerifyingManager = true;
  return new Promise((resolve) => {
    const modal = document.getElementById('pinModal');
    const input = document.getElementById('pinInput');
    const confirmBtn = document.getElementById('pinConfirmBtn');
    const cancelBtn = document.getElementById('pinCancelBtn');
    const errorMsg = document.getElementById('pinError');
    const title = modal.querySelector('h3');
    
    if (title) title.textContent = targetName ? `אימות PIN עבור: ${targetName}` : 'אימות PIN מנהל';
    
    input.value = '';
    errorMsg.textContent = '';
    modal.style.display = 'block';
    input.focus();
    
    const cleanup = () => {
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      input.onkeydown = null;
      modal.style.display = 'none';
      window.isVerifyingManager = false;
    };
    
    const handleConfirm = async () => {
      const enteredPin = String(input.value).trim();
      let actualPin = "";

      if (isVerifyingStaff && staffObj) {
        actualPin = String(staffObj.pin || '').trim();
      } else {
        // Manager verification
        if (!window.managerPin) {
          const session = window.currentUserSession || await Auth.getSession();
          if (session) {
            const { data: profiles } = await pensionNetSupabase.from('profiles').select('manager_pin').eq('user_id', session.user.id);
            if (profiles && profiles.length > 0) window.managerPin = profiles[0].manager_pin;
          }
        }
        actualPin = String(window.managerPin || '').trim();
      }

      if (enteredPin === actualPin && actualPin !== "") {
        if (!isVerifyingStaff) {
            window.isAdminMode = true;
            createAuditLog('UPDATE', 'מנהל נכנס למערכת (אימות PIN מוצלח)');
        } else {
            window.isAdminMode = false;
            createAuditLog('UPDATE', `אימות PIN מוצלח עבור עובד: ${targetName}`);
        }
        
        const now = Date.now();
        window.lastPinVerificationTime = now;
        localStorage.setItem('pensionet_last_pin_verified', now.toString());
        window.isSessionVerified = true;
        updateModeUI();
        cleanup();
        resolve(true);
      } else {
        errorMsg.textContent = 'קוד PIN שגוי';
        input.value = '';
        input.focus();
      }
    };
    
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') { cleanup(); resolve(false); }
    };
  });
}

async function addStaffMember() {
  const needsPin = window.currentPlanId === 'pro_plus';
  if (!(await verifyManagerAccess(null, needsPin))) return;
  
  const nameInput = document.getElementById('new-staff-name');
  const pinInput = document.getElementById('new-staff-pin');
  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();
  
  const existingNames = window.currentStaffMembers.map(s => typeof s === 'string' ? s : s.name);
  
  if (!name) { showToast('יש להזין שם עובד', 'error'); return; }
  if (!pin || pin.length !== 4) { showToast('יש להזין קוד PIN בן 4 ספרות', 'error'); return; }
  
  if (name && !existingNames.includes(name)) {
    window.currentStaffMembers.push({
      name: name,
      pin: pin,
      permissions: {
        edit_status: false,
        edit_details: false
      }
    });
    await saveStaffToDB();
    createAuditLog('UPDATE', `הוספת חבר צוות חדש: ${name}`);
    nameInput.value = '';
    pinInput.value = '';
    renderStaffList();
  }
}

function requestRemoveStaff(index) {
  window.staffDeleteConfirmIndex = index;
  renderStaffList();
}

function cancelRemoveStaff() {
  window.staffDeleteConfirmIndex = -1;
  renderStaffList();
}

async function executeRemoveStaff(index) {
  if (!(await verifyManagerAccess())) return;
  
  const staff = window.currentStaffMembers[index];
  const name = typeof staff === 'string' ? staff : staff.name;
  
  window.currentStaffMembers.splice(index, 1);
  window.staffDeleteConfirmIndex = -1;
  await saveStaffToDB();
  createAuditLog('UPDATE', `הסרת חבר צוות: ${name}`);
  renderStaffList();
}

function updatePlanUI() {
  const containers = [
    document.getElementById('userPlanBadgeContainer'),
    document.getElementById('settingsPlanBadgeContainer')
  ];
  
  const planId = window.currentPlanId;
  const userEmail = window.currentUserSession?.user?.email || 
                    window.currentUserSession?.email || 
                    (typeof Auth !== 'undefined' && Auth.getSession()?.user?.email);
  const isSystemAdmin = userEmail === 'shaharsolutions@gmail.com' && !window.isImpersonating;
  
  if (!planId && !isSystemAdmin) return;

  const isFounder = window.isFounder;

  // Logic consistent with admin_panel.js: Founders get +1 feature tier
  let displayPlanId = planId;
  if (isFounder) {
    if (planId === 'starter') displayPlanId = 'pro';
    else if (planId === 'pro') displayPlanId = 'pro_plus';
  }

  let badgeHtml = '';
  const badgeStyle = 'padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; text-transform: uppercase; border: 1px solid transparent;';

  if (isSystemAdmin) {
    badgeHtml = `<span style="${badgeStyle} background: #fefce8; color: #854d0e; border-color: #facc15;"><i class="fas fa-shield-alt"></i> Admin</span>`;
  } else if (displayPlanId === 'starter') {
    badgeHtml = `<span style="${badgeStyle} background: #ecfdf5; color: #059669; border-color: #10b981;">Starter</span>`;
  } else if (displayPlanId === 'pro') {
    badgeHtml = `<span style="${badgeStyle} background: #eff6ff; color: #2563eb; border-color: #3b82f6;">Pro</span>`;
  } else if (displayPlanId === 'pro_plus') {
    badgeHtml = `<span style="${badgeStyle} background: #faf5ff; color: #7c3aed; border-color: #8b5cf6;">Pro Plus</span>`;
  }

  if (isFounder && !isSystemAdmin) {
    badgeHtml += `<span style="${badgeStyle} background: #7c3aed; color: white; border: none; margin-right: 6px;" title="מחיר מופחת לצמיתות"><i class="fas fa-medal"></i> Founder</span>`;
  }

  containers.forEach(container => {
    if (container) container.innerHTML = badgeHtml;
  });
}

function getStaffNames() {
  const staffNames = window.currentStaffMembers.map(s => typeof s === 'string' ? s : s.name);
  if (window.managerName && !staffNames.includes(window.managerName)) {
    return [window.managerName, ...staffNames];
  }
  return staffNames;
}

// --- Mode Toggle Logic ---
window.isAdminMode = false; // Default to staff mode
window.managerPin = '';
window.managerName = '';

function updateModeUI() {
  const badge = document.getElementById('modeStatusLabel');
  const staffSelectorContainer = document.getElementById('activeStaffSelectorContainer');
  const overlay = document.getElementById('login-overlay');
  const globalSaveBtn = document.getElementById('saveButtonContainer');
  if (!badge) return;

  const now = Date.now();
  const pinValid = window.lastPinVerificationTime && (now - window.lastPinVerificationTime < 5 * 60 * 1000);
  const activeStaffName = document.getElementById('activeStaffSelect')?.value || 'צוות';
  let allowSave = false;

  if (window.isImpersonating || window.isDemoMode) {
    allowSave = !window.isImpersonating; // Allow save in demo mode for local trial
    badge.innerHTML = window.isDemoMode ? '<i class="fas fa-magic"></i> מצב דמו' : '<i class="fas fa-user-secret"></i> מצב צפייה';
    badge.className = 'mode-badge manager'; // Using manager style for gold feel
    document.body.classList.remove('staff-mode', 'no-identity');
  } else if (window.isAdminMode) {
    allowSave = true;
    badge.innerHTML = '<i class="fas fa-unlock"></i> מצב מנהל';
    badge.className = 'mode-badge manager';
    document.body.classList.remove('staff-mode', 'no-identity');
    document.body.classList.remove('perm-edit-status', 'perm-edit-details', 'perm-manage-payments');
    
    // Ensure selector reflects manager profile
    if (staffSelectorContainer) staffSelectorContainer.style.display = 'flex';
    const select = document.getElementById('activeStaffSelect');
    if (select && window.managerName) {
      select.value = window.managerName;
    }
  } else {
    badge.innerHTML = '<i class="fas fa-lock"></i> מצב עובד';
    badge.className = 'mode-badge staff';
    document.body.classList.add('staff-mode');
    if (staffSelectorContainer) staffSelectorContainer.style.display = 'flex';
    
    // Switch permissions based on selected active employee
    const activeStaff = window.currentStaffMembers.find(s => (typeof s === 'string' ? s : s.name) === activeStaffName);
    
    const perms = (activeStaff && typeof activeStaff === 'object') ? activeStaff.permissions : (window.globalStaffPermissions || {
       edit_status: false,
       edit_details: false
    });

    // Apply permissions
    if (perms.edit_status) {
      document.body.classList.add('perm-edit-status');
      allowSave = true;
    } else {
      document.body.classList.remove('perm-edit-status');
    }
    
    if (perms.edit_details) {
      document.body.classList.add('perm-edit-details');
      allowSave = true;
    } else {
      document.body.classList.remove('perm-edit-details');
    }

    // LOCK ACTIONS: If no staff identity defined and not in admin mode
    if (activeStaffName === 'צוות') {
       document.body.classList.add('no-identity');
    } else {
       document.body.classList.remove('no-identity');
    }

    // If on protected tab while in staff mode AND PIN expired, switch to ongoing
    const activeTabBtn = document.querySelector('.tab-btn.active');
    if (!pinValid && activeTabBtn && (activeTabBtn.textContent.includes('הגדרות') || activeTabBtn.textContent.includes('יומן פעולות'))) {
      switchTab('ongoing');
    }
  }

  // Toggle global save button visibility (FOR BOTH MODES)
  if (globalSaveBtn) {
    // Button should be visible if on 'ongoing' or 'history' tab, regardless of allowSave
    // but we will disable it if not explicitly allowed to prevent confusion.
    const activeTabAttr = document.querySelector('.tab-btn.active')?.getAttribute('onclick') || '';
    const activeTab = activeTabAttr.match(/'([^']+)'/)?.[1];
    const isSaveTab = (activeTab === 'ongoing' || activeTab === 'history');
    
    if (isSaveTab) {
      globalSaveBtn.style.display = 'block';
      const btn = document.getElementById('saveButton');
      if (btn) {
        // We keep it enabled if they are in admin mode or have any edit permission
        btn.disabled = !allowSave;
        if (!allowSave) {
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.title = 'אין לך הרשאה לשמור שינויים';
        } else {
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
          btn.title = '';
        }
      }
    } else {
      globalSaveBtn.style.display = 'none';
    }
  }

  // LOCK: If no valid profile selected OR PIN expired, show login overlay (FOR BOTH MODES)
  if (overlay) {
    const hasOnlyManager = (window.currentStaffMembers || []).length === 0 && window.managerName;
    if (window.isDemoMode) {
       overlay.style.setProperty('display', 'none', 'important');
    } else if (!window.isAdminMode && (!pinValid || activeStaffName === 'צוות') && !window.overlayManuallyClosed && !hasOnlyManager) {
       overlay.style.setProperty('display', 'flex', 'important');
    } else {
       overlay.style.setProperty('display', 'none', 'important');
    }
  }
  
  // Re-render tables to apply disabled/enabled status to fields
  renderPastOrdersTable();
  renderFutureOrdersTable();
  
  // Refresh notes view if open to show/hide delete buttons
  if (window.currentlyEditingOrderId) {
    loadOrderNotes(window.currentlyEditingOrderId);
  }
}

async function handleInitialProfileChange() {
  const select = document.getElementById('initialProfileSelect');
  const name = select?.value;
  if (!name) return;
  
  const success = await verifyManagerAccess(name);
  if (success) {
    document.getElementById('login-overlay').style.setProperty('display', 'none', 'important');
    const activeSelect = document.getElementById('activeStaffSelect');
    if (activeSelect) activeSelect.value = name;
    localStorage.setItem('pensionNet_activeStaff', name);
    window.isSessionVerified = true;
    window.overlayManuallyClosed = false;
    showToast(`ברוך הבא, ${name}`, 'success');
    updateModeUI();
  } else {
    select.value = '';
  }
}

async function handleActiveStaffChange() {
  const select = document.getElementById('activeStaffSelect');
  const name = select?.value || 'צוות';
  
  if (name === 'צוות') {
     // Optional: decide if switching back to "Team" requires PIN or just logs out profile
     window.isAdminMode = false;
     updateModeUI();
     localStorage.setItem('pensionNet_activeStaff', 'צוות');
     return;
  }

  // If already the current active staff, do nothing
  if (name === localStorage.getItem('pensionNet_activeStaff')) return;

  const success = await verifyManagerAccess(name);
  if (!success) {
    // Revert to previous value or default
    const prev = localStorage.getItem('pensionNet_activeStaff') || 'צוות';
    if (select) select.value = prev;
    return;
  }

  // Access verified
  localStorage.setItem('pensionNet_activeStaff', name);
  showToast(`המערכת הותאמה להרשאות של: ${name}`, 'info');
  updateModeUI();
}

// Ensure staff mode on start
document.addEventListener('DOMContentLoaded', updateModeUI);

async function toggleAdminMode() {
  if (window.isAdminMode) {
    // Switch to staff mode (no PIN needed)
    window.isAdminMode = false;
    const select = document.getElementById('activeStaffSelect');
    if (select) select.value = 'צוות';
    localStorage.setItem('pensionNet_activeStaff', 'צוות');
    updateModeUI();
  } else {
    // Switching to manager mode - ask for PIN
    const success = await verifyManagerAccess();
    if (success) {
      window.isAdminMode = true;
      updateModeUI();
    }
  }
}

// Make toggleAdminMode globally accessible
window.toggleAdminMode = toggleAdminMode;

// --- Admin Notes Modal Logic ---
window.currentlyEditingOrderId = null;

async function openNotesModal(orderId, dogName, ownerName) {
  window.currentlyEditingOrderId = orderId;
  document.getElementById('modalDogName').textContent = `${dogName} (${ownerName})`;
  document.getElementById('notesModal').style.display = 'block';
  document.getElementById('newNoteContent').value = '';
  
  // Set default author to currently active identity
  const activeStaffSelect = document.getElementById('activeStaffSelect');
  const noteAuthorSelect = document.getElementById('noteAuthorSelect');
  if (activeStaffSelect && noteAuthorSelect && activeStaffSelect.value !== 'צוות') {
    noteAuthorSelect.value = activeStaffSelect.value;
  }
  
  const order = (window.allOrdersCache || []).find(o => String(o.id) === String(orderId)) || (window.pastOrdersCache || []).find(o => String(o.id) === String(orderId));
  const addNoteSection = document.querySelector('.add-note-section');
  if (addNoteSection) {
    if (order?.status === 'בוטל') {
      addNoteSection.style.display = 'none';
      if (!document.getElementById('cancelNoteMsg')) {
        const msg = document.createElement('div');
        msg.id = 'cancelNoteMsg';
        msg.style = 'text-align: center; padding: 10px; color: #ef4444; background: #fee2e2; border-radius: 8px; margin-bottom: 15px; font-weight: bold;';
        msg.innerHTML = '<i class="fas fa-exclamation-circle"></i> הזמנה מבוטלת - ניתן להציג את סיבת הביטול בלבד';
        addNoteSection.parentNode.insertBefore(msg, addNoteSection);
      }
    } else {
      addNoteSection.style.display = 'block';
      document.getElementById('cancelNoteMsg')?.remove();
    }
  }

  loadOrderNotes(orderId);
}

function closeNotesModal() {
  document.getElementById('notesModal').style.display = 'none';
  window.currentlyEditingOrderId = null;
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('notesModal');
  if (event.target == modal) {
    closeNotesModal();
  }
}

function loadOrderNotes(orderId) {
  const allOrders = [...(window.allOrdersCache || []), ...(window.pastOrdersCache || [])];
  const order = allOrders.find(o => String(o.id) === String(orderId));
  const historyDiv = document.getElementById('notesHistory');
  historyDiv.innerHTML = '';
  
  if (!order) return;
  
  // Aggregate ALL notes for this customer
  const customerOrders = allOrders.filter(o => o.phone && o.phone === order.phone);
  let allClientNotes = [];
  
  customerOrders.forEach(o => {
    let orderNotes = safeParseNotes(o.admin_note);
    // Sort individually to match the old logic's indexing expectations for delete
    orderNotes.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    orderNotes.forEach((n, originalIndex) => {
      allClientNotes.push({
        ...n,
        originalIndex,
        isCurrentOrder: String(o.id) === String(orderId),
        dogName: o.dog_name,
        orderDate: o.order_date || o.created_at
      });
    });
  });
  
  if (allClientNotes.length === 0) {
    historyDiv.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">אין הערות עדיין</div>';
    return;
  }
  
  // Sort by date descending
  allClientNotes.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  allClientNotes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-item' + (note.isCurrentOrder ? '' : ' other-order-note');
    if (!note.isCurrentOrder) {
      item.style.opacity = '0.85';
      item.style.borderRight = '4px solid #cbd5e1';
      item.style.background = '#f8fafc';
    }
    
    // Add delete button only for manager AND for current order notes
    const deleteBtn = (window.isAdminMode && note.isCurrentOrder) ? 
      `<button class="delete-note-btn" onclick="deleteOrderNote(${note.originalIndex})" title="מחק הערה"><i class="fas fa-trash"></i></button>` : '';

    const orderRef = !note.isCurrentOrder ? 
      `<span style="font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-right: 8px; color: #475569;">
        הזמנה אחרת: ${note.dogName}
      </span>` : '';

    item.innerHTML = `
      <div class="note-header">
        <div>
          <span class="note-author"><i class="fas fa-user-edit"></i> ${note.author}</span>
          ${orderRef}
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="note-time">${formatDateTime(note.timestamp)}</span>
          ${deleteBtn}
        </div>
      </div>
      <div class="note-content">${note.content}</div>
    `;
    historyDiv.appendChild(item);
  });
}

async function deleteOrderNote(indexInSorted) {
  if (!window.isAdminMode) return;

  showConfirm('מחיקת הערה', 'האם אתה בטוח שברצונך למחוק הערה זו?', async () => {
    const orderId = window.currentlyEditingOrderId;
    const order = (window.allOrdersCache || []).find(o => String(o.id) === String(orderId)) || (window.pastOrdersCache || []).find(o => String(o.id) === String(orderId));
    if (!order) return;

    let notes = safeParseNotes(order.admin_note);

    // Need to find the actual index in original array (sorted is decending)
    notes.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    notes.splice(indexInSorted, 1);

    try {
      const { error } = await pensionNetSupabase
        .from('orders')
        .update({ admin_note: JSON.stringify(notes) })
        .eq('id', orderId);

      if (error) throw error;

      order.admin_note = JSON.stringify(notes);
      loadOrderNotes(orderId);
      
      // Update table button
      const btn = document.querySelector(`button[onclick*="openNotesModal('${orderId}'"]`);
      if (btn) btn.innerHTML = `<i class="fas fa-comments"></i> הערות (${notes.length})`;

    } catch (err) {
      showToast('שגיאה במחיקת הערה: ' + err.message, 'error');
    }
  });
}

document.getElementById('saveNoteBtn')?.addEventListener('click', async function() {
  const author = document.getElementById('noteAuthorSelect').value;
  const content = document.getElementById('newNoteContent').value.trim();
  
  if (!author) { showToast('נא לבחור מחבר/ת להערה', 'error'); return; }
  if (!content) { showToast('נא להזין תוכן להערה', 'error'); return; }
  
  const orderId = window.currentlyEditingOrderId;
  const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
  if (!order) return;
  
  let notes = safeParseNotes(order.admin_note);
  
  const newNote = {
    content,
    author,
    timestamp: new Date().toISOString()
  };
  
  notes.push(newNote);
  
  try {
    const { error } = await pensionNetSupabase
      .from('orders')
      .update({ admin_note: JSON.stringify(notes) })
      .eq('id', orderId);
      
    if (error) throw error;
    
    // Update local cache
    order.admin_note = JSON.stringify(notes);
    
    // Refresh UI
    loadOrderNotes(orderId);
    document.getElementById('newNoteContent').value = '';
    
    // Update table button count
    const btn = document.querySelector(`button[onclick*="openNotesModal('${orderId}'"]`);
    if (btn) {
      btn.innerHTML = `<i class="fas fa-comments"></i> הערות (${notes.length})`;
    }
    
  } catch (err) {
    console.error('Error saving note:', err);
    showToast('שגיאה בשמירת ההערה: ' + err.message, 'error');
  }
});

async function loadSettings() {
  if (window.isDemoMode) {
    window.businessName = 'פנסיון לדוגמה';
    const titleEl = document.getElementById('header-business-name');
    if (titleEl) titleEl.textContent = window.businessName;
    
    // Set holiday toggle to true by default in demo mode
    const holidayToggle = document.getElementById('settings-show-holidays');
    if (holidayToggle) {
        holidayToggle.checked = true;
    }
    
    // Refresh features visibility now that plan is active
    if (typeof Features !== 'undefined') {
        Features.syncUI();
    }
    return;
  }
  console.log('Attempting to load settings...');
  const session = window.currentUserSession || await Auth.getSession();
  if (!session || !session.user) {
    console.warn('No session found for loadSettings');
    return;
  }

  window.managerName = session.user.user_metadata?.full_name || 'מנהל';
  updateStaffSelectors();

  // Ensure user has a plan assigned (Default to Starter for new users)
  try {
    const { data: planData } = await pensionNetSupabase
      .from('user_plan')
      .select('plan_id, founder_price_locked')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!planData) {
      console.log('No plan found, assigning Starter plan...');
      window.currentPlanId = 'starter';
      window.isFounder = false;
      const { error: planError } = await pensionNetSupabase
        .from('user_plan')
        .insert([{
          user_id: session.user.id,
          plan_id: 'starter',
          updated_at: new Date().toISOString()
        }]);
      
      if (!planError && typeof Features !== 'undefined') {
        console.log('Starter plan assigned, re-initializing features...');
        await Features.init();
      }
    } else {
      window.currentPlanId = planData.plan_id;
      window.isFounder = !!planData.founder_price_locked;
    }
    
    // Proactively sync UI once plan info is available
    if (typeof Features !== 'undefined') {
      Features.syncUI();
    }
  } catch (planErr) {
    console.warn('Plan assignment check failed:', planErr);
  }

  try {
    let { data: profile, error } = await pensionNetSupabase
      .from('profiles')
      .select('max_capacity, phone, full_name, business_name, location, default_price, staff_members, manager_pin, clients_data, custom_events')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      console.log('Profile not found, creating default profile...');
      const { data: newProfile, error: insertError } = await pensionNetSupabase
        .from('profiles')
        .insert([{ 
          user_id: session.user.id,
          full_name: session.user.user_metadata?.full_name || '',
          business_name: session.user.user_metadata?.business_name || '',
          location: session.user.user_metadata?.location || '',
          phone: session.user.user_metadata?.phone || '',
          max_capacity: parseInt(session.user.user_metadata?.max_capacity) || 10,
          default_price: parseInt(session.user.user_metadata?.default_price) || 130,
          staff_members: [],
          manager_pin: session.user.user_metadata?.manager_pin || '1234'
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      profile = newProfile;
    } else if (error) {
      throw error;
    }

    if (profile) {
      console.log('Setting field values from profile:', profile);
      
      // Fallback logic: Use profile value if exists, otherwise fallback to session metadata
      const meta = session.user.user_metadata || {};
      
      const fieldMapping = {
        'settings-capacity': profile.max_capacity || meta.max_capacity,
        'settings-phone': profile.phone || meta.phone,
        'settings-full-name': profile.full_name || meta.full_name,
        'settings-business-name': profile.business_name || meta.business_name,
        'settings-location': profile.location || meta.location,
        'settings-default-price': profile.default_price || meta.default_price,
        'settings-admin-pin': profile.manager_pin || meta.manager_pin
      };
      
      window.managerName = profile.full_name || meta.full_name || window.managerName || 'מנהל';
      window.businessName = profile.business_name || meta.business_name || '';

      // Apply field values to inputs
      Object.keys(fieldMapping).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = fieldMapping[id] ?? '';
      });
      
      // Ensure managerPin has a value: DB -> Metadata -> Default
      window.managerPin = profile.manager_pin || session.user.user_metadata?.manager_pin || '1234';
      
      // Update the input field specifically if it was empty from DB
      const pinInput = document.getElementById('settings-admin-pin');
      if (pinInput && !pinInput.value) {
        pinInput.value = window.managerPin;
      }
      
      const showHolidaysInput = document.getElementById('settings-show-holidays');
      if (showHolidaysInput) {
        showHolidaysInput.checked = localStorage.getItem('pensionNet_showHolidays') !== 'false';
      }

      window.currentStaffMembers = (profile.staff_members || []).map(s => {
        // Migration: convert string staff to objects if needed
        if (typeof s === 'string') {
          return {
            name: s,
            permissions: { edit_status: false, edit_details: false }
          };
        }
        return s;
      });

      window.clientsData = profile.clients_data || {};
      window.pensionCustomEvents = profile.custom_events || [];
      
      const sessionData = window.currentUserSession;
      if (sessionData && sessionData.user) {
        let localFallback = localStorage.getItem('pensionNet_clientsData_fallback_' + sessionData.user.id);
        if (localFallback) {
          try {
             window.clientsData = { ...JSON.parse(localFallback), ...window.clientsData };
          } catch(e) {}
        }
      }

      window.globalStaffPermissions = {
        edit_status: false,
        edit_details: false
      };



      renderStaffList();

      // Update Header Subtitle
      const headerSubtitle = document.getElementById('header-business-name');
      if (headerSubtitle && window.businessName) {
        headerSubtitle.textContent = window.businessName;
      }
      console.log('Settings fields populated successfully');
      updatePlanUI();
      updateModeUI();
      initializeProfile();
    }
  } catch (err) {
    console.error('Critical error in loadSettings:', err);
  }
}

document.getElementById('saveSettingsBtn')?.addEventListener('click', async function() {
  const session = window.currentUserSession;
  if (!session) return;

  const saveBtn = this;
  const originalText = saveBtn.innerHTML;
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';

  const updateData = {
    max_capacity: parseInt(document.getElementById('settings-capacity').value),
    phone: document.getElementById('settings-phone').value,
    full_name: document.getElementById('settings-full-name').value,
    business_name: document.getElementById('settings-business-name').value,
    location: document.getElementById('settings-location').value,
    default_price: parseInt(document.getElementById('settings-default-price').value),
    staff_members: window.currentStaffMembers,
    manager_pin: document.getElementById('settings-admin-pin').value
  };

  const showHolidaysInput = document.getElementById('settings-show-holidays');
  if (showHolidaysInput) {
    localStorage.setItem('pensionNet_showHolidays', showHolidaysInput.checked);
  }

  try {
    const { error } = await pensionNetSupabase
      .from('profiles')
      .upsert({ 
        user_id: session.user.id,
        ...updateData 
      }, { onConflict: 'user_id' });

    if (error) throw error;

    showToast('ההגדרות נשמרו בהצלחה!', 'success');
    setTimeout(() => location.reload(), 1200); 
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast('שגיאה בשמירת ההגדרות: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
  }
});

document.getElementById('fillDemoDataBtn')?.addEventListener('click', fillWithDemoData);

async function fillWithDemoData() {
  const session = window.currentUserSession;
  if (!session) {
    showToast('עליך להיות מחובר כדי למלא נתוני דמו', 'error');
    return;
  }

  showConfirm('<i class="fas fa-magic"></i> יצירת נתוני דמו', 'פעולה זו תוסיף כ-150 הזמנות פיקטיביות למערכת לצורך התנסות. <br><br><b>האם להמשיך?</b>', async () => {
    const btn = document.getElementById('fillDemoDataBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ממלא נתונים...';
    
        const owners = [
        { name: 'יוסי כהן', phone: '0501111111', dogs: ['רקס', 'לאסי'] },
        { name: 'שרה לוי', phone: '0522222222', dogs: ['בל'] },
        { name: 'דני רובס', phone: '0543333333', dogs: ['סימבה', 'נלה'] },
        { name: 'מיכל אברהם', phone: '0504444444', dogs: ['צ׳ארלי'] },
        { name: 'רון שחר', phone: '0525555555', dogs: ['לוקה', 'מקס'] },
        { name: 'גלית יצחק', phone: '0546666666', dogs: ['ביילי'] },
        { name: 'אבי ביטון', phone: '0507777777', dogs: ['לונה'] },
        { name: 'נועה קירל', phone: '0528888888', dogs: ['רוקי'] },
        { name: 'עומר אדם', phone: '0549999999', dogs: ['טופי'] },
        { name: 'עידן רייכל', phone: '0501234567', dogs: ['שוקו'] },
        { name: 'רוני סופר', phone: '0527654321', dogs: ['לאקי'] },
        { name: 'רחל המשוררת', phone: '0545554443', dogs: ['ג׳וני'] },
        { name: 'משה פרץ', phone: '0501112222', dogs: ['בונו'] },
        { name: 'ליאור נרקיס', phone: '0523334444', dogs: ['סטיץ'] },
        { name: 'אייל גולן', phone: '0545556666', dogs: ['דיאמונד'] },
        { name: 'סטטיק', phone: '0507778888', dogs: ['מרשל'] },
        { name: 'בן אל', phone: '0529990000', dogs: ['סקיי'] },
        { name: 'עדן בן זקן', phone: '0541112222', dogs: ['שולי'] },
        { name: 'נסרין קדרי', phone: '0503334444', dogs: ['אלסקה'] },
        { name: 'חנן בן ארי', phone: '0525556666', dogs: ['ירושלים'] },
        { name: 'ישי ריבו', phone: '0547778888', dogs: ['לב'] },
        { name: 'שלמה ארצי', phone: '0509991111', dogs: ['גבר'] },
        { name: 'צביקה פיק', phone: '0521113333', dogs: ['מרי'] },
        { name: 'אריק איינשטיין', phone: '0543335555', dogs: ['אולי'] },
        { name: 'יהודה פוליקר', phone: '0505557777', dogs: ['עיניים'] },
        { name: 'גידי גוב', phone: '0527779999', dogs: ['עוגל'] },
        { name: 'גלי עטרי', phone: '0549991111', dogs: ['הללויה'] },
        { name: 'ריטה', phone: '0501114444', dogs: ['רמי'] },
        { name: 'שירי מימון', phone: '0523331111', dogs: ['בוגה'] },
        { name: 'הראל סקעת', phone: '0545552222', dogs: ['אורי'] },
        { name: 'קרן פלס', phone: '0507773333', dogs: ['נועם'] },
        { name: 'מירי מסיקה', phone: '0529994444', dogs: ['תיבה'] },
        { name: 'נינט טייב', phone: '0541115555', dogs: ['זוהר'] },
        { name: 'רן דנקר', phone: '0503336666', dogs: ['שווים'] },
        { name: 'אביב גפן', phone: '0525557777', dogs: ['עשור'] }
    ];

    const sizes = ['קטן', 'בינוני', 'גדול'];
    const realNotes = [
      'אוכל פעמיים ביום, רגיש לעוף',
      'ידידותי מאוד לכלבים אחרים',
      'צריך כדור בבוקר עם האוכל',
      'אוהב לשחק עם כדור טניס',
      'חששן בהתחלה, זקוק לגישה עדינה',
      'מעדיף לישון על ספה',
      'מושך קצת בטיולים',
      'רגיל ללינה בבית',
      'אנרגטי מאוד, אוהב לרוץ'
    ];
    
    const today = new Date();
    const demoOrders = [];

        const updatedClientsData = { ...(window.clientsData || {}) };

    owners.forEach(owner => {
        const numOrders = Math.floor(Math.random() * 5) + 1; // 1 to 5 orders
        
        // Logical price mapping: more orders -> lower price
        let clientPrice = 130;
        if (numOrders === 3) clientPrice = 120;
        else if (numOrders === 4) clientPrice = 110;
        else if (numOrders === 5) clientPrice = 100;

        const phoneKey = formatPhoneKey(owner.phone);
        updatedClientsData[phoneKey] = { default_price: clientPrice };

        for (let j = 0; j < numOrders; j++) {
            const dogName = owner.dogs[Math.floor(Math.random() * owner.dogs.length)];
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            
            const offsetDays = Math.floor(Math.random() * 180) - 90;
            const checkIn = new Date(today);
            checkIn.setDate(today.getDate() + offsetDays);
            
            const duration = Math.floor(Math.random() * 10) + 1;
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkIn.getDate() + duration);
            
            let status;
            const todayMs = new Date().setHours(0,0,0,0);
            const checkInMs = new Date(checkIn).setHours(0,0,0,0);
            const checkOutMs = new Date(checkOut).setHours(0,0,0,0);

            if (checkOutMs < todayMs) {
                status = Math.random() < 0.15 ? 'בוטל' : 'מאושר';
            } else {
                const rnd = Math.random();
                if (rnd < 0.2) status = 'ממתין';
                else if (rnd < 0.3) status = 'בוטל';
                else status = 'מאושר';
            }

            const isArrived = (status === 'מאושר' && checkInMs <= todayMs && checkOutMs >= todayMs);
            const isDeparted = (status === 'מאושר' && checkOutMs < todayMs);
            
            let adminNotes = [{
                content: 'מערכת: נתוני דמו',
                author: 'SYSTEM',
                type: 'DEMO_DATA',
                timestamp: new Date().toISOString()
            }];

            if (status === 'בוטל') {
                adminNotes.push({
                    content: 'ביטול: שינוי בתוכניות',
                    author: 'מערכת',
                    timestamp: checkIn.toISOString()
                });
            }
            
            demoOrders.push({
                user_id: session.user.id,
                owner_name: owner.name,
                dog_name: dogName,
                dog_breed: size,
                dog_age: ['בוגר (4-7)', 'צעיר (1-3)', 'מבוגר (8+)', 'גור (עד שנה)'][Math.floor(Math.random() * 4)],
                phone: owner.phone,
                check_in: checkIn.toISOString().split('T')[0],
                check_out: checkOut.toISOString().split('T')[0],
                status: status,
                is_arrived: isArrived,
                is_departed: isDeparted,
                is_paid: isDeparted || (status === 'מאושר' && Math.random() > 0.6),
                price_per_day: clientPrice,
                neutered: Math.random() > 0.5 ? 'מסורס' : 'לא מסורס',
                notes: Math.random() > 0.7 ? realNotes[Math.floor(Math.random() * realNotes.length)] : '',
                admin_note: JSON.stringify(adminNotes),
                created_at: (() => {
                    const daysAgo = Math.floor(Math.random() * 10) + 5;
                    const date = new Date(checkIn);
                    date.setDate(date.getDate() - daysAgo);
                    date.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
                    return date.toISOString();
                })()
            });
        }
    });

    try {
      const { error: orderError } = await pensionNetSupabase.from('orders').insert(demoOrders);
      if (orderError) throw orderError;

      const { error: profileError } = await pensionNetSupabase
        .from('profiles')
        .update({ clients_data: updatedClientsData })
        .eq('user_id', session.user.id);
      
      if (profileError) console.warn('Resiliently ignored profile update error:', profileError);
      else window.clientsData = updatedClientsData;

      showToast('<i class="fas fa-magic"></i> <strong>נתוני הדמו הוספו בהצלחה!</strong>', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      console.error('Error adding demo data:', err);
      showToast('שגיאה בהוספת נתוני דמו: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

document.getElementById('clearDemoDataBtn')?.addEventListener('click', clearDemoData);

async function clearDemoData() {
  const session = window.currentUserSession;
  if (!session) return;

  showConfirm('<i class="fas fa-trash-alt"></i> מחיקת נתוני דמו', 'האם אתה בטוח שברצונך למחוק את כל נתוני הדמו מהמערכת? <br><br><b>פעולה זו תמחק רק הזמנות שנוצרו אוטומטית כדמו.</b>', async () => {
    const btn = document.getElementById('clearDemoDataBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מוחק...';

    try {
      // Step 1: Find all orders that match demo criteria
      const { data: matches, error: fetchError } = await pensionNetSupabase
        .from('orders')
        .select('id')
        .eq('user_id', session.user.id)
        .or('admin_note.ilike.%DEMO_DATA%,admin_note.ilike.%דוגמה%,notes.ilike.%DEMO_DATA%');

      if (fetchError) throw fetchError;

      if (!matches || matches.length === 0) {
        showToast('לא נמצאו נתוני דמו למחיקה', 'info');
        return;
      }

      // Step 2: Delete by IDs 
      const idsToDelete = matches.map(m => m.id);
      const { error: deleteError } = await pensionNetSupabase
        .from('orders')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;

      showToast(`<i class="fas fa-trash-alt"></i> <strong>${matches.length} נתוני דמו נמחקו בהצלחה!</strong>`, 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      console.error('Error clearing demo data:', err);
      showToast('שגיאה במחיקת נתוני דמו: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const messageEl = document.getElementById('confirmMessage');
  const confirmBtn = document.getElementById('confirmConfirmBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) return;

  titleEl.innerHTML = title;
  messageEl.innerHTML = message;
  modal.style.display = 'block';

  // Clear previous listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newConfirmBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    if (onConfirm) onConfirm();
  });

  newCancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Close when clicking outside
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
    // Also keep the existing notesModal logic if needed, 
    // but better to handle all modals or use a class
    const notesModal = document.getElementById('notesModal');
    if (event.target == notesModal) {
      closeNotesModal();
    }
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById("passwordInput");
  const icon = document.querySelector(".password-toggle");
  
  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "🙈";
  } else {
    input.type = "password";
    icon.innerHTML = '<i class="fas fa-eye"></i>';
  }
}

// --- Audit Logs ---
async function createAuditLog(actionType, description, orderId = null) {
    const session = window.currentUserSession || await Auth.getSession();
    if (!session) return;

    const activeStaffName = document.getElementById('activeStaffSelect')?.value;
    const staffName = window.isAdminMode ? "מנהל" : (activeStaffName || "צוות עובדים");

    try {
        await pensionNetSupabase.from('audit_logs').insert([{
            user_id: session.user.id,
            action_type: actionType,
            description: description,
            order_id: orderId ? String(orderId) : null,
            staff_name: staffName
        }]);
    } catch (err) {
        console.error("Error creating audit log:", err);
    }
}

async function loadAuditLogs() {
    const logsList = document.getElementById('auditLogsList');
    if (!logsList) return;

    if (window.isDemoMode) {
        const now = Date.now();
        const demoLogs = [
            { id: 1, staff_name: 'מנהל דמו', action_type: 'UPDATE', description: 'עדכון סטטוס הזמנה עבור רקס (יוסי כהן) ל"מאושר"', created_at: new Date(now - 120000).toISOString() },
            { id: 2, staff_name: 'עובד לדוגמה', action_type: 'INSERT', description: 'הזמנה חדשה נוספה: בל (שרה לוי)', created_at: new Date(now - 3600000).toISOString() },
            { id: 3, staff_name: 'מנהל דמו', action_type: 'UPDATE', description: 'שינוי תאריכי שהייה: סימבה (דני רובס)', created_at: new Date(now - 7200000).toISOString() },
            { id: 4, staff_name: 'מערכת', action_type: 'UPDATE', description: 'גיבוי אוטומטי בוצע בהצלחה', created_at: new Date(now - 86400000).toISOString() }
        ];

        logsList.innerHTML = demoLogs.map(log => {
            let iconClass = 'update';
            let icon = '<i class="fas fa-edit"></i>';
            if (log.action_type === 'INSERT') { iconClass = 'insert'; icon = '<i class="fas fa-plus-circle"></i>'; }
            if (log.action_type === 'DELETE') { iconClass = 'delete'; icon = '<i class="fas fa-trash-alt"></i>'; }

            return `
                <div class="audit-item">
                    <div class="audit-icon ${iconClass}">${icon}</div>
                    <div class="audit-info">
                        <div class="audit-header">
                            <span class="audit-staff">${log.staff_name}</span>
                            <span class="audit-time">${typeof formatDateTime === 'function' ? formatDateTime(log.created_at) : new Date(log.created_at).toLocaleString('he-IL')}</span>
                        </div>
                        <div class="audit-desc">${log.description}</div>
                    </div>
                </div>
            `;
        }).join('');
        return;
    }

    try {
        const { data: logs, error } = await pensionNetSupabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!logs || logs.length === 0) {
            logsList.innerHTML = '<div style="padding: 40px; text-align: center; color: #94a3b8;">אין פעולות מתועדות עדיין.</div>';
            return;
        }

        logsList.innerHTML = logs.map(log => {
            let iconClass = 'update';
            let icon = '<i class="fas fa-edit"></i>';
            if (log.action_type === 'INSERT') { iconClass = 'insert'; icon = '<i class="fas fa-plus-circle"></i>'; }
            if (log.action_type === 'DELETE') { iconClass = 'delete'; icon = '<i class="fas fa-trash-alt"></i>'; }

            return `
                <div class="audit-item">
                    <div class="audit-icon ${iconClass}">${icon}</div>
                    <div class="audit-info">
                        <div class="audit-header">
                            <span class="audit-staff">${log.staff_name}</span>
                            <span class="audit-time">${formatDateTime(log.created_at)}</span>
                        </div>
                        <div class="audit-desc">${log.description}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading audit logs:", err);
        logsList.innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444;">שגיאה בטעינת יומן הפעולות.</div>';
    }
}

// --- Payments ---
function renderPaymentsTable() {
    const tbody = document.querySelector("#paymentsTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const searchTerm = (document.getElementById('paymentSearchInput')?.value || "").toLowerCase();
    const statusFilter = document.getElementById('paymentStatusFilter')?.value || "all";

    const filtered = window.allOrdersCache.filter(row => {
        const matchesSearch = String(row.owner_name || "").toLowerCase().includes(searchTerm) || 
                              String(row.dog_name || "").toLowerCase().includes(searchTerm);
        
        const isPaid = row.is_paid === true;
        const matchesStatus = statusFilter === "all" || 
                              (statusFilter === "paid" && isPaid) || 
                              (statusFilter === "unpaid" && !isPaid);

        return matchesSearch && matchesStatus;
    });

    filtered.forEach(row => {
        const tr = document.createElement('tr');
        const days = calculateDays(row.check_in, row.check_out);
        const pricePerDay = row.price_per_day || 130;
        const totalAmount = days * pricePerDay;
        const isPaid = row.is_paid === true;

        // Apply defaults if not set in DB
        const currentMethod = row.payment_method || 'מזומן';
        // Display 0 if not paid, otherwise the stored amount (defaulting to total if paid but null)
        const currentAmountPaid = (row.amount_paid !== undefined && row.amount_paid !== null) ? row.amount_paid : (isPaid ? totalAmount : 0);

        tr.innerHTML = `
            <td data-label="בעלים">${row.owner_name}</td>
            <td data-label="כלב">${row.dog_name}</td>
            <td data-label="תאריכים" style="font-size: 11px;">${formatDateOnly(row.check_in)} - ${formatDateOnly(row.check_out)}</td>
            <td data-label="ימים">${days} ימים</td>
            <td data-label="מחיר/יום">
                <input type="number" value="${pricePerDay}" step="5"
                       onchange="updatePricePerDay('${row.id}', this.value)" 
                       class="payment-input">
            </td>
            <td data-label="סהכ לתשלום" style="font-weight: bold;">${totalAmount}₪</td>
            <td data-label="סטטוס">
                <span class="${isPaid ? 'paid-badge' : 'unpaid-badge'}">
                    ${isPaid ? 'שולם' : 'טרם שולם'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 4px; min-width: 120px;">
                    <button onclick="updatePaymentMethod('${row.id}', 'מזומן')" 
                            style="padding: 6px 4px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${currentMethod === 'מזומן' ? '#2563eb' : 'white'}; color: ${currentMethod === 'מזומן' ? 'white' : '#64748b'}; cursor: pointer; font-size: 11px; font-weight: bold; flex: 1; transition: all 0.2s;">
                        מזומן
                    </button>
                    <button onclick="updatePaymentMethod('${row.id}', 'אפליקציה')" 
                            style="padding: 6px 4px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${currentMethod === 'אפליקציה' ? '#2563eb' : 'white'}; color: ${currentMethod === 'אפליקציה' ? 'white' : '#64748b'}; cursor: pointer; font-size: 11px; font-weight: bold; flex: 1; transition: all 0.2s;">
                        bit
                    </button>
                </div>
            </td>
            <td>
                <input type="number" value="${currentAmountPaid}" step="5"
                       onchange="updateAmountPaid('${row.id}', this.value)" 
                       class="payment-input">
            </td>
            <td>
                <button onclick="togglePaidStatus('${row.id}', ${!isPaid})" 
                        class="header-btn" 
                        style="background: ${isPaid ? '#64748b' : '#10b981'}; color: white; padding: 5px 10px; font-size: 12px; border-radius: 6px;">
                    ${isPaid ? 'בטל סימון שולם' : 'סמן כשולם ✓'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterPayments() {
    renderPaymentsTable();
}

async function updatePaymentMethod(orderId, method) {
    try {
        const { error } = await pensionNetSupabase
            .from('orders')
            .update({ payment_method: method })
            .eq('id', orderId);

        if (error) throw error;
        
        const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
        if (order) {
            order.payment_method = method;
            createAuditLog('UPDATE', `עדכון שיטת תשלום ל-${method} עבור ${order.dog_name} (${order.owner_name})`, orderId);
            renderPaymentsTable(); // Refresh UI to show active button
        }
    } catch (err) {
        console.error("Error updating payment method:", err);
    }
}

async function updateAmountPaid(orderId, amount) {
    try {
        const { error } = await pensionNetSupabase
            .from('orders')
            .update({ amount_paid: parseInt(amount) || 0 })
            .eq('id', orderId);

        if (error) throw error;

        const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
        if (order) {
            order.amount_paid = parseInt(amount) || 0;
            createAuditLog('UPDATE', `עדכון סכום ששולם ל-${amount}₪ עבור ${order.dog_name}`, orderId);
        }
    } catch (err) {
        console.error("Error updating amount paid:", err);
    }
}

async function togglePaidStatus(orderId, newStatus) {
    try {
        const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
        if (!order) return;

        const updateData = { is_paid: newStatus };
        
        // If marking as paid for the first time or amount is 0, update it to total amount
        if (newStatus === true) {
            if (!order.payment_method) {
                updateData.payment_method = 'מזומן';
                order.payment_method = 'מזומן';
            }
            const days = calculateDays(order.check_in, order.check_out);
            const totalAmount = days * (order.price_per_day || 130);
            updateData.amount_paid = totalAmount;
            order.amount_paid = totalAmount;
        } else {
            // When un-marking as paid, optionally reset amount paid to 0 locally
            updateData.amount_paid = 0;
            order.amount_paid = 0;
        }

        const { error } = await pensionNetSupabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (error) throw error;

        order.is_paid = newStatus;
        const statusText = newStatus ? "שולם" : "לא שולם";
        createAuditLog('UPDATE', `שינוי סטטוס תשלום ל-${statusText} עבור ${order.dog_name}`, orderId);
        renderPaymentsTable();
    } catch (err) {
        console.error("Error toggling paid status:", err);
    }
}

async function updatePricePerDay(orderId, newPrice) {
    try {
        const price = parseInt(newPrice) || 0;
        const { error } = await pensionNetSupabase
            .from('orders')
            .update({ price_per_day: price })
            .eq('id', orderId);

        if (error) throw error;

        const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
        if (order) {
            order.price_per_day = price;
            
            // --- סינכרון מחיר ברירת מחדל ללקוח ---
            if (order.phone) {
                const phoneKey = formatPhoneKey(order.phone);
                if (!window.clientsData) window.clientsData = {};
                if (!window.clientsData[phoneKey]) window.clientsData[phoneKey] = {};
                window.clientsData[phoneKey].default_price = price;
                
                // עדכון במסד הנתונים
                await pensionNetSupabase
                    .from('profiles')
                    .update({ clients_data: window.clientsData })
                    .eq('user_id', window.currentUserSession.user.id);
            }
            // ------------------------------------

            createAuditLog('UPDATE', `עדכון מחיר ליום ל-${price}₪ עבור ${order.dog_name}`, orderId);
            renderPaymentsTable(); // Refresh to recalculate total
        }
    } catch (err) {
        console.error("Error updating price per day:", err);
    }
}

// Clients Management
window.clientsData = window.clientsData || {};
window.clientsCurrentPage = 1;
window.clientsSortField = 'lastOrderDate';
window.clientsSortOrder = 'desc';
const CLIENTS_PER_PAGE = 20;

function toggleClientsSort(field) {
    if (window.clientsSortField === field) {
        window.clientsSortOrder = window.clientsSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        window.clientsSortField = field;
        window.clientsSortOrder = (field === 'name') ? 'asc' : 'desc';
    }
    renderClientsTable();
}

function formatPhoneKey(phone) {
  if (!phone) return 'unknown';
  return phone.replace(/[\s\-]/g, "").replace(/^0/, "972");
}

function processClientsData() {
  const clientsMap = {};
  const cache = window.allOrdersCache || [];
  const defaultPriceInput = document.getElementById('settings-default-price');
  const systemDefaultPrice = defaultPriceInput ? parseInt(defaultPriceInput.value) : 130;
  
  cache.forEach(order => {
    if (!order.phone) return;
    const phoneKey = formatPhoneKey(order.phone);
    if (!clientsMap[phoneKey]) {
      clientsMap[phoneKey] = {
        name: order.owner_name || 'לא ידוע',
        originalPhone: order.phone,
        phoneKey: phoneKey,
        dogs: new Set(),
        totalOrders: 0,
        totalRevenue: 0,
        lastOrderDate: new Date('1970-01-01'),
        latestPriceDate: new Date('1970-01-01'),
        latestOrderPrice: null,
        orderAdminNotes: []
      };
    }
    
    const c = clientsMap[phoneKey];
    if (order.dog_name) {
      c.dogs.add(order.dog_name);
      if (order.dog_photo) {
        if (!c.dogPhotos) c.dogPhotos = {};
        const currentPhoto = c.dogPhotos[order.dog_name];
        if (!currentPhoto || new Date(order.created_at) > new Date(currentPhoto.timestamp)) {
          c.dogPhotos[order.dog_name] = {
            url: order.dog_photo,
            timestamp: order.order_date || order.created_at
          };
        }
      }
    }
    
    // Add admin notes to orderAdminNotes history if they exist
    const adminNotesArr = safeParseNotes(order.admin_note);
    if (adminNotesArr && adminNotesArr.length > 0) {
      adminNotesArr.forEach(an => {
        c.orderAdminNotes.push({
          ...an,
          dog: order.dog_name,
          orderId: order.id
        });
      });
    }
    
    // Status should be anything that brought revenue? Or maybe just status !== canceled
    if (order.status !== 'בוטל') {
       c.totalOrders++;
       const days = calculateDays(order.check_in, order.check_out);
       c.totalRevenue += days * (order.price_per_day || systemDefaultPrice);
    }
    
    // Status should be anything that brought revenue? Or maybe just status !== canceled
    const orderCreationDate = order._creationDate || new Date(order.order_date || order.created_at);
    if (!order._creationDate) order._creationDate = orderCreationDate; // cache it

    if (orderCreationDate > c.lastOrderDate) {
       c.lastOrderDate = orderCreationDate;
       // Update name to latest known name
       if (order.owner_name) c.name = order.owner_name;
    }

    // Track latest price from orders
    if (order.price_per_day && orderCreationDate >= c.latestPriceDate) {
        c.latestPriceDate = orderCreationDate;
        c.latestOrderPrice = order.price_per_day;
    }
  });

  // Convert Set to array and calculate stats
  const clientsList = Object.values(clientsMap).map(c => {
    c.dogsArray = Array.from(c.dogs);
    // Custom price: Prefer explicitly set price, then latest from orders, then null
    c.customPrice = window.clientsData[c.phoneKey]?.default_price || c.latestOrderPrice || null;
    c.isFromHistory = !window.clientsData[c.phoneKey]?.default_price && c.latestOrderPrice !== null;
    
    c.city = window.clientsData[c.phoneKey]?.city || '';
    c.orderAdminNotes = c.orderAdminNotes || [];
    return c;
  });
  
  // Sort by last order descending
  clientsList.sort((a,b) => b.lastOrderDate - a.lastOrderDate);
  
  window.processedClients = clientsList;
  
  // Update Stats UI
  if (document.getElementById('statsTotalClients')) {
    const activeClients = clientsList.filter(c => c.totalOrders > 0);
    const avgOrders = activeClients.length ? (clientsList.reduce((acc, c) => acc + c.totalOrders, 0) / activeClients.length).toFixed(1) : 0;
    const totalDogs = clientsList.reduce((acc, c) => acc + c.dogsArray.length, 0);
    
    document.getElementById('statsTotalClients').textContent = clientsList.length;
    document.getElementById('statsAvgOrdersPerClient').textContent = avgOrders;
    document.getElementById('statsTotalDogs').textContent = totalDogs;
  }
  
  renderClientsTable();
  checkForUnsyncedPrices();
}

function checkForUnsyncedPrices() {
    const unsyncedCount = (window.processedClients || []).filter(c => c.isFromHistory).length;
    const container = document.getElementById('clientsStatsContainer');
    if (!container || unsyncedCount === 0) return;

    if (document.getElementById('syncPricesBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'syncPricesBanner';
    banner.style = `
        background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;
        padding: 15px 20px; margin-bottom: 20px; color: #166534;
        display: flex; align-items: center; justify-content: space-between;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05); direction: rtl;
    `;
    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #dcfce7; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #22c55e;">
                <i class="fas fa-magic"></i>
            </div>
            <div>
                <strong style="display: block; font-size: 15px;">זיהינו מחירים מיוחדים בהיסטוריה!</strong>
                <span style="font-size: 13px; opacity: 0.9;">ל-${unsyncedCount} לקוחות יש מחירים מהזמנות קודמות שטרם הוגדרו כברירת מחדל.</span>
            </div>
        </div>
        <button onclick="syncClientsPricesFromHistory()" class="header-btn" style="background: #22c55e; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px;">
            <i class="fas fa-sync-alt"></i> סנכרן הכל כעת
        </button>
    `;
    container.parentNode.insertBefore(banner, container.nextSibling);
}

async function syncClientsPricesFromHistory() {
    const btn = event.currentTarget;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מסנכרן...';
    }

    try {
        const session = window.currentUserSession || await Auth.getSession();
        if (!session) return;
        if (!window.clientsData) window.clientsData = {};
        
        let updatedCount = 0;
        window.processedClients.forEach(c => {
            if (c.isFromHistory && c.latestOrderPrice) {
                if (!window.clientsData[c.phoneKey]) window.clientsData[c.phoneKey] = {};
                window.clientsData[c.phoneKey].default_price = c.latestOrderPrice;
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            const { error } = await pensionNetSupabase
                .from('profiles')
                .update({ clients_data: window.clientsData })
                .eq('user_id', session.user.id);

            if (error) throw error;
            showToast(`${updatedCount} מחירים סונכרנו בהצלחה!`, 'success');
            document.getElementById('syncPricesBanner')?.remove();
            processClientsData();
        }
    } catch (err) {
        console.error('Sync error:', err);
        showToast('שגיאה בסנכרון המחירים', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> סנכרן הכל כעת';
        }
    }
}

function filterClientsData(searchTerm) {
  if (!searchTerm) return window.processedClients;
  const term = searchTerm.toLowerCase();
  return window.processedClients.filter(c => 
    c.name.toLowerCase().includes(term) ||
    c.originalPhone.includes(term) ||
    c.phoneKey.includes(term) ||
    (c.city && c.city.toLowerCase().includes(term)) ||
    c.dogsArray.some(d => d.toLowerCase().includes(term))
  );
}

function renderClientsTable() {
  const tbody = document.querySelector("#clientsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  const searchInput = document.getElementById('clientsSearchInput');
  const priceFilter = document.getElementById('clientsPriceFilter')?.value || 'all';
  
  let filtered = filterClientsData(searchInput ? searchInput.value : '');
  
  // Apply Price Filter
  if (priceFilter === 'discounted') {
      filtered = filtered.filter(c => c.customPrice !== null && c.customPrice < 130);
  } else if (priceFilter === 'regular') {
      filtered = filtered.filter(c => c.customPrice === null || c.customPrice >= 130);
  }

  // Apply Sorting
  filtered.sort((a, b) => {
      let valA = a[window.clientsSortField];
      let valB = b[window.clientsSortField];
      
      // Handle nulls
      if (window.clientsSortField === 'customPrice') {
          if (valA === null || valA === undefined) valA = 130;
          if (valB === null || valB === undefined) valB = 130;
      } else {
          if (valA === null || valA === undefined) valA = 0;
          if (valB === null || valB === undefined) valB = 0;
      }
      
      if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
      }
      
      if (valA < valB) return window.clientsSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return window.clientsSortOrder === 'asc' ? 1 : -1;
      return 0;
  });

  const totalRows = filtered.length;
  const maxPage = Math.max(1, Math.ceil(totalRows / CLIENTS_PER_PAGE));
  if (window.clientsCurrentPage > maxPage) window.clientsCurrentPage = maxPage;

  const startIdx = (window.clientsCurrentPage - 1) * CLIENTS_PER_PAGE;
  const pageRows = filtered.slice(startIdx, startIdx + CLIENTS_PER_PAGE);

  pageRows.forEach(c => {
    const tr = document.createElement("tr");
    
    const currentPriceDisplay = c.customPrice ? `₪${c.customPrice}` : '<span style="color:#94a3b8;">רגיל</span>';
    const lastDateDisplay = c.lastOrderDate.getFullYear() > 1970 ? formatDateTime(c.lastOrderDate.toISOString()) : '-';
    const clientNotes = window.clientsData[c.phoneKey]?.notes || '';
    const hasNotes = clientNotes.length > 0;
    
    tr.innerHTML = `
      <td data-label="שם">${c.name}</td>
      <td data-label="טלפון">${createWhatsAppLink(c.originalPhone)}</td>
      <td data-label="עיר מגורים" style="text-align:center;">${c.city || '<span style="color:#94a3b8;">-</span>'}</td>
      <td data-label="כלבים">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-start; align-items: center;">
          ${c.dogsArray.map(dog => {
            const photoData = c.dogPhotos && c.dogPhotos[dog] ? c.dogPhotos[dog] : null;
            const photoUrl = photoData ? photoData.url : null;
            
            let imgHtml = '';
            if (photoUrl) {
              const phone = c.originalPhone;
              imgHtml = `<img src="${photoUrl}" class="dog-thumbnail" style="width:28px; height:28px;" onclick="openImagePreview('${photoUrl}', '${dog.replace(/'/g, "\\'")}', '', '${phone}')" />`;
            } else {
              imgHtml = `<div class="dog-thumbnail-placeholder" style="width:28px; height:28px; font-size: 10px;" title="${window.isDemoMode ? '' : 'לחצו להעלאת תמונה'}" ${window.isDemoMode ? '' : `onclick="triggerDogPhotoUploadFromTable('', '${dog.replace(/'/g, "\\'")}', '${c.originalPhone}')"`}>
                <i class="fas fa-camera" ${window.isDemoMode ? 'style="opacity: 0.3; cursor: default;"' : ''}></i>
              </div>`;
            }

            return `<div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 3px 8px; border-radius: 30px; border: 1px solid #e2e8f0; white-space: nowrap;">
              ${imgHtml}
              <span style="color:#1e293b; font-weight:700; font-size:13px;">${dog}</span>
            </div>`;
          }).join('')}
        </div>
      </td>
      <td data-label="סהכ הזמנות">${c.totalOrders}</td>
      <td data-label="הזמנה אחרונה">${lastDateDisplay}</td>
      <td data-label="הכנסה">₪${c.totalRevenue.toLocaleString()}</td>
      <td data-label="מחיר ברירת מחדל" style="text-align:center;">
        ${c.isFromHistory ? `<span style="color:#22c55e; font-weight:600; font-size:11px; display:block; margin-bottom:2px;"><i class="fas fa-history"></i> מהיסטוריה</span>` : ''}
        ${currentPriceDisplay}
      </td>
      <td data-label="עריכה">
        <div style="display: flex; flex-direction: column; gap: 5px;">
          <button class="header-btn" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color:white; border:none; padding:6px 14px; border-radius: 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 6px rgba(99,102,241,0.3);" 
                  onclick="openEditClientModal('${c.phoneKey}')"
                  onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(99,102,241,0.4)'" 
                  onmouseout="this.style.transform='';this.style.boxShadow='0 2px 6px rgba(99,102,241,0.3)'">
            <i class="fas fa-pen"></i> עריכה
          </button>
          <button class="header-btn" style="background: linear-gradient(135deg, #ef4444, #dc2626); color:white; border:none; padding:6px 14px; border-radius: 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.2);" 
                  onclick="showDeleteClientConfirm('${c.phoneKey}', '${c.name.replace(/'/g, "\\'")}')"
                  onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)'" 
                  onmouseout="this.style.transform='';this.style.boxShadow='0 2px 6px rgba(239, 68, 68, 0.2)'">
            <i class="fas fa-trash-alt"></i> מחיקה
          </button>
          ${hasNotes ? '<div><i class="fas fa-sticky-note" style="color: #f59e0b; margin-right: 6px;" title="יש הערות"></i> יש הערות</div>' : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  renderClientsPagination(totalRows, window.clientsCurrentPage, maxPage);
  updateModeUI();
}

function renderClientsPagination(totalRows, currentPage, maxPage) {
  const container = document.getElementById("clientsPagination");
  if (!container) return;
  let html = "";
  html += `<button class="header-btn" style="background:#f1f5f9; color:#64748b;" onclick="window.clientsCurrentPage--; renderClientsTable()" ${currentPage === 1 ? "disabled" : ""}>הקודם</button>`;
  html += `<span style="margin: 0 15px; font-weight: bold;">עמוד ${currentPage} מתוך ${maxPage} (${totalRows} לקוחות)</span>`;
  html += `<button class="header-btn" style="background:#f1f5f9; color:#64748b;" onclick="window.clientsCurrentPage++; renderClientsTable()" ${currentPage === maxPage ? "disabled" : ""}>הבא</button>`;
  container.innerHTML = html;
}

// Debounced search for clients
const debouncedClientsSearch = debounce(() => {
    window.clientsCurrentPage = 1;
    renderClientsTable();
}, 300);

const clientSearchEl = document.getElementById('clientsSearchInput');
if (clientSearchEl) {
    clientSearchEl.removeAttribute('oninput'); // Remove inline handler
    clientSearchEl.addEventListener('input', debouncedClientsSearch);
}

async function saveClientData(phoneKey, priceValue, cityValue) {
  if (!window.clientsData) window.clientsData = {};
  
  const currentData = window.clientsData[phoneKey] || {};
  const newData = { ...currentData };
  
  if (!priceValue || priceValue === '') {
     delete newData.default_price;
  } else {
     newData.default_price = parseInt(priceValue);
  }
  
  if (!cityValue || cityValue.trim() === '') {
     delete newData.city;
  } else {
     newData.city = cityValue.trim();
  }
  
  if (Object.keys(newData).length === 0) {
     delete window.clientsData[phoneKey];
  } else {
     window.clientsData[phoneKey] = newData;
  }
  
  // Update localcache
  const clientObj = window.processedClients.find(c => c.phoneKey === phoneKey);
  if (clientObj) {
      clientObj.customPrice = priceValue ? parseInt(priceValue) : null;
      clientObj.city = cityValue ? cityValue.trim() : '';
  }
  
  // Save to DB profiles table
  const session = window.currentUserSession;
  if (!session) {
      showToast('נא להתחבר תחילה', 'error');
      return;
  }
  
  try {
    const { error } = await pensionNetSupabase
      .from('profiles')
      .update({ clients_data: window.clientsData })
      .eq('user_id', session.user.id);
      
    if (error) {
      if (error.code === 'PGRST204' || String(error.message).includes('column "clients_data" of relation "profiles" does not exist')) {
          // Graceful degradation to localstorage if migration not run
          localStorage.setItem('pensionNet_clientsData_fallback_' + session.user.id, JSON.stringify(window.clientsData));
          showToast('הנתונים נשמרו מקומית (דרוש עדכון מסד נתונים)', 'success');
      } else {
          throw error;
      }
    } else {
        showToast('נתוני הלקוח נשמרו בהצלחה', 'success');
    }
    renderClientsTable();
  } catch (err) {
    console.error('Error saving client data:', err);
    showToast('שגיאה בשמירת נתוני לקוח', 'error');
  }
}

function showDeleteClientConfirm(phoneKey, clientName) {
    showConfirm(
        '<i class="fas fa-trash-alt" style="color: #ef4444;"></i> מחיקת לקוח',
        `האם אתה בטוח שברצונך למחוק את הלקוח <b>${clientName}</b>?<br><br>פעולה זו תמחק את <b>כל</b> ההזמנות של הלקוח וכל המידע הקשור אליו מהמערכת לצמיתות.`,
        () => deleteClient(phoneKey)
    );
}

async function deleteClient(phoneKey) {
    const clientObj = (window.processedClients || []).find(c => c.phoneKey === phoneKey);
    if (!clientObj) {
        showToast('לקוח לא נמצא', 'error');
        return;
    }

    const session = window.currentUserSession;
    if (!session) {
        showToast('יש להתחבר תחילה', 'error');
        return;
    }

    try {
        // 1. Delete all orders for this client
        const { error: ordersError } = await pensionNetSupabase
            .from('orders')
            .delete()
            .eq('phone', clientObj.originalPhone);

        if (ordersError) throw ordersError;

        // 2. Remove from clients_data in profile
        if (window.clientsData && window.clientsData[phoneKey]) {
            delete window.clientsData[phoneKey];
            const { error: profileError } = await pensionNetSupabase
                .from('profiles')
                .update({ clients_data: window.clientsData })
                .eq('user_id', session.user.id);
            
            if (profileError) {
                // Ignore error if it's just missing column (saved to fallback earlier)
                if (!profileError.code === 'PGRST204') throw profileError;
            }
        }

        // Search and delete in fallback as well
        const fallbackKey = 'pensionNet_clientsData_fallback_' + session.user.id;
        const localFallback = localStorage.getItem(fallbackKey);
        if (localFallback) {
            try {
                let data = JSON.parse(localFallback);
                if (data[phoneKey]) {
                    delete data[phoneKey];
                    localStorage.setItem(fallbackKey, JSON.stringify(data));
                }
            } catch(e) {}
        }

        showToast(`הלקוח ${clientObj.name} נמחק בהצלחה`, 'success');
        
        // Audit log
        createAuditLog('DELETE', `מחיקת לקוח לצמיתות: ${clientObj.name} (${clientObj.originalPhone})`, null);
        
        // Refresh
        loadData();
    } catch (err) {
        console.error('Error deleting client:', err);
        showToast('שגיאה במחיקת הלקוח', 'error');
    }
}

// --- Edit Client Modal ---
function openEditClientModal(phoneKey) {
  const client = window.processedClients?.find(c => c.phoneKey === phoneKey);
  if (!client) {
    showToast('לא נמצאו נתוני לקוח', 'error');
    return;
  }

  const clientData = window.clientsData[phoneKey] || {};

  document.getElementById('editClientPhoneKey').value = phoneKey;
  document.getElementById('editClientOriginalPhone').value = client.originalPhone;
  document.getElementById('editClientName').value = client.name || '';
  document.getElementById('editClientPhone').value = client.originalPhone || '';
  document.getElementById('editClientCity').value = clientData.city || client.city || '';
  document.getElementById('editClientPrice').value = clientData.default_price || '';
  document.getElementById('editClientNotes').value = clientData.notes || '';
  document.getElementById('editClientSubtitle').textContent = client.name || 'עדכון נתונים';

  // Render dog tags with edit/delete inputs
  const dogsList = document.getElementById('editClientDogsList');
  if (dogsList) {
    if (client.dogsArray && client.dogsArray.length > 0) {
      dogsList.innerHTML = client.dogsArray.map((dog, index) => {
        const photo = client.dogPhotos?.[dog]?.url;
        return `
        <div class="edit-dog-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #f1f5f9;">
          <div style="flex-shrink: 0; position: relative; width: 44px; height: 44px;">
            ${photo ? `
              <img src="${photo}" class="dog-thumbnail" style="width: 100%; height: 100%;" />
              <div style="position: absolute; bottom: -2px; right: -2px; background: #6366f1; color: white; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; border: 1.5px solid white; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" title="שנה תמונה" onclick="document.getElementById('adminDogPhotoInput-${index}').click()">
                <i class="fas fa-camera"></i>
              </div>
              <div style="position: absolute; top: -2px; right: -2px; background: rgba(255,255,255,0.9); color: #64748b; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; border: 1.5px solid #e2e8f0; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" title="צפה בתמונה" onclick="openImagePreview('${photo}', '${dog.replace(/'/g, "\\'")}', '', '')">
                <i class="fas fa-eye"></i>
              </div>
            ` : `
              <div class="dog-thumbnail-placeholder" style="width: 100%; height: 100%; border-style: solid; background: #f8fafc;" ${window.isDemoMode ? '' : `onclick="document.getElementById('adminDogPhotoInput-${index}').click()"`}>
                <i class="fas fa-camera" ${window.isDemoMode ? 'style="opacity: 0.3; cursor: default;"' : ''}></i>
              </div>
            `}
            <input type="file" id="adminDogPhotoInput-${index}" style="display: none;" accept="image/*" onchange="handleAdminDogPhotoUpload(event, '${dog.replace(/'/g, "\\'")}', '${phoneKey}')">
          </div>
          <div style="position: relative; flex: 1;">
            <i class="fas fa-dog" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #f59e0b; font-size: 12px;"></i>
            <input type="text" class="edit-dog-name-input" data-original-name="${dog}" value="${dog}" 
                   style="width: 100%; padding: 8px 30px 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none;"
                   onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e2e8f0'">
          </div>
          <div class="edit-dog-actions" style="display: flex; gap: 4px;">
            <button type="button" onclick="this.parentElement.parentElement.remove()" 
                    style="background: #fee2e2; color: #ef4444; border: none; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                    onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'"
                    title="מחק כלב">
              <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
            </button>
          </div>
        </div>
      `}).join('');
    } else {
      dogsList.innerHTML = '<span style="color: #94a3b8; font-size: 13px;">אין כלבים משויכים</span>';
    }
  }

  // Render order notes history (aggregated admin notes from all orders)
  const orderNotesHistory = document.getElementById('editClientOrderNotesHistory');
  if (orderNotesHistory) {
    if (client.orderAdminNotes && client.orderAdminNotes.length > 0) {
      // Sort by date descending
      const sortedNotes = [...client.orderAdminNotes].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      orderNotesHistory.innerHTML = sortedNotes.map(note => {
        return `
          <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #fde68a; font-size: 13px; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #d97706; font-weight: 700; font-size: 11px;">
              <span><i class="fas fa-user-edit"></i> ${note.author || 'מערכת'} (${note.dog})</span>
              <span>${formatDateOnly(note.timestamp)}</span>
            </div>
            <div style="color: #1e293b;">${(note.content || '').replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }).join('');
    } else {
      orderNotesHistory.innerHTML = '<span style="color: #94a3b8; font-size: 13px;">אין הערות מנהל מהזמנות קודמות</span>';
    }
  }

  document.getElementById('editClientModal').style.display = 'block';
}

function closeEditClientModal() {
  document.getElementById('editClientModal').style.display = 'none';
}

async function saveEditClient() {
  const saveBtn = document.getElementById('saveEditClientBtn');
  const originalBtnHTML = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';

  try {
    const phoneKey = document.getElementById('editClientPhoneKey').value;
    const originalPhone = document.getElementById('editClientOriginalPhone').value;
    const newName = document.getElementById('editClientName').value.trim();
    const newPhone = document.getElementById('editClientPhone').value.trim();
    const newCity = document.getElementById('editClientCity').value.trim();
    const newPrice = document.getElementById('editClientPrice').value;
    const newNotes = document.getElementById('editClientNotes').value.trim();

    if (!newName) {
      showToast('חובה למלא שם לקוח', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnHTML;
      return;
    }

    if (!newPhone) {
      showToast('חובה למלא מספר טלפון', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnHTML;
      return;
    }

    const session = window.currentUserSession;
    if (!session) {
      showToast('נא להתחבר תחילה', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnHTML;
      return;
    }

    // 1. Update client metadata (city, price, notes) in profiles.clients_data
    if (!window.clientsData) window.clientsData = {};
    const currentData = window.clientsData[phoneKey] || {};
    const newData = { ...currentData };

    if (newCity) newData.city = newCity;
    else delete newData.city;

    if (newPrice && newPrice !== '') newData.default_price = parseInt(newPrice);
    else delete newData.default_price;

    if (newNotes) newData.notes = newNotes;
    else delete newData.notes;

    // Calculate new phone key
    const newPhoneKey = formatPhoneKey(newPhone);
    
    // If phone changed, migrate client data to new key
    if (newPhoneKey !== phoneKey) {
      delete window.clientsData[phoneKey];
      if (Object.keys(newData).length > 0) {
        window.clientsData[newPhoneKey] = newData;
      }
    } else {
      if (Object.keys(newData).length === 0) {
        delete window.clientsData[phoneKey];
      } else {
        window.clientsData[phoneKey] = newData;
      }
    }

    // 2. Save clients_data to profiles
    const { error: profileError } = await pensionNetSupabase
      .from('profiles')
      .update({ clients_data: window.clientsData })
      .eq('user_id', session.user.id);

    if (profileError) {
      if (profileError.code === 'PGRST204' || String(profileError.message).includes('clients_data')) {
        localStorage.setItem('pensionNet_clientsData_fallback_' + session.user.id, JSON.stringify(window.clientsData));
      } else {
        throw profileError;
      }
    }

    // 3. Update related orders (Name, Phone, and Dogs)
    const client = window.processedClients?.find(c => c.phoneKey === phoneKey);
    const hasNameChanged = client && newName !== client.name;
    const hasPhoneChanged = newPhone !== originalPhone;

    // Get dog changes
    const dogInputs = document.querySelectorAll('.edit-dog-name-input');
    const dogChanges = []; // { original, current, type: 'rename' | 'delete' }
    
    // Find renames
    dogInputs.forEach(input => {
      const original = input.dataset.originalName;
      const current = input.value.trim();
      if (current && original !== current) {
        dogChanges.push({ original, current, type: 'rename' });
      }
    });

    // Find deletions
    if (client && client.dogsArray) {
      client.dogsArray.forEach(original => {
        const stillExists = Array.from(dogInputs).some(input => input.dataset.originalName === original);
        if (!stillExists) {
          dogChanges.push({ original, type: 'delete' });
        }
      });
    }

    if (hasNameChanged || hasPhoneChanged || dogChanges.length > 0) {
      // Find all orders matching the original phone
      const matchingOrders = (window.allOrdersCache || []).filter(o => {
        const oKey = formatPhoneKey(o.phone);
        return oKey === phoneKey;
      });

      if (matchingOrders.length > 0) {
        // Prepare bulk update or individual updates for dogs
        // For performance and reliability, we'll iterate through changes
        for (const change of dogChanges) {
          const matchingDogOrders = matchingOrders.filter(o => o.dog_name === change.original);
          if (matchingDogOrders.length > 0) {
            const dogOrderIds = matchingDogOrders.map(o => o.id);
            const newDogName = change.type === 'rename' ? change.current : '[נמחק]';
            
            await pensionNetSupabase
              .from('orders')
              .update({ dog_name: newDogName })
              .in('id', dogOrderIds);
            
            // Update local cache
            matchingDogOrders.forEach(o => o.dog_name = newDogName);
          }
        }

        // Handle Name/Phone changes for ALL orders of this client
        if (hasNameChanged || hasPhoneChanged) {
          const orderUpdateData = {};
          if (hasNameChanged) orderUpdateData.owner_name = newName;
          if (hasPhoneChanged) orderUpdateData.phone = newPhone;

          const orderIds = matchingOrders.map(o => o.id);
          await pensionNetSupabase
            .from('orders')
            .update(orderUpdateData)
            .in('id', orderIds);

          // Update local cache
          matchingOrders.forEach(o => {
            if (hasNameChanged) o.owner_name = newName;
            if (hasPhoneChanged) o.phone = newPhone;
          });
        }
      }

      // Create audit log
      const changes = [];
      if (hasNameChanged) changes.push(`שם: ${client.name} → ${newName}`);
      if (hasPhoneChanged) changes.push(`טלפון: ${originalPhone} → ${newPhone}`);
      if (newCity !== (client?.city || '')) changes.push(`עיר: ${newCity || 'ריק'}`);
      dogChanges.forEach(dc => {
        if (dc.type === 'rename') changes.push(`שינוי שם כלב: ${dc.original} → ${dc.current}`);
        if (dc.type === 'delete') changes.push(`מחיקת כלב: ${dc.original}`);
      });
      if (newPrice !== String(client?.customPrice || '')) changes.push(`מחיר: ${newPrice || 'רגיל'}`);
      
      await createAuditLog('UPDATE', `עדכון פרטי לקוח "${newName}": ${changes.join(', ')}`);
    } else {
      await createAuditLog('UPDATE', `עדכון נתוני לקוח "${newName}"`);
    }

    showToast('פרטי הלקוח עודכנו בהצלחה!', 'success');
    closeEditClientModal();
    
    // Re-process and re-render clients
    processClientsData();
    
    // Also refresh the main tables if name/phone changed
    if (hasNameChanged || hasPhoneChanged) {
      renderFutureOrdersTable();
      renderPastOrdersTable();
    }

  } catch (err) {
    console.error('Error saving client edit:', err);
    showToast('שגיאה בשמירת נתוני הלקוח: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalBtnHTML;
  }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
  const editModal = document.getElementById('editClientModal');
  if (e.target === editModal) {
    closeEditClientModal();
  }
});

// Custom Calendar Events Management
function selectEventColor(el) {
  // Deselect all swatches
  document.querySelectorAll('#eventColorSwatches .color-swatch').forEach(swatch => {
    swatch.classList.remove('selected');
    swatch.innerHTML = '';
    swatch.style.border = '3px solid transparent';
    swatch.style.transform = 'scale(1)';
    swatch.style.boxShadow = 'none';
    // Re-attach hover
    swatch.onmouseout = function() { this.style.transform = 'scale(1)'; };
  });
  
  // Select clicked swatch
  el.classList.add('selected');
  el.innerHTML = '<i class="fas fa-check" style="color: white; font-size: 14px;"></i>';
  const color = el.dataset.color;
  el.style.border = '3px solid ' + darkenColor(color);
  el.style.transform = 'scale(1.1)';
  el.style.boxShadow = '0 0 0 3px ' + color + '4d';
  el.onmouseout = function() { this.style.transform = 'scale(1.1)'; };
  
  document.getElementById('eventColor').value = color;
}

function darkenColor(hex) {
  let r = parseInt(hex.slice(1,3), 16);
  let g = parseInt(hex.slice(3,5), 16);
  let b = parseInt(hex.slice(5,7), 16);
  r = Math.max(0, r - 60);
  g = Math.max(0, g - 60);
  b = Math.max(0, b - 60);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function openCustomEventModal() {
  document.getElementById('eventName').value = '';
  document.getElementById('eventColor').value = '#60a5fa';
  
  // Reset color swatches
  document.querySelectorAll('#eventColorSwatches .color-swatch').forEach(swatch => {
    swatch.classList.remove('selected');
    swatch.innerHTML = '';
    swatch.style.border = '3px solid transparent';
    swatch.style.transform = 'scale(1)';
    swatch.style.boxShadow = 'none';
    swatch.onmouseout = function() { this.style.transform = 'scale(1)'; };
  });
  // Select default (blue)
  const defaultSwatch = document.querySelector('#eventColorSwatches .color-swatch[data-color="#60a5fa"]');
  if (defaultSwatch) selectEventColor(defaultSwatch);
  
  // Make sure flatpickr is initialized on these inputs
  if (typeof flatpickr !== 'undefined') {
      window._eventEndPicker = flatpickr('#eventEndDate', {
         locale: "he",
         dateFormat: "Y-m-d",
         altInput: true,
         altFormat: "d/m/Y",
         allowInput: false,
         disableMobile: true,
         prevArrow: "<svg viewBox='0 0 17 17'><path d='M13.207 8.472l-7.854 7.854-0.707-0.707 7.146-7.146-7.146-7.148 0.707-0.707 7.854 7.854z' /></svg>",
         nextArrow: "<svg viewBox='0 0 17 17'><path d='M5.207 8.471l7.146 7.147-0.707 0.707-7.853-7.854 7.854-7.853 0.707 0.707-7.147 7.146z' /></svg>",
         onOpen: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add("premium-datepicker");
            instance.calendarContainer.setAttribute('dir', 'rtl');
         }
      });
      window._eventEndPicker.clear();

      flatpickr('#eventStartDate', {
         locale: "he",
         dateFormat: "Y-m-d",
         altInput: true,
         altFormat: "d/m/Y",
         allowInput: false,
         disableMobile: true,
         prevArrow: "<svg viewBox='0 0 17 17'><path d='M13.207 8.472l-7.854 7.854-0.707-0.707 7.146-7.146-7.146-7.148 0.707-0.707 7.854 7.854z' /></svg>",
         nextArrow: "<svg viewBox='0 0 17 17'><path d='M5.207 8.471l7.146 7.147-0.707 0.707-7.853-7.854 7.854-7.853 0.707 0.707-7.147 7.146z' /></svg>",
         onOpen: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add("premium-datepicker");
            instance.calendarContainer.setAttribute('dir', 'rtl');
         },
         onChange: function(selectedDates, dateStr) {
            if (selectedDates.length > 0 && window._eventEndPicker) {
               window._eventEndPicker.setDate(selectedDates[0], true);
            }
         }
      }).clear();
  } else {
      document.getElementById('eventStartDate').value = '';
      document.getElementById('eventEndDate').value = '';
  }
  
  document.getElementById('customEventModal').style.display = 'block';
}

function closeCustomEventModal() {
  document.getElementById('customEventModal').style.display = 'none';
}

document.getElementById('customEventForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const title = document.getElementById('eventName').value;
  const startDate = document.getElementById('eventStartDate').value;
  const endDate = document.getElementById('eventEndDate').value;
  const color = document.getElementById('eventColor').value;
  
  if (!startDate || !endDate) return;
  if (startDate > endDate) {
    showToast('תאריך התחלה חייב להיות לפני תאריך סיום', 'error');
    return;
  }
  
  const session = window.currentUserSession;
  if (!session) {
    showToast('נא להתחבר תחילה', 'error');
    return;
  }
  
  const newEvent = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    title: title,
    start_date: startDate,
    end_date: endDate,
    color: color
  };
  
  const updatedEvents = [...(window.pensionCustomEvents || []), newEvent];
  
  const submitBtn = this.querySelector('button[type="submit"]');
  const orgText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';
  
  try {
    const { error } = await pensionNetSupabase
      .from('profiles')
      .update({ custom_events: updatedEvents })
      .eq('user_id', session.user.id);
      
    if (error) throw error;
    
    window.pensionCustomEvents = updatedEvents;
    showToast('אירוע נוסף בהצלחה', 'success');
    closeCustomEventModal();
    renderMonthlyCalendar(window.allOrdersCache); // Re-render calendar
  } catch (err) {
    console.error('Error saving custom event:', err);
    // Silent degradation fallback
    if (err.code === 'PGRST204' || String(err.message).includes('custom_events')) {
       showToast('יש להריץ את סקריפט ה-SQL לעדכון מסד הנתונים', 'error');
    } else {
       showToast('שגיאה בשמירת האירוע', 'error');
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = orgText;
  }
});

function promptDeleteCustomEvent(eventId) {
    // Only managers can delete events
    if (!window.isAdminMode) {
        showToast('רק מנהל יכול למחוק אירועים', 'error');
        return;
    }
    
    showConfirm(
        '<i class="fas fa-trash-alt" style="color: #ef4444;"></i> מחיקת אירוע מותאם אישית',
        'האם אתה בטוח שברצונך למחוק אירוע זה? פעולה זו אינה הפיכה.',
        async () => {
            const session = window.currentUserSession;
            if (!session) return;
            
            const updatedEvents = window.pensionCustomEvents.filter(ev => ev.id !== eventId);
            
            try {
                const { error } = await pensionNetSupabase
                    .from('profiles')
                    .update({ custom_events: updatedEvents })
                    .eq('user_id', session.user.id);
                    
                if (error) throw error;
                
                window.pensionCustomEvents = updatedEvents;
                showToast('אירוע נמחק בהצלחה', 'success');
                renderMonthlyCalendar(window.allOrdersCache);
            } catch (err) {
                console.error('Error deleting custom event:', err);
                showToast('שגיאה במחיקת אירוע', 'error');
            }
        }
    );
}
// --- Photo Upload Handling ---
async function uploadDogPhoto(file, userId) {
  if (!file) return null;
  
  const client = pensionNetSupabase;
  if (!client) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  try {
    const { data, error } = await client.storage
      .from('dog-photos')
      .upload(filePath, file);

    if (error) {
      console.error('Photo upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = client.storage
      .from('dog-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('Photo upload exception:', err);
    return null;
  }
}

async function handleAdminDogPhotoUpload(event, dogName, phoneKey) {
  const file = event.target.files[0];
  if (!file) return;

  const btn = event.target.parentElement;
  if (!btn) return;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  try {
    const session = window.currentUserSession;
    if (!session) throw new Error('No session');

    const photoUrl = await uploadDogPhoto(file, session.user.id);
    if (!photoUrl) throw new Error('העלאת התמונה נכשלה. אנא וודאו שקיים Bucket בשם dog-photos ב-Supabase.');

    // Update ALL orders for this dog and client to have this photo
    const originalPhone = document.getElementById('editClientOriginalPhone').value;
    const { error } = await pensionNetSupabase
      .from('orders')
      .update({ dog_photo: photoUrl })
      .eq('phone', originalPhone)
      .eq('dog_name', dogName)
      .eq('user_id', session.user.id);

    if (error) throw error;

    showToast('התמונה עודכנה בהצלחה!', 'success');
    
    // Refresh all data to update cache
    await loadData();
    // Re-open modal to show updated image
    openEditClientModal(phoneKey);
  } catch (err) {
    console.error('Admin photo upload error:', err);
    showToast('שגיאה בהעלאת תמונה: ' + err.message, 'error');
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

async function triggerDogPhotoUploadFromTable(orderId, dogName, phone) {
  // Create a hidden file input if it doesn't exist
  let input = document.getElementById('tableDogPhotoInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'tableDogPhotoInput';
    input.style.display = 'none';
    input.accept = 'image/*';
    document.body.appendChild(input);
  }
  
  input.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    showToast('מעלה תמונה...', 'info');
    
    try {
      const session = window.currentUserSession;
      if (!session) throw new Error('No session');
      
      const photoUrl = await uploadDogPhoto(file, session.user.id);
      if (!photoUrl) throw new Error('העלאת תמונה נכשלה. אנא וודאו שקיים Bucket בשם dog-photos ב-Supabase.');
      
      // Update ALL orders for this dog and client (using the clean phone from createAuditLog/processClients style)
      // Actually, order table has the original phone string
      const { error } = await pensionNetSupabase
        .from('orders')
        .update({ dog_photo: photoUrl })
        .eq('phone', phone)
        .eq('dog_name', dogName)
        .eq('user_id', session.user.id);
        
      if (error) throw error;
      
      showToast('תמונה הועלתה והתעדכנה בהצלחה!', 'success');
      await loadData(); // Refresh tables
    } catch(err) {
      console.error(err);
      showToast('שגיאה בהעלאה: ' + err.message, 'error');
    } finally {
      input.value = ''; // Reset for next use
    }
  };
  
  input.click();
}

function getDogColor(dogName, phone) {
  const trackColors = [
    { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' }, // כחול
    { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' }, // ענבר
    { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' }, // ירוק
    { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' }, // אדום
    { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6' }, // סגול
    { bg: '#fae8ff', border: '#f5d0fe', text: '#86198f' }, // ורוד
    { bg: '#ffedd5', border: '#fdba74', text: '#9a3412' }, // כתום
    { bg: '#ecfeff', border: '#a5f3fc', text: '#083344' }  // ציאן
  ];
  
  // Hash פשוט לפי שם וטלפון כדי שהצבע יישמר תמיד לאותו כלב
  const str = `${phone}-${dogName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % trackColors.length;
  return trackColors[index];
}

// --- Image Preview Logic ---
function openImagePreview(url, title, orderId, phone) {
  const modal = document.getElementById('imagePreviewModal');
  const img = document.getElementById('previewModalImg');
  const titleEl = document.getElementById('previewModalTitle');
  const changeBtn = document.getElementById('previewModalChangeBtn');

  if (modal && img) {
    img.src = url;
    if (titleEl) titleEl.textContent = title || 'תצוגת תמונה';
    
    if (changeBtn && orderId && phone) {
        changeBtn.style.display = 'flex';
        changeBtn.onclick = () => {
            closeImagePreview();
            triggerDogPhotoUploadFromTable(orderId, title, phone);
        };
    } else if (changeBtn) {
        changeBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
  }
}

function closeImagePreview() {
  const modal = document.getElementById('imagePreviewModal');
  if (modal) modal.style.display = 'none';
}

window.openImagePreview = openImagePreview;
window.closeImagePreview = closeImagePreview;
// --- Helper for Demo Mode ---
function generateLocalDemoData() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dayMs = 86400000;
    
    // Helper to format date with specific time
    const ft = (d, h, m) => {
        const date = new Date(d);
        date.setHours(h, m, 0, 0);
        return date.toISOString();
    };
    
    // Helper to format date
    const f = (d) => d.toISOString().split('T')[0];
    
    const termsSuffix = ' ✅ הלקוח/ה אישר/ה תנאי שימוש';
    
    const demoOrders = [
        // --- TODAY'S MOVEMENTS ---
        {
            id: 'demo-today-in',
            order_date: ft(new Date(today.getTime() - 7 * dayMs), 10, 15),
            owner_name: 'שרה לוי',
            dog_name: 'בל',
            dog_age: '2',
            dog_breed: 'קטן',
            neutered: 'כן (מעוקרת)',
            notes: 'פחדנית מרעשים' + termsSuffix,
            phone: '0522222222',
            check_in: f(today),
            check_out: f(new Date(today.getTime() + 5 * dayMs)),
            status: 'מאושר',
            is_arrived: false,
            is_paid: false,
            price_per_day: 150,
            admin_note: 'צריכה הרבה יחס'
        },
        {
            id: 'demo-today-out',
            order_date: ft(new Date(today.getTime() - 14 * dayMs), 14, 30),
            owner_name: 'יוסי כהן',
            dog_name: 'רקס',
            dog_age: '4',
            dog_breed: 'גדול',
            neutered: 'כן (מסורס)',
            notes: 'אוכל פעמיים ביום' + termsSuffix,
            phone: '0501111111',
            check_in: f(new Date(today.getTime() - 5 * dayMs)),
            check_out: f(today),
            status: 'מאושר',
            is_arrived: true,
            is_paid: true,
            price_per_day: 130,
            admin_note: 'בחדר גדול'
        },
        // --- ACTIVE / STAYING ---
        {
            id: 'demo-stay-1',
            order_date: ft(new Date(today.getTime() - 10 * dayMs), 11, 45),
            owner_name: 'דני רובס',
            dog_name: 'סימבה',
            dog_age: '6',
            dog_breed: 'בינוני',
            neutered: 'כן (מסורס)',
            notes: 'אוהב כדורים' + termsSuffix,
            phone: '0543333333',
            check_in: f(new Date(today.getTime() - 3 * dayMs)),
            check_out: f(new Date(today.getTime() + 4 * dayMs)),
            status: 'מאושר',
            is_arrived: true,
            is_paid: true,
            price_per_day: 140,
            admin_note: 'לקוח VIP'
        },
        // --- FUTURE ---
        {
            id: 'demo-future-1',
            order_date: ft(new Date(today.getTime() - 2 * dayMs), 9, 20),
            owner_name: 'מיכל ירון',
            dog_name: 'צ׳ארלי',
            dog_age: '1',
            dog_breed: 'קטן',
            neutered: 'לא',
            notes: 'גור אנרגטי' + termsSuffix,
            phone: '0504444444',
            check_in: f(new Date(today.getTime() + 2 * dayMs)),
            check_out: f(new Date(today.getTime() + 8 * dayMs)),
            status: 'ממתין',
            is_arrived: false,
            is_paid: false,
            price_per_day: 140,
            admin_note: 'להוציא הרבה לחצר'
        },
        {
            id: 'demo-future-2',
            order_date: ft(new Date(today.getTime() - 1 * dayMs), 16, 10),
            owner_name: 'אביב גפן',
            dog_name: 'לוקה',
            dog_age: '8',
            dog_breed: 'גדול',
            neutered: 'כן (מעוקרת)',
            notes: 'כלב מבוגר ושקט' + termsSuffix,
            phone: '0525555555',
            check_in: f(new Date(today.getTime() + 10 * dayMs)),
            check_out: f(new Date(today.getTime() + 15 * dayMs)),
            status: 'ממתין',
            is_arrived: false,
            is_paid: false,
            price_per_day: 130,
            admin_note: 'תרופות בבוקר'
        },
        {
            id: 'demo-future-3',
            order_date: ft(new Date(today.getTime() - 4 * dayMs), 18, 55),
            owner_name: 'נועה קירל',
            dog_name: 'ביגי',
            dog_age: '3',
            dog_breed: 'בינוני',
            neutered: 'כן (מסורס)',
            notes: 'אוהב לשחק' + termsSuffix,
            phone: '0546666666',
            check_in: f(new Date(today.getTime() + 15 * dayMs)),
            check_out: f(new Date(today.getTime() + 20 * dayMs)),
            status: 'מאושר',
            is_arrived: false,
            is_paid: true,
            price_per_day: 140,
            admin_note: 'לקוחה מפורסמת'
        },
        // --- HISTORY ---
        {
            id: 'demo-history-1',
            order_date: ft(new Date(today.getTime() - 45 * dayMs), 12, 5),
            owner_name: 'רון שחר',
            dog_name: 'מקס',
            dog_age: '7',
            dog_breed: 'בינוני',
            neutered: 'לא',
            notes: 'דומיננטי' + termsSuffix,
            phone: '0525555555',
            check_in: f(new Date(today.getTime() - 40 * dayMs)),
            check_out: f(new Date(today.getTime() - 35 * dayMs)),
            status: 'מאושר',
            is_arrived: true,
            is_departed: true,
            is_paid: true,
            price_per_day: 140,
            admin_note: 'להפריד מאחרים'
        },
        {
            id: 'demo-history-2',
            order_date: ft(new Date(today.getTime() - 60 * dayMs), 8, 40),
            owner_name: 'מיכל אברהם',
            dog_name: 'בוני',
            dog_age: '5',
            dog_breed: 'קטן',
            neutered: 'כן (מעוקרת)',
            notes: 'זקוק לסירוק יומי' + termsSuffix,
            phone: '0504444444',
            check_in: f(new Date(today.getTime() - 55 * dayMs)),
            check_out: f(new Date(today.getTime() - 50 * dayMs)),
            status: 'מאושר',
            is_arrived: true,
            is_departed: true,
            is_paid: true,
            price_per_day: 120,
            admin_note: 'כלב חמוד מאוד'
        }
    ];
    return demoOrders;
}
