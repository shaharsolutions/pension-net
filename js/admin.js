// --- Supabase Auth Integration ---
async function checkAuthStatus() {
  const session = await Auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

async function logout() {
  await Auth.logout();
}

async function copyBookingLink(event) {
  if (event) event.preventDefault();
  
  const session = await Auth.getSession();
  if (session && session.user) {
    const baseUrl = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
    const bookingUrl = `${baseUrl}/order.html?owner=${session.user.id}`;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(bookingUrl);
        // Using showToast from utils.js
        showToast('הקישור הועתק בהצלחה! שלח אותו ללקוחות שלך.', 'success');
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      prompt('העתק את הקישור שלך:', bookingUrl);
    }
  }
}


document.addEventListener("DOMContentLoaded", async function () {
  const session = await checkAuthStatus();
  if (session) {
    window.currentUserSession = session; // Cache session
    document.getElementById("mainContent").style.display = "block";
    loadData();
    loadSettings(); // Load profile settings
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
  const p2 = enc(`מאשרים את ההזמנה של ${params.dog_name} `) + DOG_CODE;
  
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
    const sizes = Object.keys(dogsBySize).sort();

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
  const sizes = Object.keys(dogsBySize).sort();
  
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
    button.innerHTML = "פתח ⬇️";
  } else {
    button.innerHTML = "כווץ ⬆️";
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
    button.textContent = "הצג לוח שנה 🗓️";
    collapseBtn.style.display = "none";
    window.currentView = "dogs";
    renderCurrentDogsColumnView(window.allOrdersCache);
  } else {
    dogsView.style.display = "none";
    calendarView.style.display = "block";
    title.textContent = "לוח זמנים חודשי (נוכחות כלבים)";
    button.textContent = "הצג כלבים שכרגע בפנסיון 🐕";
    collapseBtn.style.display = "block";
    window.currentView = "calendar";
    renderMonthlyCalendar(window.allOrdersCache);

    if (calendarView.classList.contains("collapsed")) {
      collapseBtn.innerHTML = "פתח ⬇️";
    } else {
      collapseBtn.innerHTML = "כווץ ⬆️";
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
    <td>${formatDateTime(row.order_date)}</td>
    <td>${row.owner_name}</td>
    <td>${createWhatsAppLink(row.phone)}</td>
    <td>${generateWhatsAppConfirmationLink(row)}</td>
    <td class="wide-date-column">
      <input type="date" class="date-input" data-id="${
        row.id
      }" data-field="check_in" value="${formatDateForInput(
      row.check_in
    )}" />
      <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
        row.check_in
      )}</div>
    </td>
    <td class="wide-date-column">
      <input type="date" class="date-input" data-id="${
        row.id
      }" data-field="check_out" value="${formatDateForInput(
      row.check_out
    )}" />
      <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
        row.check_out
      )}</div>
    </td>
    <td>${row.dog_name}</td>
    <td>${row.dog_age}</td>
    <td>${row.dog_breed}</td>
    <td>${row.neutered}</td>
    <td style="text-align: right; padding: 12px; line-height: 1.6; max-width: 200px; white-space: normal;">
      ${row.notes ? row.notes : '<span style="color:#999;">-</span>'}
    </td>
    <td style="text-align: right; padding: 12px; line-height: 1.6; max-width: 200px; white-space: normal;">
      ${
        row.dog_temperament
          ? row.dog_temperament
          : '<span style="color:#999;">-</span>'
      }
    </td>
    <td class="price-cell">
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
    <td>
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
    <td class="${
      row.status === "מאושר"
        ? "status-approved"
        : row.status === "בוטל"
        ? "status-cancelled"
        : ""
    }">${row.status}</td>
    <td class="manager-note-column">
      <textarea class="admin-note" data-id="${
        row.id
      }" cols="50" rows="2">${row.admin_note || ""}</textarea>
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

  try {
    const { error } = await pensionNetSupabase
      .from('orders')
      .update({ [field]: newState })
      .eq('id', orderId);

    if (error) throw error;

    // Update local cache
    order[field] = newState;

    // Re-render UI to reflect final state
    if (btn && row) {
        const isNowChecked = newState;
        row.classList.toggle('completed', isNowChecked);
        btn.classList.toggle('checked', isNowChecked);
        
        const actionText = type === 'entering' ? 'נכנס' : 'יצא';
        btn.textContent = isNowChecked ? `${actionText} ✓` : `סמן ש${actionText}`;
        btn.style.opacity = '1';
    }

  } catch (err) {
    console.error('Error updating movement:', err);
    alert('שגיאה בעדכון הסטטוס. אנא נסה שוב.');
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
           ${d.admin_note ? `<div style="font-size: 11px; color: #eebb00; margin-top: 2px;">⚠️ ${d.admin_note}</div>` : ''}
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
           <div style="font-size: 11px; color: #888;">לתשלום: ${total}₪</div>
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
        dog_temperament: data[0].dog_temperament,
        notes: data[0].notes,
      });
    }

    const futureTbody = document.querySelector(
      "#futureOrdersTable tbody"
    );
    const now = new Date();

    const futureOrders = data.filter((row) => {
      const checkOut = new Date(row.check_out);
      return checkOut >= now;
    });

    const activeOrders = futureOrders.filter(
      (order) => order.status === "מאושר"
    );
    const otherFutureOrders = futureOrders.filter(
      (order) => order.status !== "מאושר"
    );
    const orderedFuture = [...activeOrders, ...otherFutureOrders];

    futureTbody.innerHTML = "";

    orderedFuture.forEach((row) => {
      let temperament = row.dog_temperament
        ? row.dog_temperament.trim()
        : "";
      let notes = row.notes ? row.notes.trim() : "";

      if (!temperament && notes && /^אופי\s*:/m.test(notes)) {
        const temperamentMatch = notes.match(/^אופי\s*:\s*(.*)$/m);
        if (temperamentMatch && temperamentMatch[1]) {
          temperament = temperamentMatch[1].trim();
        }
        notes = notes.replace(/^אופי\s*:.*$/m, "").trim();
      }

      row.dog_temperament = temperament;
      row.notes = notes;

      let tr = document.createElement("tr");
      const days = calculateDays(row.check_in, row.check_out);
      const pricePerDay = row.price_per_day || 130;
      const totalPrice = days * pricePerDay;

      tr.innerHTML = `
      <td>${formatDateTime(row.order_date)}</td>
      <td>${row.owner_name || ""}</td>
      <td>${createWhatsAppLink(row.phone)}</td>
      <td>${generateWhatsAppConfirmationLink(row)}</td>
      <td class="wide-date-column">
        <input type="date" class="date-input" data-id="${
          row.id
        }" data-field="check_in" value="${formatDateForInput(
        row.check_in
      )}" />
        <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
          row.check_in
        )}</div>
      </td>
      <td class="wide-date-column">
        <input type="date" class="date-input" data-id="${
          row.id
        }" data-field="check_out" value="${formatDateForInput(
        row.check_out
      )}" />
        <div style="font-size: 11px; color: #666; margin-top: 4px;">${formatDateOnly(
          row.check_out
        )}</div>
      </td>
      <td>${row.dog_name || ""}</td>
      <td>${row.dog_age || ""}</td>
      <td>${row.dog_breed || ""}</td>
      <td>${row.neutered || ""}</td>
      <td style="text-align: right; padding: 12px; line-height: 1.6; max-width: 200px; white-space: normal;">
        ${row.notes ? row.notes : '<span style="color:#999;">-</span>'}
      </td>
      <td style="text-align: right; padding: 12px; line-height: 1.6; max-width: 200px; white-space: normal;">
        ${
          row.dog_temperament
            ? row.dog_temperament
            : '<span style="color:#999;">-</span>'
        }
      </td>
      <td class="price-cell">
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
      <td>
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
      <td>
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
      <td class="manager-note-column">
        <button type="button" class="view-notes-btn" onclick="openNotesModal('${row.id}', '${row.dog_name.replace(/'/g, "\\'")}', '${row.owner_name.replace(/'/g, "\\'")}')">
          <i class="fas fa-comments"></i> הערות (${(() => {
            try {
              const notes = row.admin_note ? JSON.parse(row.admin_note) : [];
              return Array.isArray(notes) ? notes.length : (row.admin_note ? 1 : 0);
            } catch(e) { return row.admin_note ? 1 : 0; }
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
    alert("שגיאה בטעינת הנתונים");
  }
}

document
  .getElementById("saveButton")
  .addEventListener("click", async () => {
    if (!checkAuth()) {
      alert("אין הרשאה");
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

      const savedBanner = document.createElement("div");
      savedBanner.className = "success-banner";
      savedBanner.textContent = "✅ השינויים נשמרו בהצלחה";
      document.body.appendChild(savedBanner);

      setTimeout(() => {
        location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error saving:", error);
      alert("שגיאה בשמירת הנתונים: " + error.message);
      saveBtn.classList.remove("loading");
      saveBtn.disabled = false;
    }
  });

loadData();

async function switchTab(tabName) {
  // If moving to settings, verify PIN first
  if (tabName === 'settings') {
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

  // Hide global save button on settings tab
  const globalSaveBtn = document.getElementById('saveButtonContainer');
  if (globalSaveBtn) {
    globalSaveBtn.style.display = tabName === 'settings' ? 'none' : 'block';
    globalSaveBtn.classList.add('only-manager'); // Only manager can see this anyway in CSS if staff mode is on
  }

  // Load settings if opening the settings tab
  if (tabName === 'settings') {
    loadSettings();
  }
}

// --- Staff Management ---
window.currentStaffMembers = [];

function renderStaffList() {
  const list = document.getElementById('staff-list');
  if (!list) return;
  list.innerHTML = '';
  
  window.currentStaffMembers.forEach((name, index) => {
    const tag = document.createElement('div');
    tag.className = 'staff-tag';
    tag.innerHTML = `
      <span>${name}</span>
      <span class="remove-staff" onclick="removeStaffMember(${index})">&times;</span>
    `;
    list.appendChild(tag);
  });

  // Also update modal author select
  const select = document.getElementById('noteAuthorSelect');
  if (select) {
    const currentVal = select.value;
    select.innerHTML = '<option value="">בחר עובד/ת...</option>';
    window.currentStaffMembers.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    select.value = currentVal;
  }
}

async function verifyManagerAccess() {
  if (window.isAdminMode) return true;
  
  const pin = prompt('פעולה זו דורשת קוד PIN לניהול:');
  if (pin === window.managerPin) {
    window.isAdminMode = true;
    updateModeUI();
    return true;
  }
  alert('קוד PIN שגוי');
  return false;
}

async function addStaffMember() {
  if (!(await verifyManagerAccess())) return;
  
  const input = document.getElementById('new-staff-name');
  const name = input.value.trim();
  if (name && !window.currentStaffMembers.includes(name)) {
    window.currentStaffMembers.push(name);
    input.value = '';
    renderStaffList();
  }
}

async function removeStaffMember(index) {
  if (!(await verifyManagerAccess())) return;
  
  window.currentStaffMembers.splice(index, 1);
  renderStaffList();
}

// --- Mode Toggle Logic ---
window.isAdminMode = false; // Default to staff mode
window.managerPin = '';

function updateModeUI() {
  const badge = document.getElementById('modeStatusLabel');
  if (!badge) return;

  if (window.isAdminMode) {
    badge.textContent = '🔓 מצב מנהל';
    badge.className = 'mode-badge manager';
    document.body.classList.remove('staff-mode');
  } else {
    badge.textContent = '🔐 מצב עובד';
    badge.className = 'mode-badge staff';
    document.body.classList.add('staff-mode');
  }
  
  // Refresh notes view if open to show/hide delete buttons
  if (window.currentlyEditingOrderId) {
    loadOrderNotes(window.currentlyEditingOrderId);
  }
}

async function toggleAdminMode() {
  if (window.isAdminMode) {
    // Switch to staff mode (no PIN needed)
    window.isAdminMode = false;
    updateModeUI();
  } else {
    // Switching to manager mode - ask for PIN
    if (!window.managerPin) {
      alert('נא להגדיר קוד PIN בטאב ההגדרות תחילה');
      return;
    }
    const input = prompt('נא להזין קוד PIN לניהול:');
    if (input === window.managerPin) {
      window.isAdminMode = true;
      updateModeUI();
    } else {
      alert('קוד PIN שגוי');
    }
  }
}

// Ensure staff mode on start
document.addEventListener('DOMContentLoaded', updateModeUI);

// --- Admin Notes Modal Logic ---
window.currentlyEditingOrderId = null;

async function openNotesModal(orderId, dogName, ownerName) {
  window.currentlyEditingOrderId = orderId;
  document.getElementById('modalDogName').textContent = `${dogName} (${ownerName})`;
  document.getElementById('notesModal').style.display = 'block';
  document.getElementById('newNoteContent').value = '';
  document.getElementById('noteAuthorSelect').selectedIndex = 0;
  
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
    alert('שגיאה במחיקת הערה: ' + err.message);
  }
}

document.getElementById('saveNoteBtn')?.addEventListener('click', async function() {
  const author = document.getElementById('noteAuthorSelect').value;
  const content = document.getElementById('newNoteContent').value.trim();
  
  if (!author) { alert('נא לבחור מחבר/ת להערה'); return; }
  if (!content) { alert('נא להזין תוכן להערה'); return; }
  
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
    alert('שגיאה בשמירת ההערה: ' + err.message);
  }
});

async function loadSettings() {
  console.log('Attempting to load settings...');
  const session = window.currentUserSession || await Auth.getSession();
  if (!session || !session.user) {
    console.warn('No session found for loadSettings');
    return;
  }

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
          phone: session.user.user_metadata?.phone || '',
          max_capacity: parseInt(session.user.user_metadata?.max_capacity) || 10,
          default_price: 130,
          staff_members: []
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

      window.managerPin = profile.manager_pin || '';

      for (const [id, value] of Object.entries(fieldMapping)) {
        const el = document.getElementById(id);
        if (el) {
          el.value = (value !== null && value !== undefined) ? value : '';
        }
      }

      window.currentStaffMembers = profile.staff_members || [];
      renderStaffList();

      // Update Header Subtitle
      const headerSubtitle = document.getElementById('header-business-name');
      if (headerSubtitle && profile.business_name) {
        headerSubtitle.textContent = profile.business_name;
      }
      console.log('Settings fields populated successfully');
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
      .update(updateData)
      .eq('user_id', session.user.id);

    if (error) throw error;

    alert('ההגדרות נשמרו בהצלחה!');
    location.reload(); 
  } catch (err) {
    console.error('Error saving settings:', err);
    alert('שגיאה בשמירת ההגדרות: ' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
  }
});

function togglePasswordVisibility() {
  const input = document.getElementById("passwordInput");
  const icon = document.querySelector(".password-toggle");
  
  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "🙈";
  } else {
    input.type = "password";
    icon.textContent = "👁️";
  }
}
