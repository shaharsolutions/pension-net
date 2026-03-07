// Initialize constants from config (or fallbacks)
const SUPABASE_URL = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.URL : '';
const SUPABASE_ANON_KEY = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.ANON_KEY : '';

let ADMIN_PHONE = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.ADMIN_PHONE : '972528366744';
let BUSINESS_NAME = 'פנסיון לכלבים';

// Initialize Supabase
const pensionNetSupabase = getSupabase();

// State variables
let currentStep = 0;
let previousOrders = [];
let lastSearchedPhone = '';
let currentCapacityDate = new Date();
let selectionPhase = 1; // 1: Selecting check-in, 2: Selecting check-out

// Get owner ID from URL (e.g. order.html?owner=UUID)
const urlParams = new URLSearchParams(window.location.search);
let PENSION_OWNER_ID = urlParams.get('owner');

// Handle missing owner ID - try to get from session if logged in (for testing)
async function ensureOwnerId() {
  if (!PENSION_OWNER_ID && typeof Auth !== 'undefined') {
    const session = await Auth.getSession();
    if (session && session.user) {
      PENSION_OWNER_ID = session.user.id;
      console.log("Using owner ID from session:", PENSION_OWNER_ID);
    }
  }
  
  if (!PENSION_OWNER_ID) {
    console.warn("Owner ID not specified in URL. Booking might not be saved correctly.");
  }
}

// Initial ID check will be handled in DOMContentLoaded instead to avoid double calls


// --- Functions ---

async function loadOwnerInfo() {
  const client = getSupabase();
  if (!client) {
    console.error('Supabase client not ready for loadOwnerInfo. Retrying in 500ms...');
    setTimeout(loadOwnerInfo, 500);
    return;
  }

  console.log('Fetching profile for owner:', PENSION_OWNER_ID);
  try {
    const { data: profiles, error } = await client
      .from('profiles')
      .select('phone, business_name, location, default_price, clients_data')
      .eq('user_id', PENSION_OWNER_ID);
    
    if (error) {
      console.error('Profile fetch error:', error);
      throw error;
    }
    
    const profile = profiles && profiles.length > 0 ? profiles[0] : null;
    window.pensionProfile = profile;
    console.log('Profile data found:', profile);
    console.log('clients_data from DB:', profile?.clients_data);
    console.log('default_price from DB:', profile?.default_price);
    
    if (profile) {
      if (profile.phone) ADMIN_PHONE = profile.phone;
      if (profile.business_name && profile.business_name.trim()) {
        BUSINESS_NAME = profile.business_name;
        // Make the main title dynamic as requested: Emoji + Text + Business Name
        const h1 = document.querySelector('.header h1');
        if (h1) h1.innerHTML = `<i class="fas fa-paw"></i> הזמנת מקום בפנסיון כלבים - ${BUSINESS_NAME}`;
      }
      
      document.title = `הזמנת מקום - ${BUSINESS_NAME}`;
      
      const headerSub = document.getElementById('header-business-name');
      if (headerSub) {
        // If we have a location, show it. Otherwise show nothing or a clean separator.
        headerSub.textContent = profile.location ? `📍 ${profile.location}` : (profile.business_name || 'פנסיון לכלבים');
        headerSub.style.fontWeight = '800';
      }
      
      const successPhoneEl = document.getElementById('displayAdminPhone');
      if (successPhoneEl) successPhoneEl.textContent = ADMIN_PHONE;
    } else {
      // Profile NOT found at all
      console.warn('Owner profile row missing in database for ID:', PENSION_OWNER_ID);
      const headerSub = document.getElementById('header-business-name');
      if (headerSub) headerSub.textContent = 'פנסיון לכלבים';
      
      const h1 = document.querySelector('.header h1');
      if (h1) h1.innerHTML = `<i class="fas fa-paw"></i> הזמנת מקום בפנסיון כלבים`;
    }
  } catch (err) {
    console.error('Error loading owner info:', err);
    const headerSub = document.getElementById('header-business-name');
    if (headerSub) headerSub.textContent = 'פנסיון לכלבים';
  }
}

