// ============================================================================
// INSTRUCTOR DASHBOARD — FINAL VERSION (Matches Updated SDK + HTML)
// ============================================================================

// --- AUTH -------------------------------------------------------------------
import { getSession, logout } from "/js/sdk/auth.js";

// --- PROFILES ---------------------------------------------------------------
import { getProfileById } from "/js/sdk/profiles.js";

// --- SCHEDULES --------------------------------------------------------------
import {
  getInstructorSlots,
  addSlot,
  deleteSlot
} from "/js/sdk/schedules.js";

// --- ASSIGNMENTS ------------------------------------------------------------
import { getMyStudents } from "/js/sdk/assignments.js";

// --- MATERIALS --------------------------------------------------------------
import { getMaterialsByZone } from "/js/sdk/materials.js";

// --- MESSAGES ---------------------------------------------------------------
import {
  getThreadMessages,
  sendMessage,
  subscribeMessages
} from "/js/sdk/messages.js";

// --- LIVE LOCATIONS ---------------------------------------------------------
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
let students = [];
let materials = [];

// ============================================================================
// BOOT
// ============================================================================
initTheme();
showSplash("Loading instructor dashboard…");

async function boot() {
  // SESSION ------------------------------------------------------------
  const { userId } = await getSession();
  if (!userId) return (location.href = "/html/login.html");
  myId = userId;

  // PROFILE -------------------------------------------------------------
  me = await getProfileById(myId);
  if (!me) return location.href = "/html/signup.html";
  if (me.status !== "approved")
    return location.href = "/html/pending.html";

  zone = me.zone;

  // LOAD DASHBOARD DATA ------------------------------------------------
  await loadDashboard();

  // LIVE GPS -----------------------------------------------------------
  initLiveTracking();

  hideSplash();
}

boot();

// ============================================================================
// LOAD EVERYTHING
// ============================================================================
async function loadDashboard() {
  // Assigned students
  students = await getMyStudents(myId, zone);

  // Materials
  materials = await getMaterialsByZone(zone);

  // Slots
  const slots = await getInstructorSlots(myId);

  renderProfile();
  renderStudents();
  renderSlots(slots);
  renderMaterials();
}

// ============================================================================
// PROFILE
// ============================================================================
function renderProfile() {
  if ($("name")) $("name").textContent = me.name;
  if ($("zone")) $("zone").textContent = me.zone ?? "—";
}

// ============================================================================
// STUDENTS
// ============================================================================
function renderStudents() {
  const box = $("studentsList");
  if (!box) return;

  box.innerHTML = "";

  if (!students.length) {
    box.innerHTML = `<p>No assigned clients yet.</p>`;
    return;
  }

  students.forEach(s => {
    const div = document.createElement("div");
    div.className = "list-row";
    div.innerHTML = `
      <strong>${s.name}</strong>
      <button class="btn small openChat" data-id="${s.id}">Chat</button>
    `;
    box.appendChild(div);
  });

  // Chat bindings
  box.querySelectorAll(".openChat").forEach(btn => {
    btn.onclick = () => openChat(btn.dataset.id);
  });
}

// ============================================================================
// SLOTS
// ============================================================================
function renderSlots(slots) {
  const box = $("slotList");
  if (!box) return;

  box.innerHTML = "";

  if (!slots.length) {
    box.innerHTML = `<p>No scheduled slots.</p>`;
    return;
  }

  slots.forEach(slot => {
    const div = document.createElement("div");
    div.className = "slot";
    div.innerHTML = `
      <span>${new Date(slot.slot_start).toLocaleString()}</span>
      <button class="btn small delSlot" data-id="${slot.id}">Delete</button>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll(".delSlot").forEach(btn => {
    btn.onclick = async () => {
      await deleteSlot(btn.dataset.id);
      loadDashboard();
    };
  });
}

if ($("addSlotBtn")) {
  $("addSlotBtn").onclick = async () => {
    const date = $("slotDate").value;
    const start = $("slotStart").value;
    if (!date || !start) return alert("Pick date & time.");

    const slotStart = new Date(`${date}T${start}`);
    await addSlot(myId, slotStart.toISOString());

    loadDashboard();
  };
}

// ============================================================================
// MATERIALS
// ============================================================================
function renderMaterials() {
  const box = $("matList");
  if (!box) return;

  box.innerHTML = "";

  if (!materials.length) {
    box.innerHTML = `<p>No materials for your zone.</p>`;
    return;
  }

  materials.forEach(m => {
    const item = document.createElement("div");
    item.className = "material-row";
    item.innerHTML = `
      <strong>${m.title}</strong>
      <a href="${m.url}" class="btn small" target="_blank">Open</a>
    `;
    box.appendChild(item);
  });
}

// ============================================================================
// CHAT SYSTEM
// ============================================================================
async function openChat(clientId) {
  showSplash("Opening chat…");

  const threadId = [myId, clientId].sort().join("-");

  const history = await getThreadMessages(threadId);
  renderChat(history);

  $("chatBox").dataset.thread = threadId;
  $("chatBox").dataset.target = clientId;

  subscribeMessages(threadId, msg => appendChat(msg));

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

if ($("sendMsg")) {
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
}

// ============================================================================
// LIVE GPS
// ============================================================================
function initLiveTracking() {
  if (!$("gpsLat")) return;

  getLiveLocationsStream(myId, loc => {
    $("gpsLat").textContent = loc.lat.toFixed(6);
    $("gpsLng").textContent = loc.lng.toFixed(6);
    $("gpsTime").textContent = new Date(loc.timestamp).toLocaleTimeString();
  });
}

// ============================================================================
// CLOCK
// ============================================================================
if ($("clockIn")) {
  $("clockIn").onclick = async () => {
    await clockIn(myId);
    alert("Clocked in");
  };
}

if ($("clockOut")) {
  $("clockOut").onclick = async () => {
    await clockOut(myId);
    alert("Clocked out");
  };
}

// ============================================================================
// LOGOUT
// ============================================================================
if ($("logoutBtn")) {
  $("logoutBtn").onclick = logout;
}
