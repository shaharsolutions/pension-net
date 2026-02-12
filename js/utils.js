/**
 * Pension-Net - Utility Functions
 * פונקציות עזר משותפות לכל המערכת
 */

// --- Date Utils ---

function calculateDays(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDateToISO(date) {
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - (offset * 60 * 1000));
  return adjusted.toISOString().split('T')[0];
}

function formatDateWithDay(dateString) {
  const daysHebrew = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const date = new Date(dateString);
  if (isNaN(date)) return '';
  const day = ('0' + date.getDate()).slice(-2);
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const year = date.getFullYear();
  const dayName = daysHebrew[date.getDay()];
  return `${day}/${month}/${year} (${dayName})`;
}

function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

// --- Currency Utils ---

function formatCurrency(amount) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0
  }).format(amount);
}

// --- Phone Utils ---

function cleanPhoneNumber(phone) {
  return phone.replace(/[\s\-]/g, '');
}

function isValidIsraeliPhone(phone) {
  const cleaned = cleanPhoneNumber(phone);
  return /^05\d{8}$/.test(cleaned);
}

// --- UI Utils ---

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '10000';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.background = type === 'error' ? '#f44336' : '#667eea';
  toast.style.color = 'white';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '50px';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  toast.style.marginBottom = '10px';
  toast.style.fontWeight = '600';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s, transform 0.3s';
  toast.style.transform = 'translateY(-20px)';
  
  toast.innerHTML = message;
  
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Optimization Utils ---

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- Supabase Helper ---
function getSupabase() {
  // If we have a cached instance, return it
  if (window._supabaseInstance) return window._supabaseInstance;

  // Search for the client in other global locations (like auth.js)
  if (typeof supabaseClient !== 'undefined') {
    window._supabaseInstance = supabaseClient;
    return window._supabaseInstance;
  }
  
  if (typeof SUPABASE_CONFIG === 'undefined') {
    console.error('SUPABASE_CONFIG not defined. Ensure config.js is loaded.');
    return null;
  }
  
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
        window._supabaseInstance = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        console.log('Supabase client initialized successfully.');
        return window._supabaseInstance;
    } catch (e) {
        console.error("Failed to create Supabase client:", e);
        return null;
    }
  } else {
      console.error("Supabase library not loaded yet or failed. Check script tags in order.html.");
      return null;
  }
}

// Export for Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateDays,
    formatDateWithDay,
    formatDateTime,
    formatCurrency,
    debounce,
    showToast,
    getSupabase
  };
}