async function loadMonthlyCapacity() {
  if (!PENSION_OWNER_ID) {
    console.warn("Cannot load capacity: PENSION_OWNER_ID is missing.");
    return;
  }
  
  const client = getSupabase();
  if (!client) {
    console.warn("Supabase client not ready for loadMonthlyCapacity. Retrying...");
    setTimeout(loadMonthlyCapacity, 1000);
    return;
  }
  
  let MAX_CAPACITY = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.MAX_CAPACITY : 15;
  
  const { data: profiles } = await client
    .from('profiles')
    .select('max_capacity')
    .eq('user_id', PENSION_OWNER_ID);
  
  const profile = profiles && profiles.length > 0 ? profiles[0] : null;
  
  if (profile && profile.max_capacity) {
    MAX_CAPACITY = profile.max_capacity;
  }

  const year = currentCapacityDate.getFullYear();
  const month = currentCapacityDate.getMonth();
  
  // Update Selects
  const monthSelect = document.getElementById('capacityMonth');
  const yearSelect = document.getElementById('capacityYear');
  
  if (monthSelect) monthSelect.value = month;
  if (yearSelect) {
    if (yearSelect.options.length === 0) {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear; y <= currentYear + 1; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }
    }
    yearSelect.value = year;
  }

  // Calculate range
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  try {
    const { data: orders, error } = await pensionNetSupabase
      .from('orders')
      .select('id, check_in, check_out')
      .eq('status', 'מאושר')
      .eq('user_id', PENSION_OWNER_ID)
      .gte('check_out', firstDay.toISOString().split('T')[0])
      .lte('check_in', lastDay.toISOString().split('T')[0]);

    if (error) throw error;

    const capacityByDate = {};
    const totalDays = lastDay.getDate();
    
    // Initialize array
    for (let i = 1; i <= totalDays; i++) {
        capacityByDate[i] = 0;
    }

    // Process orders efficiently
    const monthStartTimes = firstDay.getTime();
    const monthEndTimes = lastDay.getTime();
    
    orders.forEach(order => {
      const start = new Date(order.check_in).getTime();
      const end = new Date(order.check_out).getTime();
      
      const loopStart = Math.max(start, monthStartTimes);
      const loopEnd = Math.min(end, monthEndTimes);
      
      for (let t = loopStart; t <= loopEnd; t += 86400000) {
        const d = new Date(t);
        capacityByDate[d.getDate()]++;
      }
    });

    // Build HTML Grid
    let html = '';
    
    // Empty cells for start padding
    const startDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    for (let i = 0; i < startDay; i++) {
        html += `<div style="background:transparent;"></div>`;
    }
    
    // Pre-cache selection values and today string
    const selIn = document.getElementById('checkInDate')?.value || '';
    const selOut = document.getElementById('checkOutDate')?.value || '';
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayTimestamp = today.getTime();

    for (let day = 1; day <= totalDays; day++) {
        const count = capacityByDate[day];
        const perc = (count / MAX_CAPACITY) * 100;
        
        const currentDate = new Date(year, month, day);
        const currentTimestamp = currentDate.getTime();
        const isPast = currentTimestamp < todayTimestamp;
        
        let bgColor = '#4caf50'; // Green
        if (perc >= 80) bgColor = '#ff9800'; 
        if (perc >= 100) bgColor = '#f44336';
        
        // Highlight logic
        const dateStr = formatDateToISO(currentDate);
        
        let highlightStyle = '';
        let dayContentColor = 'white';

        if (selIn && dateStr === selIn) {
            highlightStyle = 'background: #667eea !important; box-shadow: 0 0 10px rgba(102, 126, 234, 0.5); transform: scale(1.05); z-index: 2; border-radius: 8px;';
        } else if (selOut && dateStr === selOut) {
            highlightStyle = 'background: #667eea !important; box-shadow: 0 0 10px rgba(102, 126, 234, 0.5); transform: scale(1.05); z-index: 2; border-radius: 8px;';
        } else if (selIn && selOut && dateStr > selIn && dateStr < selOut) {
            highlightStyle = 'background: rgba(102, 126, 234, 0.2) !important; color: #667eea !important; border-radius: 0;';
            dayContentColor = '#667eea';
        }

        let opacity = isPast ? '0.3' : '1';
        let border = (currentTimestamp === todayTimestamp) ? '2px solid #667eea' : 'none';
        
        html += `
        <div onclick="${isPast ? '' : `onDateClick(${day}, ${month}, ${year})`}" 
             style="background:${bgColor}; color:${dayContentColor}; border-radius:8px; padding:6px 2px; text-align:center; opacity: ${opacity}; border: ${border}; min-height: 45px; display:flex; flex-direction:column; justify-content:center; cursor:${isPast ? 'default' : 'pointer'}; ${highlightStyle}">
          <div style="font-size:12px; font-weight:700;">${day}</div>
          <div style="font-size:10px;">${count}/${MAX_CAPACITY}</div>
        </div>
        `;
    }
    
    document.getElementById('capacityCalendar').innerHTML = html;
    updateNavigationButtons();

  } catch (err) {
    console.error("Error loading capacity:", err);
  }
}

function changeCapacityMonth(offset) {
    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxDate = new Date(today.getFullYear(), today.getMonth() + 12, 1);
    
    // Calculate target (normalized)
    const targetDate = new Date(currentCapacityDate.getFullYear(), currentCapacityDate.getMonth() + offset, 1);

    if (targetDate.getTime() < minDate.getTime() || targetDate.getTime() > maxDate.getTime()) {
        return;
    }

    currentCapacityDate = targetDate;
    loadMonthlyCapacity();
}

