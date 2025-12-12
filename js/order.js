// Initialize constants from config (or fallbacks)
const SUPABASE_URL = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.URL : 'https://smzgfffeehrozxsqtgqa.supabase.co';
const SUPABASE_ANON_KEY = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.ANON_KEY : '';
const GREEN_API_INSTANCE = typeof GREEN_API_CONFIG !== 'undefined' ? GREEN_API_CONFIG.INSTANCE : '7105264953';
const GREEN_API_TOKEN = typeof GREEN_API_CONFIG !== 'undefined' ? GREEN_API_CONFIG.TOKEN : 'c0e0fdbd81794dfc941722c133598333ad671ebe13af4fe181';
const ADMIN_PHONE = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.ADMIN_PHONE : '972528366744';

// Initialize Supabase
const supabase = getSupabase();

// State variables
let currentStep = 0;
let previousOrders = [];
let lastSearchedPhone = '';

// --- Functions ---

async function loadWeeklyCapacity() {
  const MAX_CAPACITY = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.MAX_CAPACITY : 15;
  const today = new Date();
  today.setHours(0,0,0,0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 6);

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'מאושר')
      .gte('check_out', today.toISOString().split('T')[0])
      .lte('check_in', endDate.toISOString().split('T')[0]);

    if (error) throw error;

    // Create map of days
    const capacityByDate = {};
    for (let i=0; i<7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const str = d.toISOString().split('T')[0];
      capacityByDate[str] = 0;
    }

    // Count orders
    orders.forEach(order => {
      const start = new Date(order.check_in);
      const end = new Date(order.check_out);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        const str = d.toISOString().split('T')[0];
        if (capacityByDate[str] !== undefined) {
          capacityByDate[str]++;
        }
      }
    });

    // Build HTML
    let html = '';
    Object.keys(capacityByDate).forEach(dateStr => {
      const count = capacityByDate[dateStr];
      const perc = (count / MAX_CAPACITY) * 100;
      const d = new Date(dateStr);
      const dayName = d.toLocaleDateString('he-IL', { weekday:'short' });
      const dayNum = d.getDate();
      const month = d.getMonth()+1;

      let bgColor = '#4caf50';
      if (perc >= 80) bgColor = '#ff9800';
      if (perc >= 100) bgColor = '#f44336';

      html += `
        <div style="background:${bgColor}; color:white; border-radius:10px; padding:10px; text-align:center;">
          <div style="font-size:14px; font-weight:700;">${dayNum}/${month}</div>
          <div style="font-size:12px; opacity:0.9;">${dayName}</div>
          <div style="font-size:16px; margin-top:4px;">${count}/${MAX_CAPACITY}</div>
        </div>
      `;
    });

    document.getElementById('capacityCalendar').innerHTML = html;
  } catch (err) {
    console.error("Error loading weekly capacity:", err);
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

async function sendWhatsAppMessage(phone, message) {
  let formattedPhone = phone.replace(/[\s\-]/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '972' + formattedPhone.substring(1);
  }
  
  console.log('📞 Sending WhatsApp to:', formattedPhone);
  
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: `${formattedPhone}@c.us`,
        message: message
      })
    });
    
    const result = await response.json();
    console.log('📬 API Response:', result);
    
    if (!response.ok) {
      throw new Error(`API Error: ${JSON.stringify(result)}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    throw error;
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
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('phone', phone) // חיפוש עם מספר נקי
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
      document.querySelector('input[name="ownerName"]').value = '';
      currentStep = 1;
      updateStepIndicator();
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
    notes: formData.notes || ''
  };
  
  const { data, error } = await supabase
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
  const whatsappMessage = `🐕 *הזמנה חדשה לפנסיון כלבים*

שלום ${formData.ownerName}!

קיבלנו את ההזמנה שלך לפנסיון.

📋 *פרטי ההזמנה:*
🐶 שם הכלב: ${formData.dogName}
📅 כניסה: ${formatDateWithDay(formData.checkIn)}
📅 יציאה: ${formatDateWithDay(formData.checkOut)}
⏱️ מספר ימים: ${numDays} ימים
🎂 גיל: ${formData.dogAge}
📏 גודל: ${formData.dogSize}
💉 מין וסטטוס: ${formData.neutered}
${formData.dogTemperament ? `🐕 אופי: ${formData.dogTemperament}` : ''}
${formData.notes ? `📝 הערות: ${formData.notes}` : ''}

💰 *עלות משוערת:* ${numDays * 130}₪ (${130}₪ ליום)

⏳ *סטטוס ההזמנה:* ממתין לאישור

נחזור אליך בהקדם עם אישור סופי.

📞 לשאלות: 052-8366744

תודה שבחרת בנו! 🐾`;

  try {
    await sendWhatsAppMessage(finalPhone, whatsappMessage);
    console.log('✅ WhatsApp message sent successfully to:', finalPhone);
  } catch (whatsappError) {
    console.error('❌ Failed to send WhatsApp message:', whatsappError);
  }
  
  // שליחת התראה למנהל
  const adminMessage = `🔔 *הזמנה חדשה התקבלה!*

👤 *פרטי הלקוח:*
שם: ${formData.ownerName}
טלפון: ${finalPhone}

🐕 *פרטי הכלב:*
שם: ${formData.dogName}
גיל: ${formData.dogAge}
גודל: ${formData.dogSize}
מין וסטטוס: ${formData.neutered}
${formData.dogTemperament ? `אופי: ${formData.dogTemperament}` : ''}

📅 *תאריכים:*
כניסה: ${formatDateWithDay(formData.checkIn)}
יציאה: ${formatDateWithDay(formData.checkOut)}
מספר ימים: ${numDays}

💰 *עלות משוערת:* ${numDays * 130}₪

${formData.notes ? `📝 *הערות:* ${formData.notes}` : ''}

⏰ ${new Date().toLocaleString('he-IL')}`;

  try {
    await sendWhatsAppMessage(ADMIN_PHONE, adminMessage);
    console.log('✅ Admin notification sent successfully');
  } catch (adminError) {
    console.error('❌ Failed to send admin notification:', adminError);
  }
  
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
document.addEventListener('DOMContentLoaded', loadWeeklyCapacity);

document.addEventListener('DOMContentLoaded', () => {
  // Set initial state
  updateStepIndicator();
  
  // Phone input listener with debounce
  const phoneInput = document.getElementById('identificationPhone');
  if (phoneInput) {
    // Use debounce from utils.js if available, otherwise simple timeout
    const debouncedIdentify = typeof debounce === 'function' 
      ? debounce(identifyCustomer, 800)
      : function() {
          clearTimeout(window.phoneTimeout);
          window.phoneTimeout = setTimeout(identifyCustomer, 800);
        };
        
    phoneInput.addEventListener('input', debouncedIdentify);
    
    phoneInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        identifyCustomer();
      }
    });
    
    // חיפוש אוטומטי אחרי הקלדת 10 ספרות
    phoneInput.addEventListener('input', function() {
      const phone = this.value.replace(/[\s\-]/g, '');
      if (phone.length === 10) {
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
