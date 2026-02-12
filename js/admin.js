window.isSessionVerified = false;
window.businessName = '';
window.lastPinVerificationTime = parseInt(localStorage.getItem('pensionet_last_pin_verified') || '0');

// --- Supabase Auth Integration ---
async function checkAuthStatus() {
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
  await Auth.logout();
}

// Make logout globally accessible
window.logout = logout;


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
  const session = await checkAuthStatus();
  if (session) {
    window.currentUserSession = session; // Cache session
    document.getElementById("mainContent").style.display = "block";
    loadData();
    loadSettings(); // Load profile settings

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


const HISTORY_ROWS_PER_PAGE = 10;
window.pastOrdersSearchTerm = "";
window.pastOrdersCurrentPage = 1;
window.pastOrdersRawData = [];

// --- לוגיקת לוח שנה חדשה ---
window.currentCalendarDate = new Date();
window.allOrdersCache = []; // שמירת הנתונים המלאים
window.currentView = "calendar"; // 'calendar' או 'dogs'

function calculateDays(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
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
  date.setDate(date.getDate() + days);

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
  return `<a href="https://wa.me/${formattedPhone}" target="_blank" class="whatsapp-link">${phone} <i class="fab fa-whatsapp"></i></a>`;
}

function generateWhatsAppConfirmationLink(row) {
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
  
  // Check if already sent
  const sentConfirmations = JSON.parse(localStorage.getItem('sentConfirmations') || '{}');
  const isSent = sentConfirmations[row.id];
  
  if (isSent) {
    return `<div class="whatsapp-confirm-container" id="confirm-container-${row.id}">
      <span class="whatsapp-sent-badge">נשלח ✓</span>
      <button class="whatsapp-reset-btn" data-reset-order="${row.id}" title="אפס סטטוס">↺</button>
    </div>`;
  }
  
  return `<div class="whatsapp-confirm-container" id="confirm-container-${row.id}">
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
  if (container) {
    container.innerHTML = `
      <span class="whatsapp-sent-badge">נשלח ✓</span>
      <button class="whatsapp-reset-btn" data-reset-order="${orderId}" title="אפס סטטוס">↺</button>
    `;
  }
  
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

// Event delegation for WhatsApp confirmation buttons
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

function renderMonthlyCalendar(allOrders) {
  const calendarGrid = document.getElementById("monthlyCalendarGrid");
  const header = document.getElementById("currentMonthYear");
  const date = window.currentCalendarDate;

  // Set month/year display
  const monthName = date.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
  });
  header.textContent = monthName;

  // Calculate calendar start/end
  const firstDayOfMonth = new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
  const lastDayOfMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let calendarHTML = '<table class="calendar-table"><thead><tr>';
  // ימי השבוע ב-JavaScript מתחילים מ-0 (ראשון)
  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  dayNames.forEach((day) => {
    calendarHTML += `<th>${day}</th>`;
  });
  calendarHTML += "</tr></thead><tbody><tr>";

  // Fill initial empty cells
  const firstDayIndex = firstDayOfMonth.getDay(); // 0 (Sunday) to 6 (Saturday)
  for (let i = 0; i < firstDayIndex; i++) {
    calendarHTML += '<td class="empty-day"></td>';
  }

  let dayCounter = 1;
  let currentDayOfWeek = firstDayIndex;
  let rowCounter = 0;

  while (dayCounter <= lastDayOfMonth.getDate()) {
    const currentDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      dayCounter
    );
    const dayName = dayLabels[currentDate.getDay()];
    const dogsBySize = getDogsForDay(allOrders, currentDate);

    const isToday = currentDate.toDateString() === today.toDateString();
    let classes = "calendar-day";
    if (isToday) classes += " today";

    // Build the dog list content
    let dogsContentHTML = "";
    const sizeOrder = { 'קטן': 1, 'בינוני': 2, 'גדול': 3 };
    const sizes = Object.keys(dogsBySize).sort((a, b) => (sizeOrder[a] || 99) - (sizeOrder[b] || 99));

    sizes.forEach((size) => {
      const dogCount = dogsBySize[size].length;

      // --- הוספת שם הבעלים בסוגריים ---
      const dogEntries = dogsBySize[size]
        .map((d) => {
          const dogName = d.dog_name || "ללא שם";
          const ownerName = d.owner_name ? ` (${d.owner_name})` : "";
          return dogName + ownerName;
        })
        .join(" | ");
      // ---------------------------------

      // בודק אם זה יום שבת (עמודה אחרונה, יום 6) כדי להפוך את כיוון ה-tooltip
      const reverseClass =
        currentDayOfWeek === 6 ? " reverse-tooltip" : "";

      dogsContentHTML += `
              <div class="dog-size-label${reverseClass}" >
                  ${size} (${dogCount})
                  <div class="dog-tooltip">${dogEntries.replace(
                    / \| /g,
                    "<br>"
                  )}</div>
              </div>
          `;
    });

    const dogsInDay = Object.values(dogsBySize).flat().length;
    if (dogsInDay > 0) {
      classes += " busy";
    }

    calendarHTML += `<td class="${classes}">
          <div class="day-number">${dayCounter} (${dayName})</div>
          ${dogsInDay > 0 ? `<div style="text-align: center; font-size: 0.85em; font-weight: bold; color: #555; margin-bottom: 4px;">${dogsInDay} כלבים</div>` : ''}
          <div class="day-content">${dogsContentHTML}</div>
      </td>`;

    // Start new row every Saturday
    currentDayOfWeek++;
    if (currentDayOfWeek > 6) {
      calendarHTML += "</tr><tr>";
      currentDayOfWeek = 0;
      rowCounter++;
    }

    dayCounter++;
  }

  // Fill remaining empty cells
  while (currentDayOfWeek > 0 && currentDayOfWeek <= 6) {
    calendarHTML += '<td class="empty-day"></td>';
    currentDayOfWeek++;
  }

  // Close the table
  if (calendarHTML.endsWith("<tr>")) {
    calendarHTML = calendarHTML.substring(0, calendarHTML.length - 4); // Remove last empty <tr>
  }
  calendarHTML += "</tr></tbody></table>";

  calendarGrid.innerHTML = calendarHTML;
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
  if (window.currentView !== "calendar") return;

  window.currentCalendarDate.setMonth(
    window.currentCalendarDate.getMonth() + delta
  );
  if (window.allOrdersCache.length > 0) {
    renderMonthlyCalendar(window.allOrdersCache);
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

function toggleCalendarView(button) {
  const calendarView = document.getElementById("calendarViewContent");
  const dogsView = document.getElementById("currentDogsColumnView");
  const title = document.getElementById("viewTitle");
  const collapseBtn = document.getElementById(
    "toggleCalendarCollapseBtn"
  );

  if (window.currentView === "calendar") {
    calendarView.style.display = "none";
    dogsView.style.display = "flex";
    title.textContent = "כלבים בפנסיון היום";
    button.innerHTML = '<i class="fas fa-calendar-alt"></i> הצג לוח שנה';
    collapseBtn.style.display = "none";
    window.currentView = "dogs";
    renderCurrentDogsColumnView(window.allOrdersCache);
  } else {
    dogsView.style.display = "none";
    calendarView.style.display = "block";
    title.textContent = "לוח זמנים חודשי (נוכחות כלבים)";
    button.innerHTML = 'הצג כלבים שכרגע בפנסיון <i class="fas fa-paw"></i>';
    collapseBtn.style.display = "block";
    window.currentView = "calendar";
    renderMonthlyCalendar(window.allOrdersCache);

    if (calendarView.classList.contains("collapsed")) {
      collapseBtn.innerHTML = 'פתח <i class="fas fa-chevron-down"></i>';
    } else {
      collapseBtn.innerHTML = 'כווץ <i class="fas fa-chevron-up"></i>';
    }
  }
}

function updatePriceWithButtons(input, delta) {
  const currentValue = parseInt(input.value) || 0;
  const newValue = Math.max(0, currentValue + delta);
  input.value = newValue;

  const row = input.closest("tr");
  const daysInput = row.querySelector(".days-input");
  const tooltip = row.querySelector(".tooltip");

  if (tooltip && daysInput) {
    const days = parseInt(daysInput.value) || 0;
    const total = newValue * days;
    tooltip.textContent = `עלות שהייה: ${total}₪`;
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

  if (tooltip && priceInput) {
    const price = parseInt(priceInput.value) || 0;
    const total = newValue * price;
    tooltip.textContent = `עלות שהייה: ${total}₪`;
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

    tr.innerHTML = `
    <td data-label="תאריך הזמנה">${formatDateTime(row.order_date)}</td>
    <td data-label="בעלים">${row.owner_name}</td>
    <td data-label="טלפון">${createWhatsAppLink(row.phone)}</td>
    <td data-label="אישור"><span class="whatsapp-sent-badge">נשלח ✓</span></td>
    <td data-label="כניסה" class="wide-date-column">
      <input type="date" class="date-input" data-id="${
        row.id
      }" data-field="check_in" value="${formatDateForInput(
      row.check_in
    )}" />
      <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
        row.check_in
      )}</div>
    </td>
    <td data-label="יציאה" class="wide-date-column">
      <input type="date" class="date-input" data-id="${
        row.id
      }" data-field="check_out" value="${formatDateForInput(
      row.check_out
    )}" />
      <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
        row.check_out
      )}</div>
    </td>
    <td data-label="כלב">${row.dog_name}</td>
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
    <td data-label="הערות" style="text-align: right; padding: 12px; line-height: 1.6; max-width: 200px; white-space: normal;">
      ${row.notes ? row.notes : '<span style="color:#999;">-</span>'}
    </td>
    <td data-label="מחיר" class="price-cell">
      <div class="price-wrapper">
        <div class="price-controls">
          <button class="price-btn" onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), 10)">▲</button>
          <button class="price-btn" onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), -10)">▼</button>
        </div>
        <div class="price-input-container">
          <input type="number" class="price-input" data-id="${
            row.id
          }" value="${pricePerDay}" min="0" step="10" />
        </div>
      </div>
      <div class="tooltip">עלות שהייה: ${totalPrice}₪</div>
    </td>
    <td data-label="ימים">
      <div class="days-wrapper">
        <div class="days-controls">
          <button class="price-btn" onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), 1)">▲</button>
          <button class="price-btn" onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), -1)">▼</button>
        </div>
        <div class="days-input-container">
          <input type="number" class="days-input" data-id="${
            row.id
          }" data-checkin="${
          row.check_in
        }" value="${days}" min="1" max="365" />
        </div>
      </div>
    </td>
    <td data-label="סטטוס" class="${
      row.status === "מאושר"
        ? "status-approved"
        : row.status === "בוטל"
        ? "status-cancelled"
        : ""
    }">${row.status}</td>
    <td data-label="ניהול" class="manager-note-column">
      <textarea class="admin-note" data-id="${
        row.id
      }" cols="50" rows="2">${(row.admin_note && !row.admin_note.includes('DEMO_DATA') && !row.admin_note.includes('דוגמה אמיתית')) ? row.admin_note : ""}</textarea>
    </td>
  `;
    tbody.appendChild(tr);
  });

  renderPastOrdersPagination(
    totalRows,
    window.pastOrdersCurrentPage,
    maxPage
  );

  document
    .querySelectorAll("#pastOrdersTable textarea.admin-note")
    .forEach((textarea) => {
      const adjustWidth = () => {
        textarea.style.width = "80ch";
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      };
      adjustWidth();
      textarea.addEventListener("input", adjustWidth);
    });

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
        const tooltip = priceCell
          ? priceCell.querySelector(".tooltip")
          : null;

        if (tooltip) {
          const price = parseInt(priceInput.value) || 0;
          const days = parseInt(daysInput.value) || 0;
          const total = price * days;

          tooltip.textContent = `עלות שהייה: ${total}₪`;
        }
      });
    });
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
  searchInput.addEventListener("input", function () {
    window.pastOrdersSearchTerm = searchInput.value;
    window.pastOrdersCurrentPage = 1;
    renderPastOrdersTable();
  });
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
           ${(d.admin_note && !d.admin_note.includes('DEMO_DATA') && !d.admin_note.includes('דוגמה אמיתית')) ? `<div style="font-size: 11px; color: #eebb00; margin-top: 2px;"><i class="fas fa-exclamation-triangle"></i> ${d.admin_note}</div>` : ''}
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
           ${(d.admin_note && !d.admin_note.includes('DEMO_DATA') && !d.admin_note.includes('דוגמה אמיתית')) ? `<div style="font-size: 11px; color: #eebb00; margin-top: 2px;"><i class="fas fa-exclamation-triangle"></i> ${d.admin_note}</div>` : ''}
         </div>
       </div>`;
    }).join('');
  }
}