function jumpCapacityToDate() {
    const monthSelect = document.getElementById('capacityMonth');
    const yearSelect = document.getElementById('capacityYear');
    if (!monthSelect || !yearSelect) return;
    
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearSelect.value);
    
    const targetDate = new Date(year, month, 1);
    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxDate = new Date(today.getFullYear(), today.getMonth() + 12, 1);
    
    // Check range for booking calendar
    if (targetDate.getTime() < minDate.getTime()) {
        currentCapacityDate = minDate;
    } else if (targetDate.getTime() > maxDate.getTime()) {
        currentCapacityDate = maxDate;
    } else {
        currentCapacityDate = targetDate;
    }
    
    loadMonthlyCapacity();
}

function updateNavigationButtons() {
    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxDate = new Date(today.getFullYear(), today.getMonth() + 12, 1);
    
    const viewDate = new Date(currentCapacityDate.getFullYear(), currentCapacityDate.getMonth(), 1);
    
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    
    if (prevBtn) {
        if (viewDate.getTime() <= minDate.getTime()) {
             prevBtn.style.opacity = '0.3';
             prevBtn.style.cursor = 'default';
        } else {
             prevBtn.style.opacity = '1';
             prevBtn.style.cursor = 'pointer';
        }
    }
    
    if (nextBtn) {
        if (viewDate.getTime() >= maxDate.getTime()) {
             nextBtn.style.opacity = '0.3';
             nextBtn.style.cursor = 'default';
        } else {
             nextBtn.style.opacity = '1';
             nextBtn.style.cursor = 'pointer';
        }
    }
}

function onDateClick(day, month, year) {
  const checkInInput = document.getElementById('checkInDate');
  const checkOutInput = document.getElementById('checkOutDate');
  
  const selectedDate = new Date(year, month, day);
  const dateStr = formatDateToISO(selectedDate);
  
  if (selectionPhase === 1) {
    // First click: Set check-in and temporary check-out (same day)
    if (window._orderCheckInPicker) {
      window._orderCheckInPicker.setDate(dateStr, false);
      window._orderCheckOutPicker.setDate(dateStr, false);
    } else {
      checkInInput.value = dateStr;
      checkOutInput.value = dateStr;
    }
    lastCheckInValue = dateStr;
    selectionPhase = 2; // Move to pick check-out
  } else {
    // Second click: Set check-out
    const currentIn = checkInInput.value;
    if (dateStr < currentIn) {
        // If clicked earlier than check-in, restart with this as check-in
        if (window._orderCheckInPicker) {
          window._orderCheckInPicker.setDate(dateStr, false);
          window._orderCheckOutPicker.setDate(dateStr, false);
        } else {
          checkInInput.value = dateStr;
          checkOutInput.value = dateStr;
        }
        lastCheckInValue = dateStr;
        selectionPhase = 2; 
    } else {
        if (window._orderCheckOutPicker) {
          window._orderCheckOutPicker.setDate(dateStr, false);
        } else {
          checkOutInput.value = dateStr;
        }
        selectionPhase = 1; // Complete, next click starts over
    }
  }
  
  updateDaysDisplay();
  loadMonthlyCapacity(); 
}

function updateDaysDisplay() {
  const checkIn = document.getElementById('checkInDate').value;
  const checkOut = document.getElementById('checkOutDate').value;
  const daysDisplay = document.getElementById('daysDisplay');
  const daysText = document.getElementById('daysText');
  
  if (checkIn && checkOut) {
    const days = calculateDays(checkIn, checkOut); // Uses utils.js
    if (days >= 1) {
      if (days === 1) {
        daysText.textContent = `יום כיף בגן 🐾`;
      } else {
        daysText.textContent = `${days} ימים בפנסיון 🐾`;
      }
      daysDisplay.classList.add('show');
    } else {
      daysDisplay.classList.remove('show');
    }

    // Auto-jump calendar to the month of check-in if it's different
    const dIn = new Date(checkIn);
    if (!isNaN(dIn)) {
        const dYear = dIn.getFullYear();
        const dMonth = dIn.getMonth();
        if (dYear !== currentCapacityDate.getFullYear() || dMonth !== currentCapacityDate.getMonth()) {
            currentCapacityDate = new Date(dYear, dMonth, 1);
        }
    }
  } else if (checkIn) {
    // If only check-in is selected, also jump to that month
    const dIn = new Date(checkIn);
    if (!isNaN(dIn)) {
        const dYear = dIn.getFullYear();
        const dMonth = dIn.getMonth();
        if (dYear !== currentCapacityDate.getFullYear() || dMonth !== currentCapacityDate.getMonth()) {
            currentCapacityDate = new Date(dYear, dMonth, 1);
        }
    }
    daysDisplay.classList.remove('show');
  } else {
    daysDisplay.classList.remove('show');
  }
  
  // Refresh calendar display
  loadMonthlyCapacity();
}

