// Initialize constants from config (or fallbacks)
const SUPABASE_URL = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.URL : 'https://smzgfffeehrozxsqtgqa.supabase.co';
const SUPABASE_ANON_KEY = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtemdmZmZlZWhyb3p4c3F0Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNTU4NTYsImV4cCI6MjA3NDgzMTg1Nn0.LvIQLvj7HO7xXJhTALLO5GeYZ1DU50L3q8Act5wXfi4';

let ADMIN_PHONE = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.ADMIN_PHONE : '972528366744';
let BUSINESS_NAME = 'פנסיון לכלבים';

// Initialize Supabase
const pensionNetSupabase = getSupabase();

// State variables
let currentStep = 0;
let previousOrders = [];
let lastSearchedPhone = '';
let currentCapacityDate = new Date();

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
      // Refresh data now that we have an ID
      loadMonthlyCapacity();
      loadOwnerInfo();
    }
  }
  
  if (!PENSION_OWNER_ID) {
    console.warn("Owner ID not specified in URL. Booking might not be saved correctly.");
  }
}

// Start ID check
ensureOwnerId();


// --- Functions ---

async function loadOwnerInfo() {
  if (!PENSION_OWNER_ID) return;
  
  try {
    const { data: profile, error } = await pensionNetSupabase
      .from('profiles')
      .select('phone, business_name, location')
      .eq('user_id', PENSION_OWNER_ID)
      .single();
    
    if (error) throw error;
    
    if (profile) {
      if (profile.phone) ADMIN_PHONE = profile.phone;
      if (profile.business_name) {
        BUSINESS_NAME = profile.business_name;
        document.querySelector('.header h1').textContent = `הזמנת מקום בפנסיון כלבים`;
        document.title = `הזמנת מקום ב${BUSINESS_NAME}`;
        
        // Update subtitle with name and location
        const headerSub = document.getElementById('header-business-name');
        if (headerSub) {
          headerSub.textContent = profile.location ? `${BUSINESS_NAME} - ${profile.location}` : BUSINESS_NAME;
        }
      }
      
      // Update phone display in success message if it exists
      const successPhoneEl = document.getElementById('displayAdminPhone');
      if (successPhoneEl) successPhoneEl.textContent = ADMIN_PHONE;
    }
  } catch (err) {
    console.error('Error loading owner info:', err);
  }
}