async function loadData() {
  const session = await Auth.getSession();
  if (!session) return;

  try {
    const { data, error } = await pensionNetSupabase
      .from("orders")
      .select("*")
      .eq("user_id", session.user.id) // חיפוש רק של המשתמש הנוכחי
      .order("check_out", { ascending: true });

    if (error) throw error;

    console.log("Data loaded:", data.length, "rows");

    window.allOrdersCache = data;

    if (window.currentView === "calendar") {
      renderMonthlyCalendar(data);
    } else {
      renderCurrentDogsColumnView(data);
    }

    // Render daily stats
    renderMovementStats(data);

    if (data.length > 0) {
      console.log("Sample data:", {
        notes: data[0].notes,
      });
    }

    const now = new Date();
    renderFutureOrdersTable();
    
    window.pastOrdersRawData = data.filter((row) => {
      const checkOut = new Date(row.check_out);
      return checkOut < now;
    });
    renderPastOrdersTable();

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
        data.sort((a,b) => new Date(b.order_date) - new Date(a.order_date));
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

      tr.innerHTML = `
      <td data-label="תאריך הזמנה">${formatDateTime(row.order_date)}</td>
      <td data-label="בעלים">${row.owner_name || ""}</td>
      <td data-label="טלפון">${createWhatsAppLink(row.phone)}</td>
      <td data-label="אישור">${generateWhatsAppConfirmationLink(row)}</td>
      <td data-label="כניסה" class="wide-date-column">
        <input type="date" class="date-input" data-id="${
          row.id
        }" data-field="check_in" value="${formatDateForInput(
        row.check_in
      )}" />
        <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
          row.check_in
        )}</div>
      </td>
      <td data-label="יציאה" class="wide-date-column">
        <input type="date" class="date-input" data-id="${
          row.id
        }" data-field="check_out" value="${formatDateForInput(
        row.check_out
      )}" />
        <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
          row.check_out
        )}</div>
      </td>
      <td data-label="כלב">${row.dog_name || ""}</td>
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
      <td data-label="הערות" style="text-align: right; padding: 12px; line-height: 1.6; max-width: 200px; white-space: normal;">
        ${row.notes ? row.notes : '<span style="color:#999;">-</span>'}
      </td>
      <td data-label="מחיר" class="price-cell">
        <div class="price-wrapper">
          <div class="price-controls">
            <button class="price-btn" onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), 10)">▲</button>
            <button class="price-btn" onclick="updatePriceWithButtons(this.closest('.price-wrapper').querySelector('.price-input'), -10)">▼</button>
          </div>
          <div class="price-input-container">
            <input type="number" class="price-input" data-id="${
              row.id
            }" value="${pricePerDay}" min="0" step="10" />
          </div>
        </div>
        <div class="tooltip">עלות שהייה: ${totalPrice}₪</div>
      </td>
      <td data-label="ימים">
        <div class="days-wrapper">
          <div class="days-controls">
            <button class="price-btn" onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), 1)">▲</button>
            <button class="price-btn" onclick="updateDaysWithButtons(this.closest('.days-wrapper').querySelector('.days-input'), -1)">▼</button>
          </div>
          <div class="days-input-container">
            <input type="number" class="days-input" data-id="${
              row.id
            }" data-checkin="${
            row.check_in
          }" value="${days}" min="1" max="365" />
          </div>
        </div>
      </td>
      <td data-label="סטטוס">
        <select data-id="${row.id}" class="status-select ${
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
          <i class="fas fa-comments"></i> הערות (${(() => {
            try {
              const isDemo = row.admin_note && (row.admin_note.includes('DEMO_DATA') || row.admin_note.includes('דוגמה אמיתית'));
              const notes = (row.admin_note && !isDemo) ? JSON.parse(row.admin_note) : [];
              return Array.isArray(notes) ? notes.length : ((row.admin_note && !isDemo) ? 1 : 0);
            } catch(e) { 
              const isDemo = row.admin_note && (row.admin_note.includes('DEMO_DATA') || row.admin_note.includes('דוגמה אמיתית'));
              return (row.admin_note && !isDemo) ? 1 : 0; 
            }
          })()})
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
          const tooltip = priceCell
            ? priceCell.querySelector(".tooltip")
            : null;

          if (tooltip) {
            const price = parseInt(priceInput.value) || 0;
            const days = parseInt(daysInput.value) || 0;
            const total = price * days;

            tooltip.textContent = `עלות שהייה: ${total}₪`;
          }
        });
      });
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

      await createAuditLog('UPDATE', 'ביצוע שמירה גורפת של שינויים בטבלאות הניהול');

      const savedBanner = document.createElement("div");
      savedBanner.className = "success-banner";
      savedBanner.innerHTML = '<i class="fas fa-check-circle"></i> השינויים נשמרו בהצלחה';
      document.body.appendChild(savedBanner);

      setTimeout(() => {
        location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error saving:", error);
      showToast("שגיאה בשמירת הנתונים: " + error.message, 'error');
      saveBtn.classList.remove("loading");
      saveBtn.disabled = false;
    }
  });

loadData();

// Auto-restore saved profile if PIN is still valid
(async function initializeProfile() {
  const savedProfile = localStorage.getItem('pensionNet_activeStaff');
  const now = Date.now();
  const pinValid = window.lastPinVerificationTime && (now - window.lastPinVerificationTime < 5 * 60 * 1000);
  
  if (savedProfile && savedProfile !== 'צוות' && pinValid) {
    // PIN is still valid, restore profile without asking again
    const activeSelect = document.getElementById('activeStaffSelect');
    const initialSelect = document.getElementById('initialProfileSelect');
    
    if (activeSelect) activeSelect.value = savedProfile;
    if (initialSelect) initialSelect.value = savedProfile;
    
    window.isSessionVerified = true;
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.setProperty('display', 'none', 'important');
  }
})();


async function switchTab(tabName) {
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

  // Hide global save button on settings/audit tabs
  const globalSaveBtn = document.getElementById('saveButtonContainer');
  if (globalSaveBtn) {
    globalSaveBtn.style.display = (tabName === 'settings' || tabName === 'audit') ? 'none' : 'block';
    globalSaveBtn.classList.add('only-manager');
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
async function verifyManagerAccess(targetName = null) {
  // If targetName is provided, we verify that specific person (manager or staff)
  // If no targetName, we verify manager
  
  const isVerifyingStaff = targetName && targetName !== window.managerName;
  const staffObj = isVerifyingStaff ? window.currentStaffMembers.find(s => (typeof s === 'string' ? s : s.name) === targetName) : null;
  
  // Check for 5-minute cooldown
  const now = Date.now();
  if (window.lastPinVerificationTime && (now - window.lastPinVerificationTime < 5 * 60 * 1000)) {
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
  if (!(await verifyManagerAccess())) return;
  
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
  if (!badge) return;

  if (window.isAdminMode) {
    badge.innerHTML = '<i class="fas fa-unlock"></i> מצב מנהל';
    badge.className = 'mode-badge manager';
    document.body.classList.remove('staff-mode');
    document.body.classList.remove('perm-edit-status', 'perm-edit-details', 'perm-manage-payments');
    
    // Ensure selector reflects manager profile
    if (staffSelectorContainer) staffSelectorContainer.style.display = 'flex';
    const select = document.getElementById('activeStaffSelect');
    if (select && window.managerName) {
      select.value = window.managerName;
    }
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';
  } else {
    badge.innerHTML = '<i class="fas fa-lock"></i> מצב עובד';
    badge.className = 'mode-badge staff';
    document.body.classList.add('staff-mode');
    if (staffSelectorContainer) staffSelectorContainer.style.display = 'flex';
    
    // Switch permissions based on selected active employee
    const activeStaffName = document.getElementById('activeStaffSelect')?.value;
    const activeStaff = window.currentStaffMembers.find(s => (typeof s === 'string' ? s : s.name) === activeStaffName);
    
    const perms = (activeStaff && typeof activeStaff === 'object') ? activeStaff.permissions : (window.globalStaffPermissions || {
       edit_details: false
    });

    // Apply permissions
    if (perms.edit_status) document.body.classList.add('perm-edit-status');
    else document.body.classList.remove('perm-edit-status');
    
    if (perms.edit_details) document.body.classList.add('perm-edit-details');
    else document.body.classList.remove('perm-edit-details');

    // If on protected tab while in staff mode AND PIN expired, switch to ongoing
    const now = Date.now();
    const pinValid = window.lastPinVerificationTime && (now - window.lastPinVerificationTime < 5 * 60 * 1000);
    
    const activeTabBtn = document.querySelector('.tab-btn.active');
    if (!pinValid && activeTabBtn && (activeTabBtn.textContent.includes('הגדרות') || activeTabBtn.textContent.includes('יומן פעולות'))) {
      switchTab('ongoing');
    }

    // LOCK: If no valid profile selected OR PIN expired, show login overlay
    if (!window.isAdminMode && (!pinValid || activeStaffName === 'צוות')) {
       const overlay = document.getElementById('login-overlay');
       if (overlay) overlay.style.setProperty('display', 'flex', 'important');
    } else {
       const overlay = document.getElementById('login-overlay');
       if (overlay) overlay.style.setProperty('display', 'none', 'important');
    }
  }
  
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
    showToast(`ברוך הבא, ${name}`, 'success');
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
    if (!window.managerPin) {
      showToast('נא להגדיר קוד PIN בטאב ההגדרות תחילה', 'error');
      return;
    }
    
    await verifyManagerAccess();
  }
}

// --- Admin Notes Modal Logic ---
window.currentlyEditingOrderId = null;

async function openNotesModal(orderId, dogName, ownerName) {
  window.currentlyEditingOrderId = orderId;
  document.getElementById('modalDogName').textContent = `${dogName} (${ownerName})`;
  document.getElementById('notesModal').style.display = 'block';
  document.getElementById('newNoteContent').value = '';
  
  // Set default author to active staff member
  const activeStaff = document.getElementById('activeStaffSelect')?.value;
  const authorSelect = document.getElementById('noteAuthorSelect');
  if (authorSelect) {
    if (activeStaff && activeStaff !== 'צוות') {
      authorSelect.value = activeStaff;
    } else {
      authorSelect.selectedIndex = 0;
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
  const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
  const historyDiv = document.getElementById('notesHistory');
  historyDiv.innerHTML = '';
  
  if (!order) return;
  
  let notes = [];
  try {
    notes = order.admin_note ? JSON.parse(order.admin_note) : [];
    if (!Array.isArray(notes)) {
      if (order.admin_note) notes = [{ content: order.admin_note, author: "מנהל", timestamp: new Date().toISOString() }];
      else notes = [];
    }
  } catch(e) {
    if (order.admin_note) notes = [{ content: order.admin_note, author: "מנהל", timestamp: new Date().toISOString() }];
  }
  
  if (notes.length === 0) {
    historyDiv.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">אין הערות עדיין</div>';
    return;
  }
  
  // Sort by date descending
  notes.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  notes.forEach((note, index) => {
    const item = document.createElement('div');
    item.className = 'note-item';
    
    // Add delete button only for manager
    const deleteBtn = window.isAdminMode ? 
      `<button class="delete-note-btn" onclick="deleteOrderNote(${index})" title="מחק הערה"><i class="fas fa-trash"></i></button>` : '';

    item.innerHTML = `
      <div class="note-header">
        <span class="note-author"><i class="fas fa-user-edit"></i> ${note.author}</span>
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
  
  if (!confirm('האם אתה בטוח שברצונך למחוק הערה זו?')) return;

  const orderId = window.currentlyEditingOrderId;
  const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
  if (!order) return;

  let notes = [];
  try {
    notes = JSON.parse(order.admin_note);
  } catch(e) { return; }

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
}

document.getElementById('saveNoteBtn')?.addEventListener('click', async function() {
  const author = document.getElementById('noteAuthorSelect').value;
  const content = document.getElementById('newNoteContent').value.trim();
  
  if (!author) { showToast('נא לבחור מחבר/ת להערה', 'error'); return; }
  if (!content) { showToast('נא להזין תוכן להערה', 'error'); return; }
  
  const orderId = window.currentlyEditingOrderId;
  const order = window.allOrdersCache.find(o => String(o.id) === String(orderId));
  if (!order) return;
  
  let notes = [];
  try {
    notes = order.admin_note ? JSON.parse(order.admin_note) : [];
    if (!Array.isArray(notes)) {
      notes = order.admin_note ? [{ content: order.admin_note, author: "מנהל", timestamp: new Date().toISOString() }] : [];
    }
  } catch(e) {
    notes = order.admin_note ? [{ content: order.admin_note, author: "מנהל", timestamp: new Date().toISOString() }] : [];
  }
  
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
  console.log('Attempting to load settings...');
  const session = window.currentUserSession || await Auth.getSession();
  if (!session || !session.user) {
    console.warn('No session found for loadSettings');
    return;
  }

  // Set initial manager name from metadata immediately to populate login overlay
  window.managerName = session.user.user_metadata?.full_name || 'מנהל';
  updateStaffSelectors();

  try {
    let { data: profile, error } = await pensionNetSupabase
      .from('profiles')
      .select('max_capacity, phone, full_name, business_name, location, default_price, staff_members, manager_pin')
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
      const fieldMapping = {
        'settings-capacity': profile.max_capacity,
        'settings-phone': profile.phone,
        'settings-full-name': profile.full_name,
        'settings-business-name': profile.business_name,
        'settings-location': profile.location,
        'settings-default-price': profile.default_price,
        'settings-admin-pin': profile.manager_pin
      };
      
      window.managerName = profile.full_name || window.managerName || 'מנהל';
      window.businessName = profile.business_name || session.user.user_metadata?.business_name || '';

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

      window.globalStaffPermissions = {
        edit_status: false,
        edit_details: false
      };



      renderStaffList();

      // Update Header Subtitle
      const headerSubtitle = document.getElementById('header-business-name');
      if (headerSubtitle && profile.business_name) {
        headerSubtitle.textContent = profile.business_name;
      }
      console.log('Settings fields populated successfully');
      updateModeUI();
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
  if (!session) return;
  
  showConfirm('<i class="fas fa-magic"></i> מילוי נתוני דמו', 'האם אתה בטוח שברצונך למלא את המערכת בנתוני דמו? <br><br><b>פעולה זו תוסיף 7 הזמנות חדשות למערכת לצורך הדגמה.</b>', async () => {
    const btn = document.getElementById('fillDemoDataBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ממלא נתונים...';
  
  const dogNames = ['לוסי', 'מקס', 'בלה', 'צ\'ארלי', 'לולה', 'רוקי', 'ג\'ק', 'מיקה', 'סימבה', 'טוי', 'ג\'וי', 'לואי', 'סקיי', 'קוצ\'י', 'שוקו'];
  const ownerNames = ['שחר כהן', 'מיכל לוי', 'ישראל ישראלי', 'דינה אברהם', 'רון מועלם', 'עדי שרון', 'דניאל יוסף', 'מיה ארז', 'יואב גל', 'נועה ברק'];
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
  
  const todayStr = today.toISOString().split('T')[0];
  
  const demoOrders = [];
  for (let i = 0; i < 7; i++) {
    const dogName = dogNames[Math.floor(Math.random() * dogNames.length)];
    const ownerName = ownerNames[Math.floor(Math.random() * ownerNames.length)];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    
    let status = 'מאושר';
    if (i >= 3 && i <= 5) status = 'ממתין';
    if (i === 6) status = 'בוטל';
    let checkIn, checkOut;
    
    if (i === 0) {
      // One dog leaving today
      const prev = new Date(today);
      prev.setDate(today.getDate() - 3);
      checkIn = prev;
      checkOut = new Date(today);
    } else if (i === 1) {
      // One dog entering today
      checkIn = new Date(today);
      const future = new Date(today);
      future.setDate(today.getDate() + 4);
      checkOut = future;
    } else {
      // Spread dates: some in the past, some now, some in the future
      const offset = Math.floor(Math.random() * 20) - 10;
      checkIn = new Date(today);
      checkIn.setDate(today.getDate() + offset);
      
      const duration = Math.floor(Math.random() * 5) + 1;
      checkOut = new Date(checkIn);
      checkOut.setDate(checkIn.getDate() + duration);
    }
    
    // Normalize dates for comparison (remove time component)
    const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const checkInNormalized = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const checkOutNormalized = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    
    const isArrived = checkInNormalized <= todayNormalized && status !== 'ממתין';
    const isDeparted = checkOutNormalized < todayNormalized && isArrived;
    
    demoOrders.push({
      user_id: session.user.id,
      owner_name: ownerName,
      dog_name: dogName,
      dog_breed: size,
      dog_age: ['בוגר (4-7)', 'צעיר (1-3)', 'מבוגר (8+)', 'גור (עד שנה)'][Math.floor(Math.random() * 4)],
      phone: '05' + Math.floor(Math.random() * 10000000).toString().padStart(8, '0'),
      check_in: checkIn.toISOString().split('T')[0],
      check_out: checkOut.toISOString().split('T')[0],
      status: status,
      is_arrived: isArrived,
      is_departed: isDeparted,
      is_paid: isDeparted || Math.random() > 0.7,
      price_per_day: 130,
      neutered: Math.random() > 0.5 ? 'מסורס' : 'לא מסורס',
      notes: realNotes[Math.floor(Math.random() * realNotes.length)],
      admin_note: 'DEMO_DATA',
      created_at: new Date().toISOString()
    });
  }
  
  // Mark approved orders as having confirmation sent
  const sentConfirmations = JSON.parse(localStorage.getItem('sentConfirmations') || '{}');
  
  try {
    const { error } = await pensionNetSupabase
      .from('orders')
      .insert(demoOrders);
      
    if (error) throw error;
    
    // After successful insert, mark approved orders as sent
    const { data: insertedOrders } = await pensionNetSupabase
      .from('orders')
      .select('id, status')
      .eq('admin_note', 'DEMO_DATA')
      .order('created_at', { ascending: false })
      .limit(7);
    
    if (insertedOrders) {
      insertedOrders.forEach(order => {
        if (order.status === 'מאושר') {
          sentConfirmations[order.id] = Date.now();
        }
      });
      localStorage.setItem('sentConfirmations', JSON.stringify(sentConfirmations));
    }
    
    showToast('<i class="fas fa-magic"></i> <strong>נתוני הדמו הוספו בהצלחה!</strong> &nbsp;המערכת תתרענן כעת...', 'success');
    setTimeout(() => location.reload(), 2000);
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
      const { error } = await pensionNetSupabase
        .from('orders')
        .delete()
        .eq('user_id', session.user.id)
        .or('notes.eq.DEMO_DATA,admin_note.eq.DEMO_DATA,notes.like.דוגמה אמיתית%');

      if (error) throw error;

      showToast('<i class="fas fa-trash-alt"></i> <strong>נתוני הדמו נמחקו בהצלחה!</strong>', 'success');
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
            createAuditLog('UPDATE', `עדכון מחיר ליום ל-${price}₪ עבור ${order.dog_name}`, orderId);
            renderPaymentsTable(); // Refresh to recalculate total
        }
    } catch (err) {
        console.error("Error updating price per day:", err);
    }
}