let lastCheckInValue = '';
function handleCheckInChange() {
  const checkInInput = document.getElementById('checkInDate');
  const checkOutInput = document.getElementById('checkOutDate');
  
  const newValue = checkInInput.value;
  
  // Sync logic: if check-out is empty OR was exactly the same as the old check-in, update it
  if (newValue && (!checkOutInput.value || checkOutInput.value === lastCheckInValue)) {
    if (window._orderCheckOutPicker) {
      window._orderCheckOutPicker.setDate(newValue, false);
    } else {
      checkOutInput.value = newValue;
    }
    // When manually selecting check-in, we prepare to select check-out next
    selectionPhase = 2;
  }
  
  lastCheckInValue = newValue;
  updateDaysDisplay();
}



function updateStepIndicator() {
  document.querySelectorAll('.step').forEach(step => {
    const stepNum = parseInt(step.dataset.step);
    step.classList.remove('active', 'completed');
    if (stepNum === currentStep) {
      step.classList.add('active');
    } else if (stepNum < currentStep) {
      step.classList.add('completed');
    }
  });

  document.querySelectorAll('.form-step').forEach(step => {
    step.classList.remove('active');
  });
  document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.add('active');
}

function validateStep(step) {
  const currentFormStep = document.querySelector(`.form-step[data-step="${step}"]`);
  const inputs = currentFormStep.querySelectorAll('input[required]:not([type="radio"]), select[required], textarea[required]');
  
  for (let input of inputs) {
    if (!input.value.trim()) {
      input.focus();
      return false;
    }
  }
  
  const radioGroups = {};
  currentFormStep.querySelectorAll('input[type="radio"][required]').forEach(radio => {
    if (!radioGroups[radio.name]) {
      radioGroups[radio.name] = false;
    }
    if (radio.checked) {
      radioGroups[radio.name] = true;
    }
  });
  
  for (let groupName in radioGroups) {
    if (!radioGroups[groupName]) {
      return false;
    }
  }
  
  return true;
}

function nextStep() {
  if (validateStep(currentStep)) {
    if (currentStep === 3) {
      showSummary();
    }
    currentStep++;
    updateStepIndicator();
  }
}

function prevStep() {
  currentStep--;
  updateStepIndicator();
}

function showSummary() {
  const data = getFormData();
  const phone = document.getElementById('identificationPhone').value.replace(/[\s\-]/g, '');
  
  const checkIn = formatDateWithDay(data.checkIn); // Uses utils.js
  const checkOut = formatDateWithDay(data.checkOut);
  
  const numDays = calculateDays(data.checkIn, data.checkOut);
  
  // Normalize phone to match admin's formatPhoneKey: strip spaces/dashes, replace leading 0 with 972
  let cleanPhone = phone.replace(/[\s\-]/g, "");
  // If starts with +972, remove the +
  if (cleanPhone.startsWith('+972')) cleanPhone = cleanPhone.substring(1);
  // If starts with 0, replace with 972
  if (cleanPhone.startsWith('0')) cleanPhone = '972' + cleanPhone.substring(1);
  
  const phoneKey = cleanPhone;
  console.log('Looking up client price for phoneKey:', phoneKey, 'clients_data:', window.pensionProfile?.clients_data);
  
  let customPrice = window.pensionProfile?.clients_data?.[phoneKey]?.default_price;
  let defaultPensionPrice = window.pensionProfile?.default_price || 130;
  
  const pricePerDay = customPrice || defaultPensionPrice;
  const totalPrice = numDays * pricePerDay;
  
  const summary = `
    <div class="summary-box">
      <h3>סיכום ההזמנה</h3>
      <div class="summary-item">
        <span class="summary-label">שם הבעלים:</span>
        <span class="summary-value">${data.ownerName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">טלפון:</span>
        <span class="summary-value">${phone}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">שם הכלב:</span>
        <span class="summary-value">${data.dogName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">גיל:</span>
        <span class="summary-value">${data.dogAge}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">גודל:</span>
        <span class="summary-value">${data.dogSize}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">מין וסטטוס:</span>
        <span class="summary-value">${data.neutered}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">כניסה:</span>
        <span class="summary-value">${checkIn}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">יציאה:</span>
        <span class="summary-value">${checkOut}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">מספר ימים:</span>
        <span class="summary-value">${numDays} ימים</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">מחיר ליום:</span>
        <span class="summary-value">${pricePerDay}₪${customPrice ? ' <span style="background: #dbeafe; color: #1d4ed8; font-size: 11px; padding: 2px 8px; border-radius: 20px; margin-right: 6px; font-weight: 600;">מחיר אישי</span>' : ''}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">סה"כ לתשלום:</span>
        <span class="summary-value" style="color: #667eea; font-size: 18px;">${totalPrice}₪</span>
      </div>
      ${data.notes ? `
      <div class="summary-item">
        <span class="summary-label">הערות:</span>
        <span class="summary-value">${data.notes}</span>
      </div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('summaryPreview').innerHTML = summary;
}