async function loadMonthlyCapacity() {
  if (!PENSION_OWNER_ID) return;
  
  let MAX_CAPACITY = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.MAX_CAPACITY : 15;
  
  if (PENSION_OWNER_ID) {
    const { data: profile } = await pensionNetSupabase
      .from('profiles')
      .select('max_capacity')
      .eq('user_id', PENSION_OWNER_ID)
      .single();
    
    if (profile && profile.max_capacity) {
      MAX_CAPACITY = profile.max_capacity;
    }
  }

  const year = currentCapacityDate.getFullYear();
  const month = currentCapacityDate.getMonth();
  
  // Update Title
  const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const titleEl = document.getElementById('capacityMonthTitle');
  if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

  // Calculate range
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  try {
    const { data: orders, error } = await pensionNetSupabase
      .from('orders')
      .select('*')
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

    // Process orders
    orders.forEach(order => {
      const start = new Date(order.check_in);
      const end = new Date(order.check_out);
      
      // Iterate days of order
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        // Check if d is in current month
        if (d.getMonth() === month && d.getFullYear() === year) {
           capacityByDate[d.getDate()]++;
        }
      }
    });

    // Build HTML Grid
    let html = '';
    
    // Empty cells for start padding
    const startDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    for (let i = 0; i < startDay; i++) {
        html += `<div style="background:transparent;"></div>`;
    }
    
    // Day cells
    const today = new Date();
    today.setHours(0,0,0,0);
    
    for (let day = 1; day <= totalDays; day++) {
        const count = capacityByDate[day];
        const perc = (count / MAX_CAPACITY) * 100;
        
        // Check if date is passed
        const currentDate = new Date(year, month, day);
        const isPast = currentDate < today;
        
        let bgColor = '#4caf50'; // Green (Free)
        if (perc >= 80) bgColor = '#ff9800'; // Orange (Busy)
        if (perc >= 100) bgColor = '#f44336'; // Red (Full)
        
        let opacity = isPast ? '0.3' : '1';
        let border = (currentDate.getTime() === today.getTime()) ? '2px solid #667eea' : 'none';
        
        html += `
        <div style="background:${bgColor}; color:white; border-radius:8px; padding:6px 2px; text-align:center; opacity: ${opacity}; border: ${border}; min-height: 45px; display:flex; flex-direction:column; justify-content:center;">
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
    const maxDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Calculate target (normalized)
    const targetDate = new Date(currentCapacityDate.getFullYear(), currentCapacityDate.getMonth() + offset, 1);

    if (targetDate.getTime() < minDate.getTime() || targetDate.getTime() > maxDate.getTime()) {
        return;
    }

    currentCapacityDate = targetDate;
    loadMonthlyCapacity();
}

function updateNavigationButtons() {
    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
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

function updateDaysDisplay() {
  const checkIn = document.getElementById('checkInDate').value;
  const checkOut = document.getElementById('checkOutDate').value;
  const daysDisplay = document.getElementById('daysDisplay');
  const daysText = document.getElementById('daysText');
  
  if (checkIn && checkOut) {
    const days = calculateDays(checkIn, checkOut); // Uses utils.js
    if (days > 0) {
      daysText.textContent = `🐾 הכלב ישהה בפנסיון ${days} ימים`;
      daysDisplay.classList.add('show');
    } else {
      daysDisplay.classList.remove('show');
    }
  } else {
    daysDisplay.classList.remove('show');
  }
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
  const pricePerDay = 130;
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
      ${data.dogTemperament ? `
      <div class="summary-item">
        <span class="summary-label">אופי הכלב:</span>
        <span class="summary-value">${data.dogTemperament}</span>
      </div>
      ` : ''}
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
        <span class="summary-value">${pricePerDay}₪</span>
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
  document.querySelectorAll('#bookingForm input[type="text"], #bookingForm input[type="tel"], #bookingForm input[type="date"], #bookingForm textarea').forEach(input => {
    data[input.name] = input.value;
  });
  document.querySelectorAll('#bookingForm input[type="radio"]:checked').forEach(radio => {
    data[radio.name] = radio.value;
  });
  return data;
}

async function identifyCustomer() {
  const phoneInput = document.getElementById('identificationPhone');
  let phone = phoneInput.value.replace(/[\s\-]/g, ''); // ניקוי מקפים ורווחים
  
  if (!phone || phone.length < 9) {
    return;
  }

  if (phone === lastSearchedPhone) return;
  lastSearchedPhone = phone;
  
  document.getElementById('searchingIndicator').style.display = 'block';
  document.getElementById('previousDogsContainer').style.display = 'none';
  
  if (/^[1-9]\d{8}$/.test(phone)) {
    phone = '0' + phone;
  }
  
  try {
    const { data, error } = await pensionNetSupabase
      .from('orders')
      .select('*')
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
        button.innerHTML = `<span class="dog-button-icon">🐕</span> ${order.dog_name} (${order.dog_breed || 'גזע לא ידוע'}, ${order.dog_age || 'גיל לא ידוע'})`; // טיפול בערכים חסרים בתצוגה
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
          
          document.querySelector('textarea[name="dogTemperament"]').value = selectedDog.dog_temperament || '';
          document.querySelector('textarea[name="notes"]').value = selectedDog.notes || '';
          
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
        
        // איפוס שדות הכלב
        document.querySelector('input[name="dogName"]').value = '';
        document.querySelectorAll('input[name="dogAge"], input[name="dogSize"], input[name="neutered"]').forEach(radio => radio.checked = false);
        document.querySelector('textarea[name="dogTemperament"]').value = '';
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
            הזמנתך תתקבל באישור אוטומטי ב-WhatsApp
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
    alert('אירעה שגיאה בחיפוש: ' + (error.message || 'שגיאה לא ידועה'));
    
    document.querySelector('input[name="ownerName"]').value = '';
    currentStep = 1;
    updateStepIndicator();
  }
}

async function submitForm() {
  if (!validateStep(3)) {
    return;
  }
  
  const submitBtn = document.querySelector('.form-step[data-step="3"] .btn-primary');
  submitBtn.disabled = true;
  submitBtn.textContent = 'שולח...';
  
  const formData = getFormData();
  const phone = document.getElementById('identificationPhone').value.replace(/[\s\-]/g, ''); // ניקוי המספר
  let finalPhone = phone;
  
  if (/^[1-9]\d{8}$/.test(phone)) {
    finalPhone = '0' + phone;
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
    dog_temperament: formData.dogTemperament || '',
    notes: formData.notes || '',
    user_id: PENSION_OWNER_ID
  };
  
  const { data, error } = await pensionNetSupabase
    .from('orders')
    .insert([orderData])
    .select();
  
  if (error) {
    console.error('Error:', error);
    alert('אירעה שגיאה בשליחת ההזמנה. אנא נסו שוב.');
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
  const pricePerDay = 130;
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
        <span class="summary-value">${formData.neutered}</span>
      </div>
      ${formData.dogTemperament ? `
      <div class="summary-item">
        <span class="summary-label">אופי הכלב:</span>
        <span class="summary-value">${formData.dogTemperament}</span>
      </div>
      ` : ''}
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
  
  document.getElementById('previousDogsContainer').style.display = 'none';
  document.getElementById('summaryPreview').innerHTML = '';
  document.getElementById('finalSummary').innerHTML = '';
  document.getElementById('daysDisplay').classList.remove('show');
  
  currentStep = 0;
  lastSearchedPhone = '';
  updateStepIndicator();
}

// Global Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadMonthlyCapacity();
  loadOwnerInfo();
});

document.addEventListener('DOMContentLoaded', () => {
  // Set initial state
  updateStepIndicator();
  
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
    checkInInput.addEventListener('input', updateDaysDisplay);
    checkOutInput.addEventListener('input', updateDaysDisplay);
    checkInInput.addEventListener('change', updateDaysDisplay);
    checkOutInput.addEventListener('change', updateDaysDisplay);
  }
});
