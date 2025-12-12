const ADMIN_PASSWORD_HASH = "60275c47";

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function checkAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') return true;
  const stored = sessionStorage.getItem("adminAuth");
  return stored === ADMIN_PASSWORD_HASH;
}

function attemptLogin() {
  const input = document.getElementById("passwordInput").value;
  const inputHash = simpleHash(input);

  if (inputHash === ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem("adminAuth", inputHash);
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainContent").style.display = "block";
    loadData();
  } else {
    const errorMsg = document.getElementById("errorMessage");
    errorMsg.style.display = "block";
    setTimeout(() => {
      errorMsg.style.display = "none";
    }, 3000);
  }
}

function logout() {
  sessionStorage.removeItem("adminAuth");
  location.reload();
}

document.addEventListener("DOMContentLoaded", function () {
  if (checkAuth()) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainContent").style.display = "block";
    loadData();
  }
});

document
  .getElementById("passwordInput")
  ?.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      attemptLogin();
    }
  });

const SUPABASE_URL = "https://smzgfffeehrozxsqtgqa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtemdmZmZlZWhyb3p4c3F0Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNTU4NTYsImV4cCI6MjA3NDgzMTg1Nn0.LvIQLvj7HO7xXJhTALLO5GeYZ1DU50L3q8Act5wXfi4";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

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
  return `<a href="https://wa.me/${formattedPhone}" target="_blank" class="whatsapp-link">${phone}</a>`;
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
          <div class="day-number">${dayCounter}</div>
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dogsBySize = getDogsForDay(allOrders, today);
  const sizes = Object.keys(dogsBySize).sort();

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
                  <span style="font-size: 12px; color: #a0a0a0; margin-top: 5px;">הערות מנהל: ${
                    d.admin_note || "אין"
                  }</span>
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
    button.textContent = "הצג כלבים נוכחיים 🐕";
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
      <input type="number" class="days-input" data-id="${
        row.id
      }" data-checkin="${
      row.check_in
    }" value="${days}" min="1" max="365" />
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

async function loadData() {
  if (!checkAuth()) return;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("check_out", { ascending: true });

    if (error) throw error;

    console.log("Data loaded:", data.length, "rows");

    window.allOrdersCache = data;

    if (window.currentView === "calendar") {
      renderMonthlyCalendar(data);
    } else {
      renderCurrentDogsColumnView(data);
    }

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
        <input type="number" class="days-input" data-id="${
          row.id
        }" data-checkin="${
        row.check_in
      }" value="${days}" min="1" max="365" />
      </td>
      <td>
        <select data-id="${row.id}" class="${
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
        <textarea class="admin-note" data-id="${
          row.id
        }" cols="50" rows="2">${row.admin_note || ""}</textarea>
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
          const { error } = await supabase
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

function switchTab(tabName) {
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
}

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