function getFormData() {
  const data = {};
  
  // Get all text-like inputs
  document.querySelectorAll('#bookingForm input:not([type="radio"]):not([type="checkbox"]), #bookingForm select, #bookingForm textarea').forEach(input => {
    if (input.name) {
      data[input.name] = input.value;
    }
  });
  
  // Explicitly check for checkIn and checkOut as they are critical
  const checkIn = document.getElementById('checkInDate');
  const checkOut = document.getElementById('checkOutDate');
  if (checkIn) data.checkIn = checkIn.value;
  if (checkOut) data.checkOut = checkOut.value;
  
  // Get checked radios
  document.querySelectorAll('#bookingForm input[type="radio"]:checked').forEach(radio => {
    data[radio.name] = radio.value;
  });
  
  console.log('Form data extracted:', data);
  return data;
}

async function identifyCustomer() {
  const phoneInput = document.getElementById('identificationPhone');
  let phone = phoneInput.value.replace(/[\s\-]/g, ''); // ניקוי מקפים ורווחים
  
  if (!/^05\d{8}$/.test(phone)) {
    showToast('חובה להזין מספר טלפון תקין בעל 10 ספרות המתחיל ב-05', 'error');
    return;
  }

  if (phone === lastSearchedPhone) return;
  lastSearchedPhone = phone;
  
  document.getElementById('searchingIndicator').style.display = 'block';
  document.getElementById('previousDogsContainer').style.display = 'none';
  if (!PENSION_OWNER_ID) {
    console.error('PENSION_OWNER_ID is missing from URL parameters!');
    document.getElementById('searchingIndicator').style.display = 'none';
    showToast('שגיאה: מזהה פנסיון חסר בכתובת ה-URL. שלח שוב את הקישור ממערכת הניהול.', 'error');
    return;
  }

  console.log('Searching for previous orders with phone:', phone, 'and owner:', PENSION_OWNER_ID);

  const client = getSupabase();
  if (!client) {
    showToast('שגיאה: מערכת הנתונים לא אותחלה. נסה לרענן את הדף.', 'error');
    document.getElementById('searchingIndicator').style.display = 'none';
    return;
  }

  try {
    const { data, error } = await client
      .from('orders')
      .select('id, dog_name, dog_breed, dog_age, neutered, owner_name, created_at, phone')
      .eq('phone', phone) // חיפוש עם מספר נקי
      .eq('user_id', PENSION_OWNER_ID)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    previousOrders = data || [];
    
    document.getElementById('searchingIndicator').style.display = 'none';
    
    if (previousOrders.length > 0) {
      const buttonsContainer = document.getElementById('dogSelectionButtons');
      buttonsContainer.innerHTML = '';
      
      const uniqueDogs = [];
      const dogNames = new Set();
      
      previousOrders.forEach(order => {
        if (order.dog_name && !dogNames.has(order.dog_name)) { // בדיקה נוספת ששם הכלב קיים
          dogNames.add(order.dog_name);
          uniqueDogs.push(order);
        }
      });
      
      uniqueDogs.forEach((order, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dog-button';
        button.dataset.dogIndex = index;
        button.innerHTML = `<span class="dog-button-icon"><i class="fas fa-paw"></i></span> ${order.dog_name} (${order.dog_breed || 'גודל לא ידוע'}, ${order.dog_age || 'גיל לא ידוע'})`; // טיפול בערכים חסרים בתצוגה
        button.onclick = function() {
          document.querySelectorAll('.dog-button').forEach(btn => btn.classList.remove('selected'));
          this.classList.add('selected');
          
          const selectedDog = uniqueDogs[index];
          document.querySelector('input[name="dogName"]').value = selectedDog.dog_name;
          
          // --- תיקון שגיאת SyntaxError ---
          let radio;
          radio = document.querySelector(`input[name="dogAge"][value="${selectedDog.dog_age}"]`);
          if (radio) radio.checked = true;
          
          radio = document.querySelector(`input[name="dogSize"][value="${selectedDog.dog_breed}"]`);
          if (radio) radio.checked = true;
          
          radio = document.querySelector(`input[name="neutered"][value="${selectedDog.neutered}"]`);
          if (radio) radio.checked = true;
          // --------------------------------
          
          document.querySelector('textarea[name="notes"]').value = '';
          
          currentStep = 3;
          updateStepIndicator();
        };
        buttonsContainer.appendChild(button);
      });
      
      const newDogButton = document.createElement('button');
      newDogButton.type = 'button';
      newDogButton.className = 'dog-button new-dog-button';
      newDogButton.innerHTML = `<span class="dog-button-icon">➕</span> כלב חדש`;
      newDogButton.onclick = function() {
        document.querySelectorAll('.dog-button').forEach(btn => btn.classList.remove('selected'));
        this.classList.add('selected');
        
        document.querySelector('input[name="dogName"]').value = '';
        document.querySelectorAll('input[name="dogAge"], input[name="dogSize"], input[name="neutered"]').forEach(radio => radio.checked = false);
        document.querySelector('textarea[name="notes"]').value = '';

        currentStep = 2;
        updateStepIndicator();
      };
      buttonsContainer.appendChild(newDogButton);
      
      window.uniqueDogsData = uniqueDogs;
      
      document.querySelector('input[name="ownerName"]').value = previousOrders[0].owner_name;
      
      document.getElementById('previousDogsContainer').style.display = 'block';
    } else {
      // לקוח חדש - הצג הודעת קבלת פנים
      const container = document.getElementById('previousDogsContainer');
      container.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
          <h3 style="margin: 0 0 15px 0; font-size: 20px;">ברוכים הבאים!</h3>
          <p style="margin: 0; font-size: 16px; line-height: 1.6;">
            זו הפעם הראשונה שלך איתנו 😊<br>
            נעבור עכשיו למילוי פרטי ההזמנה שלך
          </p>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 14px; opacity: 0.9;">
            תקבלו אישור בווטסאפ בהקדם
          </div>
          
          <!-- Progress Bar -->
          <div style="margin-top: 20px;">
            <div style="font-size: 13px; margin-bottom: 8px; opacity: 0.9;">
              עובר לשלב הבא בעוד <span id="countdown">8</span> שניות...
            </div>
            <div style="background: rgba(255,255,255,0.3); height: 6px; border-radius: 3px; overflow: hidden;">
              <div id="progressBar" style="background: white; height: 100%; width: 100%; border-radius: 3px; transition: width 0.1s linear;"></div>
            </div>
          </div>
        </div>
      `;
      container.style.display = 'block';
      
      // ספירה לאחור והתקדמות ויזואלית
      let timeLeft = 8;
      const countdownEl = document.getElementById('countdown');
      const progressBar = document.getElementById('progressBar');
      
      const interval = setInterval(() => {
        timeLeft--;
        if (countdownEl) countdownEl.textContent = timeLeft;
        if (progressBar) progressBar.style.width = `${(timeLeft / 8) * 100}%`;
        
        if (timeLeft <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      // המתן 8 שניות ואז עבור לשלב הבא
      setTimeout(() => {
        clearInterval(interval);
        container.style.display = 'none';
        document.querySelector('input[name="ownerName"]').value = '';
        currentStep = 1;
        updateStepIndicator();
      }, 8000);
    }
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    lastSearchedPhone = '';
    document.getElementById('searchingIndicator').style.display = 'none';
    showToast('אירעה שגיאה בחיפוש: ' + (error.message || 'שגיאה לא ידועה'), 'error');
    
    document.querySelector('input[name="ownerName"]').value = '';
    currentStep = 1;
    updateStepIndicator();
  }
}

async function submitForm() {
  if (!validateStep(3)) {
    return;
  }
  
  const termsCheck = document.getElementById('clientTermsCheck');
  if (termsCheck && !termsCheck.checked) {
    showToast('יש לאשר את תנאי השימוש כדי להמשיך', 'error');
    return;
  }
  
  const submitBtn = document.querySelector('.form-step[data-step="3"] .btn-primary');
  submitBtn.disabled = true;
  submitBtn.textContent = 'שולח...';
  
  const formData = getFormData();
  const phone = document.getElementById('identificationPhone').value.replace(/[\s\-]/g, ''); // ניקוי המספר
  let finalPhone = phone;
  
  if (!/^05\d{8}$/.test(finalPhone)) {
    showToast('חובה להזין מספר טלפון תקין בעל 10 ספרות המתחיל ב-05', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'שלח הזמנה ✓';
    return;
  }
  let phoneKeyForPrice = finalPhone.replace(/[\s\-]/g, "");
  if (phoneKeyForPrice.startsWith('+972')) phoneKeyForPrice = phoneKeyForPrice.substring(1);
  if (phoneKeyForPrice.startsWith('0')) phoneKeyForPrice = '972' + phoneKeyForPrice.substring(1);
  
  const customPriceDay = window.pensionProfile?.clients_data?.[phoneKeyForPrice]?.default_price;
  const defaultPensionPriceDay = window.pensionProfile?.default_price || 130;
  const priceToSave = customPriceDay || defaultPensionPriceDay;
  
  // Upload Photo if exists
  let photoUrl = null;
  if (selectedDogPhotoFile) {
    submitBtn.textContent = 'מעלה תמונה...';
    photoUrl = await uploadDogPhoto(selectedDogPhotoFile, PENSION_OWNER_ID);
  }

  const orderData = {
    owner_name: formData.ownerName,
    phone: finalPhone, // שליחת מספר נקי
    check_in: formData.checkIn,
    check_out: formData.checkOut,
    dog_name: formData.dogName,
    dog_age: formData.dogAge,
    dog_breed: formData.dogSize || '',
    neutered: formData.neutered || 'לא צוין',
    notes: (formData.notes ? formData.notes + '\n\n' : '') + '✅ הלקוח/ה אישר/ה תנאי שימוש',
    user_id: PENSION_OWNER_ID,
    price_per_day: priceToSave,
    dog_photo: photoUrl
  };
  
  const client = getSupabase();
  if (!client) {
    showToast('שגיאה בתקשורת עם השרת. אנא רעננו את הדף ונסו שוב.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'שלח הזמנה ✓';
    return;
  }

  const { data, error } = await client
    .from('orders')
    .insert([orderData])
    .select();
  
  if (error) {
    console.error('Detailed Supabase Error:', error);
    const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : error);
    showToast('שגיאה בשליחת ההזמנה: ' + errorMsg, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'שלח הזמנה ✓';
    return;
  }
  
  const numDays = calculateDays(formData.checkIn, formData.checkOut);
  
  // שליחת הודעה ללקוח
  // ההודעה האוטומטית הוסרה - שליחה ידנית בלבד דרך הממשק

  
  // שליחת התראה למנהל
  // התראת מנהל הוסרה

  
  const checkIn = formatDateWithDay(formData.checkIn);
  const checkOut = formatDateWithDay(formData.checkOut);
  const totalDays = calculateDays(formData.checkIn, formData.checkOut);
  
  // Use custom client price if available
  let finalPhoneKey = finalPhone.replace(/[\s\-]/g, "");
  if (finalPhoneKey.startsWith('+972')) finalPhoneKey = finalPhoneKey.substring(1);
  if (finalPhoneKey.startsWith('0')) finalPhoneKey = '972' + finalPhoneKey.substring(1);
  const finalCustomPrice = window.pensionProfile?.clients_data?.[finalPhoneKey]?.default_price;
  const finalDefaultPrice = window.pensionProfile?.default_price || 130;
  const pricePerDay = finalCustomPrice || finalDefaultPrice;
  
  const totalPrice = totalDays * pricePerDay;
  
  const finalSummary = `
    <div class="summary-box">
      <h3>פרטי ההזמנה</h3>
      <div class="summary-item">
        <span class="summary-label">שם הבעלים:</span>
        <span class="summary-value">${formData.ownerName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">טלפון:</span>
        <span class="summary-value">${finalPhone}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">שם הכלב:</span>
        <span class="summary-value">${formData.dogName}</span>
      </div>
      ${photoUrl ? `
      <div class="summary-item" style="flex-direction: column; align-items: center; gap: 10px; padding: 20px 0;">
        <span class="summary-label" style="width: 100%; text-align: center;">תמונת הכלב:</span>
        <img src="${photoUrl}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      </div>
      ` : ''}
      <div class="summary-item">
        <span class="summary-label">גיל:</span>
        <span class="summary-value">${formData.dogAge}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">גודל:</span>
        <span class="summary-value">${formData.dogSize}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">מין וסטטוס:</span>
        <span class="summary-value">
          ${formData.neutered === 'מעוקרת' ? 'מעוקרת (נקבה)' : 
            formData.neutered === 'לא מעוקרת' ? 'לא מעוקרת (נקבה)' :
            formData.neutered === 'מסורס' ? 'מסורס (זכר)' :
            formData.neutered === 'לא מסורס' ? 'לא מסורס (זכר)' : formData.neutered}
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">כניסה:</span>
        <span class="summary-value">${checkIn}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">יציאה:</span>
        <span class="summary-value">${checkOut}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">מספר ימים:</span>
        <span class="summary-value">${totalDays} ימים</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">מחיר ליום:</span>
        <span class="summary-value">${pricePerDay}₪</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">סה"כ לתשלום:</span>
        <span class="summary-value" style="color: #667eea; font-size: 18px;">${totalPrice}₪</span>
      </div>
      ${formData.notes ? `
      <div class="summary-item">
        <span class="summary-label">הערות:</span>
        <span class="summary-value">${formData.notes}</span>
      </div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('finalSummary').innerHTML = finalSummary;
  
  currentStep = 4;
  updateStepIndicator();
}

function resetForm() {
  document.querySelectorAll('#bookingForm input, #bookingForm textarea').forEach(input => {
    if (input.type === 'radio') {
      input.checked = false;
    } else {
      input.value = '';
    }
  });
  
  // Clear flatpickr instances if they exist
  if (window._orderCheckInPicker) window._orderCheckInPicker.clear();
  if (window._orderCheckOutPicker) window._orderCheckOutPicker.clear();
  
  document.getElementById('previousDogsContainer').style.display = 'none';
  document.getElementById('summaryPreview').innerHTML = '';
  document.getElementById('finalSummary').innerHTML = '';
  document.getElementById('daysDisplay').classList.remove('show');
  
  // Reset photo
  selectedDogPhotoFile = null;
  const photoPreview = document.getElementById('photoPreviewContainer');
  if (photoPreview) photoPreview.innerHTML = `<i class="fas fa-camera" style="font-size: 40px; color: #cbd5e0;"></i>`;
  const photoStatus = document.getElementById('photoUploadStatus');
  if (photoStatus) photoStatus.textContent = 'לחצו לבחירת תמונה';
  const photoInput = document.getElementById('dogPhotoInput');
  if (photoInput) photoInput.value = '';
  
  currentStep = 0;
  lastSearchedPhone = '';
  updateStepIndicator();
}

// Global Listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Set initial state
  updateStepIndicator();
  await ensureOwnerId();
  
  if (PENSION_OWNER_ID) {
    // These functions now handle missing data gracefully
    await Promise.all([
      loadMonthlyCapacity(),
      loadOwnerInfo()
    ]);
  } else {
    const headerSub = document.getElementById('header-business-name');
    if (headerSub) headerSub.textContent = 'פנסיון לכלבים';
  }
  
  // Phone input listener - Enter key only
  const phoneInput = document.getElementById('identificationPhone');
  if (phoneInput) {
    phoneInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        identifyCustomer();
      }
    });
  }
  
  // Date inputs listeners
  const checkInInput = document.getElementById('checkInDate');
  const checkOutInput = document.getElementById('checkOutDate');
  
  if (checkInInput && checkOutInput) {
    if (typeof flatpickr !== 'undefined') {
       window._orderCheckOutPicker = flatpickr('#checkOutDate', {
          locale: "he",
          dateFormat: "Y-m-d",
          altInput: true,
          altFormat: "d/m/Y",
          allowInput: false,
          disableMobile: true,
          onOpen: function(selectedDates, dateStr, instance) {
             instance.calendarContainer.classList.add("premium-datepicker");
          },
          onChange: function(selectedDates, dateStr) {
             updateDaysDisplay();
          }
       });

       window._orderCheckInPicker = flatpickr('#checkInDate', {
          locale: "he",
          dateFormat: "Y-m-d",
          altInput: true,
          altFormat: "d/m/Y",
          allowInput: false,
          disableMobile: true,
          onOpen: function(selectedDates, dateStr, instance) {
             instance.calendarContainer.classList.add("premium-datepicker");
          },
          onChange: function(selectedDates, dateStr) {
             handleCheckInChange();
          }
       });
    } else {
       checkInInput.addEventListener('input', handleCheckInChange);
       checkOutInput.addEventListener('input', updateDaysDisplay);
       checkInInput.addEventListener('change', handleCheckInChange);
       checkOutInput.addEventListener('change', updateDaysDisplay);
    }
  }
});

// --- Photo Upload Handling ---
let selectedDogPhotoFile = null;

function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file size (e.g., 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('הקובץ גדול מדי (מקסימום 5MB)', 'error');
    event.target.value = '';
    return;
  }

  selectedDogPhotoFile = file;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = function(e) {
    const previewContainer = document.getElementById('photoPreviewContainer');
    previewContainer.innerHTML = `<img src="${e.target.result}" alt="Dog Preview" />`;
    document.getElementById('photoUploadStatus').textContent = 'תמונה נבחרה! לחצו לשינוי';
  };
  reader.readAsDataURL(file);
}

async function uploadDogPhoto(file, userId) {
  if (!file) return null;
  
  const client = getSupabase();
  if (!client) {
    console.error('Supabase client not found in uploadDogPhoto');
    return null;
  }

  // --- Client Side Compression (Optional but recommended) ---
  let fileToUpload = file;
  try {
    const compressed = await compressImage(file, 1200, 0.7); // 1200px max width, 70% quality
    if (compressed) fileToUpload = compressed;
    console.log(`Original size: ${(file.size / 1024).toFixed(2)}KB, Compressed: ${(fileToUpload.size / 1024).toFixed(2)}KB`);
  } catch (err) {
    console.warn('Compression failed, trying original file:', err);
  }

  const fileExt = 'jpeg'; // We'll convert compressed image to jpeg
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  
  const folder = userId || 'anonymous';
  const filePath = `${folder}/${fileName}`;
  
  console.log(`Starting upload for ${file.name} to path: ${filePath}`);

  try {
    const { data, error } = await client.storage
      .from('dog-photos')
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });

    if (error) {
      console.error('Photo upload failed. Detailed error:', error);
      if (error.message.includes('size exceeded') || error.message.includes('maximum allowed size')) {
         showToast('התמונה גדולה מדי. המערכת מנסה לדחוס אותה אוטומטית, אנא נסו להקטין או לבחור תמונה אחרת.', 'error');
      } else if (error.message.includes('not found')) {
        showToast('שגיאה: ה-Bucket "dog-photos" לא נמצא.', 'error');
      }
      return null;
    }

    console.log('Upload successful, getting public URL...');
    const { data: { publicUrl } } = client.storage
      .from('dog-photos')
      .getPublicUrl(filePath);

    console.log('Generated Public URL:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('Photo upload exception:', err);
    return null;
  }
}

// Utility for client-side image compression
function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
