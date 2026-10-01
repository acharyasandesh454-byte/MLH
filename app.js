// ==================== APP STATE & MOCK DATA ====================
let currentToken = "";
let validTokens = []; // Buffer array to keep tokens valid for 90s (prevents expiration while student fills form)
const TOKEN_LIFESPAN_MS = 90000; // 90 seconds grace period

let timerInterval = null;
let currentTimerSeconds = 15;
const REFRESH_INTERVAL = 15; // Seconds between QR code refreshes
let isSessionActive = true;
let customTotalCapacity = null;

// Setup Cross-Tab Communication Channel
const attendanceChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("attend_qr_channel") : null;

// Pre-populated Student Roster
let rosterData = [
  { id: "STU-101", name: "Alex Morgan", status: "present", time: "09:01 AM", device: "iPhone 14 (Safari)" },
  { id: "STU-102", name: "Liam Johnson", status: "present", time: "09:02 AM", device: "Pixel 7 (Chrome)" },
  { id: "STU-103", name: "Sophia Chen", status: "present", time: "09:03 AM", device: "Galaxy S23 (Chrome)" },
  { id: "STU-104", name: "Noah Williams", status: "absent", time: "--", device: "--" },
  { id: "STU-105", name: "Emma Brown", status: "present", time: "09:04 AM", device: "iPhone 13 (Safari)" },
  { id: "STU-106", name: "Oliver Davis", status: "present", time: "09:05 AM", device: "OnePlus 11 (Chrome)" },
  { id: "STU-107", name: "Ava Miller", status: "absent", time: "--", device: "--" },
  { id: "STU-108", name: "Ethan Wilson", status: "present", time: "09:06 AM", device: "iPhone 12 (Safari)" },
  { id: "STU-109", name: "Isabella Taylor", status: "present", time: "09:07 AM", device: "Pixel 6 (Chrome)" },
  { id: "STU-110", name: "Lucas Anderson", status: "absent", time: "--", device: "--" },
  { id: "STU-111", name: "Mia Thomas", status: "present", time: "09:08 AM", device: "iPhone 15 (Safari)" },
  { id: "STU-112", name: "Benjamin Jackson", status: "present", time: "09:08 AM", device: "Galaxy S22 (Chrome)" },
  { id: "STU-113", name: "Charlotte White", status: "absent", time: "--", device: "--" },
  { id: "STU-114", name: "Amelia Harris", status: "present", time: "09:09 AM", device: "iPhone 13 (Safari)" },
  { id: "STU-115", name: "James Martin", status: "present", time: "09:10 AM", device: "Pixel 7a (Chrome)" },
  { id: "STU-116", name: "Harper Thompson", status: "absent", time: "--", device: "--" },
  { id: "STU-117", name: "Alexander Garcia", status: "present", time: "09:11 AM", device: "iPhone 14 Pro (Safari)" },
  { id: "STU-118", name: "Evelyn Martinez", status: "present", time: "09:11 AM", device: "Galaxy A54 (Chrome)" },
  { id: "STU-119", name: "Daniel Robinson", status: "present", time: "09:12 AM", device: "Xiaomi 13 (Chrome)" },
  { id: "STU-120", name: "Abigail Clark", status: "absent", time: "--", device: "--" },
  { id: "STU-121", name: "Henry Rodriguez", status: "present", time: "09:12 AM", device: "iPhone 11 (Safari)" },
  { id: "STU-122", name: "Ella Lewis", status: "present", time: "09:13 AM", device: "Pixel 8 (Chrome)" },
  { id: "STU-123", name: "Sebastian Lee", status: "present", time: "09:14 AM", device: "Galaxy S21 (Chrome)" },
  { id: "STU-124", name: "Aria Walker", status: "present", time: "09:14 AM", device: "iPhone 12 (Safari)" },
  { id: "STU-125", name: "Jack Hall", status: "absent", time: "--", device: "--" }
];

let activeFilter = 'all';

// Load stored roster if returning to session
if (localStorage.getItem('attendqr_roster')) {
  try {
    rosterData = JSON.parse(localStorage.getItem('attendqr_roster'));
  } catch (e) {
    console.error("Could not parse saved roster:", e);
  }
}

// Save initial/updated roster state
function saveRosterState() {
  localStorage.setItem('attendqr_roster', JSON.stringify(rosterData));
}

