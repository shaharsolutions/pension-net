/**
 * Pension-Net | Pensions Directory Logic
 */

let pensionsSupabase;
let map;
let markers = [];
let pensionsData = [];
let userLocation = null;
let activeFilter = 'distance';
let isAdmin = false;
let isInitialLoading = true;
const ADMIN_PASS = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.DIRECTORY_ADMIN_PASS : 'SC1627s@';

// Geocoding cache to minimize Nominatim hits
const geocodeCache = new Map();

async function init() {
    // 1. Initialize Supabase
    pensionsSupabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

    // 2. Initialize Map (Center on Israel by default)
    initMap();

    // 3. Get User Location
    getUserLocation();

    // 4. Fetch Pensions
    await fetchPensions();

    // 5. Event Listeners
    setupEventListeners();

    // 6. Admin Setup
    setupAdminListeners();
}

function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([32.0853, 34.7818], 10); // Center on Tel Aviv

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Add zoom control to the right
    L.control.zoom({ position: 'topright' }).addTo(map);
}

async function getUserLocation() {
    const statusToast = document.getElementById('locationStatus');
    statusToast.style.display = 'block';

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Add user marker
                L.circleMarker([userLocation.lat, userLocation.lng], {
                    radius: 8,
                    fillColor: "#6366f1",
                    color: "#fff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map).bindPopup("המיקום שלך");

                // Recalculate distances and re-render
                processPensions();
                statusToast.innerHTML = '<i class="fas fa-check"></i> המיקום אותר';
                setTimeout(() => statusToast.style.display = 'none', 3000);
            },
            (error) => {
                // Silently handle location failure - the app will work fine without it
                console.log("Geolocation unavailable, showing all pensions without distance sorting.");
                statusToast.innerHTML = '<i class="fas fa-info-circle"></i> חיפוש ללא זיהוי מיקום';
                setTimeout(() => statusToast.style.display = 'none', 3000);
                processPensions(); 
            }
        );
    } else {
        statusToast.style.display = 'none';
        processPensions();
    }
}

async function fetchPensions() {
    const { data, error } = await pensionsSupabase
        .from('profiles')
        .select('user_id, business_name, location, phone, max_capacity, default_price, is_visible')
        .not('business_name', 'is', null);

    if (error) {
        console.error("Error fetching pensions:", error);
        return;
    }

    pensionsData = data || [];
    isInitialLoading = false;
    await processPensions();
}

async function processPensions() {
    const listContainer = document.getElementById('pensionList');
    
    // Sequential geocoding to respect Nominatim rate limit (1 req/sec)
    for (const pension of pensionsData) {
        if (!pension.location) continue;
        
        // Skip if already has coords or in cache
        if (!pension.lat || !pension.lng) {
            let coords = await geocodeAddress(pension.location);
            if (coords) {
                pension.lat = coords.lat;
                pension.lng = coords.lng;
                
                // Save to persistent cache
                geocodeCache.set(pension.location, coords);
                localStorage.setItem('pension_geocode_cache', JSON.stringify([...geocodeCache]));
            }
        }

        // Calculate distance if user location is available
        if (userLocation && pension.lat && pension.lng) {
            pension.distance = calculateDistance(
                userLocation.lat, userLocation.lng,
                pension.lat, pension.lng
            );
        } else {
            pension.distance = Infinity;
        }
    }

    // 2. Sort pensions
    sortPensions();

    // 3. Render
    renderPensions();
    renderMarkers();
}

async function geocodeAddress(address) {
    if (geocodeCache.has(address)) return geocodeCache.get(address);

    try {
        // Wait 1 second to respect rate limit if not in cache
        await new Promise(resolve => setTimeout(resolve, 1100));

        // We add "Israel" to increase accuracy
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Israel')}&limit=1`);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            return coords;
        }
    } catch (error) {
        console.error("Geocoding error for:", address, error);
    }
    return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function sortPensions() {
    const searchTerm = document.getElementById('pensionSearch').value.toLowerCase();
    
    let filtered = pensionsData.filter(p => {
        // If not admin, only show visible ones
        if (!isAdmin && p.is_visible === false) return false;

        const nameMatch = (p.business_name || '').toLowerCase().includes(searchTerm);
        const locationMatch = (p.location || '').toLowerCase().includes(searchTerm);
        return nameMatch || locationMatch;
    });

    if (activeFilter === 'distance') {
        filtered.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    } else if (activeFilter === 'price') {
        filtered.sort((a, b) => (a.default_price || 0) - (b.default_price || 0));
    }

    return filtered;
}

