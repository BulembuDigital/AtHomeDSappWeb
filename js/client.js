// ============================================================================
// CLIENT DASHBOARD — FINAL VERSION (Matches Updated SDK + HTML)
// ============================================================================

// --- AUTH -------------------------------------------------------------------
import { getSession, logout } from "/js/sdk/auth.js";

// --- PROFILES ---------------------------------------------------------------
import { getProfileById } from "/js/sdk/profiles.js";

// --- ASSIGNMENTS ------------------------------------------------------------
import { getMyInstructor } from "/js/sdk/assignments.js";

// --- SCHEDULES --------------------------------------------------------------
import {
  getMyLessons,
  requestCancelLesson
} from "/js/sdk/schedules.js";

// --- MATERIALS --------------------------------------------------------------
import { getMaterialsByZone } from "/js/sdk/materials.js";

// --- MESSAGES ---------------------------------------------------------------
import {
  getThreadMessages,
  sendMessage,
  subscribeMessages
} from "/js/sdk/messages.js";

// --- LIVE LOCATION ----------------------------------------------------------
import { getLiveLocationsStream } from "/js/sdk/liveLocations.js";

// --- CLOCK EVENTS -----------------------------------------------------------
import { clockIn, clockOut } from "/js/sdk/clockEvents.js";

// --- UI UTILITIES -----------------------------------------------------------
import { showSplash, hideSplash } from "/js/splash.js";
import { initTheme } from "/js/theme.js";

const $ = id => document.getElementById(id);

// ============================================================================
// STATE
// ============================================================================
let me = null;
let myId = null;
let zone = null;
let instructor = null;
let lessons = [];
let materials = [];

// ============================================================================
// BOOT
// ============================================================================
initTheme();
showSplash("Loading client dashboard…");

async function boot() {
  // SESSION ------------------------------------------------------------
  const { userId } = await getSession();
  if (!userId) return (location.href = "/html/login.html");
  myId = userId;

  // PROFILE -------------------------------------------------------------
  me = await getProfileById(myId);
  if (!me) return (location.href = "/html/signup.html");

  if (me.status !== "approved")
    return (location.href = "/html/pending.html");

  zone = me.zone;

  // LOAD DASHBOARD DATA ------------------------------------------------
  await loadDashboard();

  // LIVE GPS -----------------------------------------------------------
  initLiveTracking();

  hideSplash();
}

boot();

// ============================================================================
// LOAD DASHBOARD
// ============================================================================
async function loadDashboard() {
  instructor = await getMyInstructor(myId, zone);
  lessons = await getMyLessons(myId);
  materials = await getMaterialsByZone(zone);

  renderProfile();
  renderInstructor();
  renderLessons();
  renderMaterials();
}

// ============================================================================
// RENDERING
// ============================================================================
function renderProfile() {
  if ($("name")) $("name").textContent = me.name;
  if ($("zone")) $("zone").textContent = me.zone ?? "—";
}

function renderInstructor() {
  const box = $("instructorBox");
  if (!box) return;

  if (!instructor) {
    box.innerHTML = `<p>No instructor assigned yet.</p>`;
    return;
  }

  box.innerHTML = `
    <strong>${instructor.name}</strong>
    <p class="muted">${instructor.email ?? ""}</p>
    <button id="chatInstructor" class="btn primary">Chat</button>
  `;

  $("chatInstructor").onclick = () => openChat(instructor.id);
}

function renderLessons() {
  const box = $("lessonList");
  if (!box) return;

  box.innerHTML = "";

  if (!lessons.length) {
    box.innerHTML = `<p>No lessons booked yet.</p>`;
    return;
  }

  lessons.forEach(lesson => {
    const start = new Date(lesson.slot_start).toLocaleString();
    const end = new Date(lesson.slot_end).toLocaleString();

    const row = document.createElement("div");
    row.className = "lesson-card";
    row.innerHTML = `
      <div>
        <strong>${start}</strong><br />
        Until: ${end}
      </div>
      <button class="btn small cancelLesson" data-id="${lesson.id}">
        Cancel
      </button>
    `;

    box.appendChild(row);
  });

  box.querySelectorAll(".cancelLesson").forEach(btn => {
    btn.onclick = async () => {
      await requestCancelLesson(btn.dataset.id);
      alert("Cancellation request sent to Team Leader.");
      loadDashboard();
    };
  });
}

function renderMaterials() {
  const box = $("matList");
  if (!box) return;

  box.innerHTML = "";

  if (!materials.length) {
    box.innerHTML = `<p>No materials available yet.</p>`;
    return;
  }

  materials.forEach(m => {
    const item = document.createElement("div");
    item.className = "material-item";
    item.innerHTML = `
      <p><strong>${m.title}</strong></p>
      <a href="${m.url}" class="btn small" target="_blank">Open</a>
    `;
    box.appendChild(item);
  });
}

// ============================================================================
// CHAT SYSTEM
// ============================================================================
async function openChat(targetId) {
  showSplash("Loading chat…");

  const threadId = [myId, targetId].sort().join("-");

  const history = await getThreadMessages(threadId);
  renderChat(history);

  $("chatBox").dataset.thread = threadId;
  $("chatBox").dataset.target = targetId;

  // Live updates
  subscribeMessages(threadId, appendChat);

  hideSplash();
}

function renderChat(messages) {
  const box = $("chatBox");
  box.innerHTML = "";
  messages.forEach(appendChat);
}

function appendChat(msg) {
  const box = $("chatBox");

  const div = document.createElement("div");
  div.className = msg.sender_id === myId ? "msg me" : "msg other";
  div.textContent = msg.body;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

$("sendMsg").onclick = async () => {
  const body = $("msgBody").value.trim();
  if (!body) return;

  const thread = $("chatBox").dataset.thread;
  const target = $("chatBox").dataset.target;

  await sendMessage({
    thread_id: thread,
    scope: "user",
    to_user_id: target,
    body
  });

  $("msgBody").value = "";
};

// ============================================================================
// LIVE GPS
// ============================================================================
function initLiveTracking() {
  const latBox = $("gpsLat");
  const lngBox = $("gpsLng");
  const timeBox = $("gpsTime");
  if (!latBox || !lngBox) return;

  getLiveLocationsStream(myId, loc => {
    latBox.textContent = loc.lat.toFixed(6);
    lngBox.textContent = loc.lng.toFixed(6);
    timeBox.textContent = new Date(loc.timestamp).toLocaleTimeString();
  });
}

// ============================================================================
// CLOCK IN / OUT
// ============================================================================
$("clockIn")?.addEventListener("click", async () => {
  await clockIn(myId);
  alert("Clocked in.");
});

$("clockOut")?.addEventListener("click", async () => {
  await clockOut(myId);
  alert("Clocked out.");
});

// ============================================================================
// LOGOUT
// ============================================================================
$("logoutBtn")?.addEventListener("click", logout);