// ==================== INITIALIZATION & LISTENERS ====================
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  
  generateNewToken();
  startTokenTimer();
  renderRoster();
  updateMetrics();

  // Listen for broadcasted student check-ins from other tabs
  if (attendanceChannel) {
    attendanceChannel.onmessage = (event) => {
      if (event.data && event.data.type === "CHECK_IN") {
        processCheckInRecord(event.data.payload);
      }
    };
  }

  // Fallback storage sync listener
  window.addEventListener('storage', (e) => {
    if (e.key === 'attendqr_roster' && e.newValue) {
      rosterData = JSON.parse(e.newValue);
      renderRoster();
      updateMetrics();
    }
  });

  // Auto-detect view from scanned URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const scannedToken = urlParams.get('token');
  const viewMode = urlParams.get('view');

  if (viewMode === 'student' || scannedToken) {
    switchView('student');
    if (scannedToken) {
      const tokenInput = document.getElementById('session-token');
      if (tokenInput) tokenInput.value = scannedToken;
    }
  }
});

// ==================== VIEW SWITCHING ====================
function switchView(viewName) {
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));

  if (viewName === 'host') {
    document.getElementById('host-view').classList.add('active');
    document.getElementById('btn-host-view').classList.add('active');
  } else {
    document.getElementById('student-view').classList.add('active');
    document.getElementById('btn-student-view').classList.add('active');
    
    const tokenInput = document.getElementById('session-token');
    if (tokenInput && !tokenInput.value) {
      tokenInput.value = currentToken;
    }
  }
}

// ==================== DYNAMIC QR & TOKEN MANAGEMENT ====================
function generateNewToken() {
  currentToken = "TOK-" + Math.random().toString(36).substring(2, 9).toUpperCase();
  
  const now = Date.now();
  validTokens.push({ token: currentToken, expiry: now + TOKEN_LIFESPAN_MS });
  
  // Clean up expired tokens older than 90 seconds
  validTokens = validTokens.filter(t => t.expiry > now);

  // Sync latest valid tokens across local storage
  localStorage.setItem('attendqr_valid_tokens', JSON.stringify(validTokens));

  renderQRCode(currentToken);
  
  const tokenInput = document.getElementById('session-token');
  if (tokenInput) tokenInput.value = currentToken;
}

function validateToken(tokenToTest) {
  const now = Date.now();
  let tokens = validTokens;

  // Pull tokens from storage in case student is on another tab
  const storedTokens = localStorage.getItem('attendqr_valid_tokens');
  if (storedTokens) {
    try {
      tokens = JSON.parse(storedTokens);
    } catch(e) {}
  }

  return tokens.some(t => t.token === tokenToTest && t.expiry > now);
}

