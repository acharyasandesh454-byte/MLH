// ==================== APP STATE & MOCK DATA ====================
let currentToken = "";
let timerInterval = null;
let currentTimerSeconds = 15;
const REFRESH_INTERVAL = 15; // Seconds between QR code refreshes
let isSessionActive = true;
let customTotalCapacity = null; // Custom total capacity set by user

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

// ==================== INITIALIZATION & SCAN AUTO-DETECTION ====================
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  generateNewToken();
  startTokenTimer();
  renderRoster();
  updateMetrics();

  // Check if page was loaded via scanned QR Code URL
  const urlParams = new URLSearchParams(window.location.search);
  const scannedToken = urlParams.get('token');
  const viewMode = urlParams.get('view');

  if (viewMode === 'student' || scannedToken) {
    switchView('student');
    if (scannedToken) {
      document.getElementById('session-token').value = scannedToken;
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
    
    // Sync current session token if not already filled
    const tokenInput = document.getElementById('session-token');
    if (tokenInput && !tokenInput.value) {
      tokenInput.value = currentToken;
    }
  }
}

// ==================== DYNAMIC QR CODE GENERATOR ====================
function generateNewToken() {
  currentToken = "TOK-" + Math.random().toString(36).substring(2, 9).toUpperCase();
  renderQRCode(currentToken);
  
  // Sync token input if student check-in view is open
  const tokenInput = document.getElementById('session-token');
  if (tokenInput) tokenInput.value = currentToken;
}

function renderQRCode(token) {
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = ""; // Clear existing QR code

  // Generate URL pointing directly to student check-in page
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
    
    document.getElementById('timer-count').innerText = `${currentTimerSeconds}s`;
    document.getElementById('progress-fill').style.width = `${fillPercent}%`;

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
  lucide.createIcons();
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
  
  // Use manually entered total if provided, otherwise fallback to roster list size
  const total = customTotalCapacity !== null ? customTotalCapacity : rosterData.length;
  
  // Update input field display
  document.getElementById('input-total').value = total;

  // Calculate absent count and percentage
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
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  
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
    updateMetrics();
    renderRoster();
  }
}

// ==================== STUDENT SUBMISSION & CSV EXPORT ====================
function handleStudentSubmit(e) {
  e.preventDefault();
  
  const studentId = document.getElementById('student-id').value.trim();
  const studentName = document.getElementById('student-name').value.trim();
  const submittedToken = document.getElementById('session-token').value.trim();

  const successAlert = document.getElementById('checkin-success');
  const errorAlert = document.getElementById('checkin-error');

  successAlert.style.display = "none";
  errorAlert.style.display = "none";

  // Validate session token
  if (submittedToken !== currentToken || !isSessionActive) {
    errorAlert.style.display = "flex";
    return;
  }

  // Update or append student check-in
  let existingStudent = rosterData.find(s => s.id.toLowerCase() === studentId.toLowerCase());
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (existingStudent) {
    existingStudent.status = "present";
    existingStudent.time = currentTime;
    existingStudent.device = "Mobile Web Check-in";
  } else {
    rosterData.unshift({
      id: studentId.toUpperCase(),
      name: studentName,
      status: "present",
      time: currentTime,
      device: "Mobile Web Check-in"
    });
  }

  // Display success confirmation
  document.getElementById('success-timestamp').innerText = `Checked in at ${currentTime}`;
  successAlert.style.display = "flex";

  // Refresh dashboard metrics & table
  updateMetrics();
  renderRoster();

  // Clear inputs
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