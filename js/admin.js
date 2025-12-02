// =====================================================================
// ADMIN DASHBOARD (FINAL, CLEAN, MATCHES UPDATED SDK + HTML)
// =====================================================================

// --- AUTH -------------------------------------------------------------
import { getSession, logout } from "/js/sdk/auth.js";

// --- PROFILES ---------------------------------------------------------
import {
  getProfileById,
  getPendingUsers,
  approveUser,
  suspendUser,
  getUsersByZone
} from "/js/sdk/profiles.js";

// --- SCHEDULES --------------------------------------------------------
import {
  getAllSchedules
} from "/js/sdk/schedules.js";

// --- ASSIGNMENTS ------------------------------------------------------
import {
  getAssignmentsForAdmin,
  reassignClient
} from "/js/sdk/assignments.js";

// --- MATERIALS --------------------------------------------------------
import {
  getMaterialsForZone
} from "/js/sdk/materials.js";

// --- MESSAGING --------------------------------------------------------
import {
  sendMessage,
  subscribeMessages
} from "/js/sdk/messages.js";

// --- LIVE LOCATIONS ---------------------------------------------------
import { getLiveLocationsStream } from "/js/sdk/liveLocations.js";

// --- CLOCK EVENTS -----------------------------------------------------
import { clockIn, clockOut } from "/js/sdk/clockEvents.js";

// --- SHORTCUT ---------------------------------------------------------
const $ = (id) => document.getElementById(id);

// --- STATE ------------------------------------------------------------
let me = null;
let myId = null;
let zone = null;

// =====================================================================
// BOOT
// =====================================================================
async function boot() {
  // Session ------------------------------------------------------------
  const { userId } = await getSession();
  if (!userId) return (location.href = "/html/login.html");

  // Profile ------------------------------------------------------------
  me = await getProfileById(userId);
  if (!me) return (location.href = "/html/login.html");

  if (me.status !== "approved")
    return (location.href = "/html/pending.html");

  if (me.role !== "Admin")
    return (location.href = "/html/login.html");

  myId = me.id;
  zone = me.zone;

  // UI hydrate ---------------------------------------------------------
  if ($("#adminName")) $("#adminName").textContent = me.name;
  if ($("#adminZone")) $("#adminZone").textContent = zone ?? "—";

  // Modules ------------------------------------------------------------
  loadPendingApprovals();
  loadUsersList();
  loadSchedules();
  loadAssignments();
  loadMaterials();
  initMessaging();
  initLiveLocations();
  initClockControls();

  console.log("ADMIN DASHBOARD READY");
}

boot();

// =====================================================================
// PENDING APPROVALS
// =====================================================================
async function loadPendingApprovals() {
  const list = await getPendingUsers(zone);
  const box = $("#pendingBox");
  box.innerHTML = "";

  if (!list?.length) {
    box.innerHTML = `<p>No pending approvals.</p>`;
    return;
  }

  list.forEach((u) => {
    const wrap = document.createElement("div");
    wrap.className = "pending-item";
    wrap.innerHTML = `
      <div class="row space-between">
        <span><b>${u.name}</b> — ${u.role}</span>
        <button data-id="${u.id}" class="btn small primary approveBtn">
          Approve
        </button>
      </div>
    `;
    box.appendChild(wrap);
  });

  box.querySelectorAll(".approveBtn").forEach((btn) => {
    btn.onclick = async () => {
      await approveUser(btn.dataset.id);
      loadPendingApprovals();
      loadUsersList();
    };
  });
}

// =====================================================================
// USERS LIST
// =====================================================================
async function loadUsersList() {
  const users = await getUsersByZone(zone);
  const box = $("#usersList");
  box.innerHTML = "";

  users.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <span>${u.name} — ${u.role}</span>
      <button data-id="${u.id}" class="btn danger small suspendBtn">Suspend</button>
    `;
    box.appendChild(row);
  });

  box.querySelectorAll(".suspendBtn").forEach((btn) => {
    btn.onclick = async () => {
      await suspendUser(btn.dataset.id);
      loadUsersList();
    };
  });
}

// =====================================================================
// SCHEDULES
// =====================================================================
async function loadSchedules() {
  const schedules = await getAllSchedules(zone);
  const box = $("#scheduleBox");
  box.innerHTML = "";

  schedules.forEach((s) => {
    const el = document.createElement("div");
    el.className = "schedule-item";
    el.innerHTML = `
      <p><b>${s.instructor_name}</b> → ${s.client_name}</p>
      <p>${s.date} • ${s.time}</p>
    `;
    box.appendChild(el);
  });
}

// =====================================================================
// ASSIGNMENTS (CLIENT <-> INSTRUCTOR)
// =====================================================================
async function loadAssignments() {
  const assigns = await getAssignmentsForAdmin(zone);
  const box = $("#assignBox");
  box.innerHTML = "";

  if (!assigns.length) {
    box.innerHTML = `<p>No current assignments.</p>`;
    return;
  }

  assigns.forEach((a) => {
    const el = document.createElement("div");
    el.className = "assign-item";
    el.innerHTML = `
      <p><b>${a.client_name}</b> → ${a.instructor_name}</p>
      <button class="btn small reassignBtn" data-client="${a.client_id}">
        Reassign
      </button>
    `;
    box.appendChild(el);
  });

  box.querySelectorAll(".reassignBtn").forEach((btn) => {
    btn.onclick = async () => {
      const newInst = prompt("Enter new instructor ID:");
      if (!newInst) return;
      await reassignClient(btn.dataset.client, newInst);
      loadAssignments();
    };
  });
}

// =====================================================================
// MATERIALS
// =====================================================================
async function loadMaterials() {
  const materials = await getMaterialsForZone(zone);
  const box = $("#materialsBox");
  box.innerHTML = "";

  if (!materials.length) {
    box.innerHTML = `<p>No materials available.</p>`;
    return;
  }

  materials.forEach((m) => {
    const el = document.createElement("div");
    el.className = "material-item";
    el.innerHTML = `
      <p>${m.title}</p>
      <a href="${m.url}" target="_blank" class="btn small">Open</a>
    `;
    box.appendChild(el);
  });
}

// =====================================================================
// MESSAGING
// =====================================================================
function initMessaging() {
  const list = $("#messageList");

  // Listener
  subscribeMessages(myId, (msg) => {
    const el = document.createElement("div");
    el.className = "msg-item";
    el.innerHTML = `
      <p><b>${msg.sender_name}:</b> ${msg.body}</p>
    `;
    list.appendChild(el);
  });

  // Sender
  const sendBtn = $("#sendMsgBtn");
  const input = $("#msgInput");

  sendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;

    await sendMessage({
      sender_id: myId,
      scope: "zone",
      to_zone: zone,
      body: text
    });

    input.value = "";
  };
}

// =====================================================================
// LIVE LOCATIONS STREAM
// =====================================================================
function initLiveLocations() {
  const map = $("#liveMap");

  getLiveLocationsStream(zone, (loc) => {
    const p = document.createElement("p");
    p.textContent = `${loc.user_name} — ${loc.lat}, ${loc.lng}`;
    map.appendChild(p);
  });
}

// =====================================================================
// CLOCK CONTROLS
// =====================================================================
function initClockControls() {
  $("#clockInBtn").onclick = () => clockIn(myId);
  $("#clockOutBtn").onclick = () => clockOut(myId);
}

// =====================================================================
// LOGOUT
// =====================================================================
$("#logoutBtn").onclick = logout;