function renderQRCode(token) {
  const qrContainer = document.getElementById("qrcode");
  if (!qrContainer) return;
  
  qrContainer.innerHTML = "";

  const baseURL = window.location.href.split('?')[0];
  const checkinURL = `${baseURL}?view=student&token=${token}`;

  new QRCode(qrContainer, {
    text: checkinURL,
    width: 200,
    height: 200,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function startTokenTimer() {
  clearInterval(timerInterval);
  currentTimerSeconds = REFRESH_INTERVAL;

  timerInterval = setInterval(() => {
    if (!isSessionActive) return;

    currentTimerSeconds--;
    const fillPercent = (currentTimerSeconds / REFRESH_INTERVAL) * 100;
    
    const timerElem = document.getElementById('timer-count');
    const fillElem = document.getElementById('progress-fill');
    
    if (timerElem) timerElem.innerText = `${currentTimerSeconds}s`;
    if (fillElem) fillElem.style.width = `${fillPercent}%`;

    if (currentTimerSeconds <= 0) {
      generateNewToken();
      currentTimerSeconds = REFRESH_INTERVAL;
    }
  }, 1000);
}

function forceRefreshQR() {
  generateNewToken();
  startTokenTimer();
}

function toggleSessionState() {
  isSessionActive = !isSessionActive;
  const badge = document.getElementById('qr-status-badge');
  const btn = document.getElementById('btn-pause');

  if (isSessionActive) {
    badge.className = "badge badge-success";
    badge.innerText = "Active";
    btn.innerHTML = `<i data-lucide="pause-circle"></i> Pause Session`;
  } else {
    badge.className = "badge badge-danger";
    badge.innerText = "Paused";
    btn.innerHTML = `<i data-lucide="play-circle"></i> Resume Session`;
  }
  if (window.lucide) lucide.createIcons();
}

// ==================== ROSTER & METRICS ====================
function updateTotalEnrolled() {
  const inputVal = parseInt(document.getElementById('input-total').value, 10);
  if (!isNaN(inputVal) && inputVal > 0) {
    customTotalCapacity = inputVal;
    updateMetrics();
  }
}

function updateMetrics() {
  const scannedPresent = rosterData.filter(s => s.status === 'present').length;
  const total = customTotalCapacity !== null ? customTotalCapacity : rosterData.length;
  
  const totalInput = document.getElementById('input-total');
  if (totalInput) totalInput.value = total;

  const absent = Math.max(0, total - scannedPresent);
  const rate = total > 0 ? Math.round((scannedPresent / total) * 100) : 0;

  document.getElementById('count-present').innerText = scannedPresent;
  document.getElementById('count-absent').innerText = absent;
  document.getElementById('count-rate').innerText = `${rate}%`;

  document.getElementById('filter-present-count').innerText = scannedPresent;
  document.getElementById('filter-absent-count').innerText = absent;
}

function renderRoster() {
  const tbody = document.getElementById('roster-tbody');
  if (!tbody) return;

  const searchInput = document.getElementById('search-input');
  const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';
  
  tbody.innerHTML = "";

  const filtered = rosterData.filter(student => {
    const matchesFilter = (activeFilter === 'all') || (student.status === activeFilter);
    const matchesSearch = student.name.toLowerCase().includes(searchQuery) || student.id.toLowerCase().includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  filtered.forEach(student => {
    const tr = document.createElement('tr');
    
    const isPresent = student.status === 'present';
    const statusBadge = isPresent 
      ? `<span class="badge badge-success">Present</span>`
      : `<span class="badge badge-danger">Absent</span>`;
    
    const actionBtn = isPresent
      ? `<button class="btn-action" onclick="toggleStudentStatus('${student.id}')">Mark Absent</button>`
      : `<button class="btn-action" onclick="toggleStudentStatus('${student.id}')">Mark Present</button>`;

    tr.innerHTML = `
      <td><strong>${student.id}</strong></td>
      <td>${student.name}</td>
      <td>${student.time}</td>
      <td><small>${student.device}</small></td>
      <td>${statusBadge}</td>
      <td>${actionBtn}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

function filterRoster(filter, buttonEl) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  buttonEl.classList.add('active');
  renderRoster();
}

function handleSearch() {
  renderRoster();
}

function toggleStudentStatus(studentId) {
  const student = rosterData.find(s => s.id === studentId);
  if (student) {
    if (student.status === 'present') {
      student.status = 'absent';
      student.time = '--';
      student.device = '--';
    } else {
      student.status = 'present';
      student.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      student.device = 'Manual Check-in';
    }
    saveRosterState();
    updateMetrics();
    renderRoster();
  }
}

// ==================== PROCESS STUDENT CHECK-IN ====================
function processCheckInRecord(record) {
  let existingStudent = rosterData.find(s => s.id.toLowerCase() === record.id.toLowerCase());

  if (existingStudent) {
    existingStudent.name = record.name; // Keep name synced
    existingStudent.status = "present";
    existingStudent.time = record.time;
    existingStudent.device = record.device;
  } else {
    // Add new student to top of roster
    rosterData.unshift({
      id: record.id.toUpperCase(),
      name: record.name,
      status: "present",
      time: record.time,
      device: record.device
    });
  }

  saveRosterState();
  updateMetrics();
  renderRoster();
}

// ==================== STUDENT SUBMISSION & EXPORT ====================
function handleStudentSubmit(e) {
  e.preventDefault();
  
  const studentId = document.getElementById('student-id').value.trim();
  const studentName = document.getElementById('student-name').value.trim();
  const submittedToken = document.getElementById('session-token').value.trim();

  const successAlert = document.getElementById('checkin-success');
  const errorAlert = document.getElementById('checkin-error');

  successAlert.style.display = "none";
  errorAlert.style.display = "none";

  // Validate submitted token against valid token window
  const isValid = validateToken(submittedToken);

  if (!isValid || !isSessionActive) {
    errorAlert.style.display = "flex";
    return;
  }

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const checkInPayload = {
    id: studentId.toUpperCase(),
    name: studentName,
    time: currentTime,
    device: "Mobile Web Check-in"
  };

  // 1. Process check-in locally
  processCheckInRecord(checkInPayload);

  // 2. Broadcast check-in to host tab/screen
  if (attendanceChannel) {
    attendanceChannel.postMessage({ type: "CHECK_IN", payload: checkInPayload });
  }

  // 3. Show confirmation alert
  document.getElementById('success-timestamp').innerText = `Checked in at ${currentTime}`;
  successAlert.style.display = "flex";

  // Reset input fields
  document.getElementById('student-id').value = "";
  document.getElementById('student-name').value = "";
}

function exportToCSV() {
  const headers = ["Student ID", "Full Name", "Status", "Check-in Time", "Device Verification"];
  
  const rows = rosterData.map(student => [
    `"${student.id}"`,
    `"${student.name}"`,
    `"${student.status.toUpperCase()}"`,
    `"${student.time}"`,
    `"${student.device}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Attendance_CS101_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}