function renderPensions() {
    const listContainer = document.getElementById('pensionList');
    
    if (isInitialLoading) {
        listContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>טוען פנסיונים מתוך המערכת...</p>
            </div>
        `;
        return;
    }

    const sortedData = sortPensions();
    
    if (sortedData.length === 0) {
        listContainer.innerHTML = '<div class="loading-state"><p>לא נמצאו פנסיונים תואמים</p></div>';
        return;
    }

    listContainer.innerHTML = sortedData.map(p => `
        <div class="pension-card ${!p.is_visible ? 'hidden-by-admin' : ''}" data-id="${p.user_id}" onclick="focusPension('${p.user_id}')">
            ${(p.distance && p.distance !== Infinity) ? `<span class="badge">${p.distance.toFixed(1)} ק"מ</span>` : ''}
            
            <h3>
                ${isAdmin ? `
                    <label class="admin-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${p.is_visible ? 'checked' : ''} 
                               onchange="toggleVisibility(event, '${p.user_id}')">
                        <span class="checkmark"></span>
                    </label>
                ` : ''}
                ${p.business_name}
            </h3>
            <div class="location">
                <i class="fas fa-map-marker-alt"></i> ${p.location || 'מיקום לא צוין'}
            </div>
            <div class="info-row">
                <div class="info-item">
                    <i class="fas fa-tags"></i> ₪${p.default_price || 0} ליום
                </div>
                <div class="info-item">
                    <i class="fas fa-users"></i> עד ${p.max_capacity || 0} כלבים
                </div>
            </div>
            <div class="card-actions">
                <a href="order.html?owner=${p.user_id}" class="card-btn btn-primary" onclick="event.stopPropagation()">הזמן עכשיו</a>
                <a href="tel:${p.phone}" class="card-btn btn-outline" onclick="event.stopPropagation()">התקשר</a>
            </div>
        </div>
    `).join('');
}

// --- Admin Functions ---

function setupAdminListeners() {
    const trigger = document.getElementById('adminLoginTrigger');
    
    trigger.addEventListener('click', () => {
        if (isAdmin) {
            document.getElementById('confirmModal').style.display = 'flex';
        } else {
            document.getElementById('adminModal').style.display = 'flex';
        }
    });
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

function logoutAdmin() {
    isAdmin = false;
    const trigger = document.getElementById('adminLoginTrigger');
    trigger.classList.remove('active');
    trigger.innerHTML = '<i class="fas fa-user-shield"></i>';
    closeConfirmModal();
    renderPensions();
}

function closeAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
    document.getElementById('adminPassword').value = '';
}

function checkAdminPassword() {
    const pass = document.getElementById('adminPassword').value;
    if (pass === ADMIN_PASS) {
        isAdmin = true;
        const trigger = document.getElementById('adminLoginTrigger');
        trigger.classList.add('active');
        trigger.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        
        closeAdminModal();
        renderPensions();
    } else {
        const passInput = document.getElementById('adminPassword');
        passInput.style.borderColor = '#ef4444';
        passInput.value = '';
        passInput.placeholder = 'סיסמה שגויה!';
        setTimeout(() => {
            passInput.style.borderColor = 'var(--glass-border)';
            passInput.placeholder = 'סיסמה...';
        }, 2000);
    }
}

async function toggleVisibility(event, userId) {
    event.stopPropagation();
    const newStatus = event.target.checked;
    
    const { error } = await pensionsSupabase
        .from('profiles')
        .update({ is_visible: newStatus })
        .eq('user_id', userId);

    if (error) {
        console.error("Error updating visibility:", error);
        alert('שגיאה בעדכון הסטטוס');
        event.target.checked = !newStatus; // Rollback UI
    } else {
        // Update local data and re-render
        const pension = pensionsData.find(p => p.user_id === userId);
        if (pension) pension.is_visible = newStatus;
        
        // We only re-render if we want the "hidden" style to apply immediately
        renderPensions();
    }
}

function renderMarkers() {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const sortedData = sortPensions();
    const bounds = L.latLngBounds();
    let hasCoords = false;

    sortedData.forEach(p => {
        if (p.lat && p.lng) {
            const marker = L.marker([p.lat, p.lng]).addTo(map);
            marker.bindPopup(`
                <div style="direction: rtl; text-align: right;">
                    <h4 style="margin: 0 0 5px 0;">${p.business_name}</h4>
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b;">${p.location}</p>
                    <a href="order.html?owner=${p.user_id}" style="color: #6366f1; font-weight: bold; text-decoration: none; font-size: 12px;">מעבר להזמנה &raquo;</a>
                </div>
            `);
            
            marker.pensionId = p.user_id;
            markers.push(marker);
            bounds.extend([p.lat, p.lng]);
            hasCoords = true;
        }
    });

    if (hasCoords) {
        if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function focusPension(id) {
    const pension = pensionsData.find(p => p.user_id === id);
    if (pension && pension.lat && pension.lng) {
        map.flyTo([pension.lat, pension.lng], 14);
        
        // Find and open marker popup
        const marker = markers.find(m => m.pensionId === id);
        if (marker) marker.openPopup();
    }

    // Highlight in list
    document.querySelectorAll('.pension-card').forEach(c => {
        c.classList.toggle('active', c.dataset.id === id);
    });

    // On mobile, hide list after selection
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.remove('visible');
    }
}

function setupEventListeners() {
    document.getElementById('pensionSearch').addEventListener('input', () => {
        renderPensions();
        renderMarkers();
    });

    document.getElementById('sortByDistance').addEventListener('click', (e) => {
        activeFilter = 'distance';
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        processPensions();
    });

    document.getElementById('sortByPrice').addEventListener('click', (e) => {
        activeFilter = 'price';
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        processPensions();
    });

    document.getElementById('toggleMobileView').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('visible');
        const btn = document.getElementById('toggleMobileView');
        btn.innerHTML = sidebar.classList.contains('visible') 
            ? '<i class="fas fa-map"></i> הצג מפה' 
            : '<i class="fas fa-list"></i> הצג רשימה';
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
