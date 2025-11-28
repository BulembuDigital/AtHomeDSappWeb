// =====================================================================
// ADMIN DASHBOARD (SDK POWERED, CLEAN VERSION)
// =====================================================================

// --- AUTH & PROFILES --------------------------------------------------
import { getSession, signOut } from "./sdk/auth.js";
import {
  getMyProfile,
  getPendingUsers,
  approveUser,
  suspendUser,
  getUsersByZone,
} from "./sdk/profiles.js";

// --- SCHEDULES --------------------------------------------------------
import {
  getAllSchedules,
  getInstructorSlots,
  getInstructorsInZone,
} from "./sdk/schedules.js";

// --- ROUTES / ASSIGNMENTS / MATERIALS --------------------------------
import { getRoutes, getRouteById } from "./sdk/routes.js";
import {
  getAssignmentsForAdmin,
  assignInstructorToClient,
  reassignClient,
} from "./sdk/assignments.js";
import { getMaterialsForZone } from "./sdk/materials.js";

// --- MESSAGING --------------------------------------------------------
import {
  sendMessage,
  subscribeMessages,
  getRecipients,
} from "./sdk/messages.js";

// --- LIVE LOCATIONS + CLOCK EVENTS -----------------------------------
import { getLiveLocationsStream } from "./sdk/livelocations.js";
import { clockIn, clockOut } from "./sdk/clockEvents.js";

// --- UI HELPERS -------------------------------------------------------
const $ = (id) => document.getElementById(id);

// --- STATE ------------------------------------------------------------
let me = null;
let zone = null;
let myId = null;

// =====================================================================
// BOOT
// =====================================================================
async function boot() {
  // AUTH ---------------------------------------------------------------
  const { userId } = await getSession();
  if (!userId) return (location.href = "/html/login.html");

  // PROFILE ------------------------------------------------------------
  me = await getMyProfile();
  if (!me) return (location.href = "/html/login.html");

  if (me.status !== "approved")
    return (location.href = "/html/pending.html");

  if (me.role !== "admin")
    return (location.href = "/html/login.html");

  zone = me.zone;
  myId = me.id;

  // UI hydrate
  $("#adminName").textContent = me.name;
  $("#adminZone").textContent = zone;

  // Load dashboard modules
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

  if (!list.length) {
    box.innerHTML = `<p>No pending approvals.</p>`;
    return;
  }

  list.forEach((u) => {
    const el = document.createElement("div");
    el.className = "pending-item";
    el.innerHTML = `
      <p><b>${u.name}</b> (${u.role})</p>
      <button data-id="${u.id}" class="approveBtn">Approve</button>
    `;
    box.appendChild(el);
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
      <p>${u.name} — ${u.role}</p>
      <button data-id="${u.id}" class="suspendBtn">Suspend</button>
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

  assigns.forEach((a) => {
    const el = document.createElement("div");
    el.className = "assign-item";
    el.innerHTML = `
      <p>${a.client_name} → ${a.instructor_name}</p>
      <button data-client="${a.client_id}" class="reassignBtn">Reassign</button>
    `;
    box.appendChild(el);
  });

  box.querySelectorAll(".reassignBtn").forEach((btn) => {
    btn.onclick = async () => {
      const newInstructor = prompt("Enter new instructor ID:");
      if (!newInstructor) return;
      await reassignClient(btn.dataset.client, newInstructor);
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
    box.innerHTML = `<p>No materials yet.</p>`;
    return;
  }

  materials.forEach((m) => {
    const el = document.createElement("div");
    el.className = "material-item";
    el.innerHTML = `
      <p>${m.title}</p>
      <a href="${m.url}" target="_blank">Open</a>
    `;
    box.appendChild(el);
  });
}

// =====================================================================
// MESSAGING
// =====================================================================
function initMessaging() {
  const msgList = $("#messageList");

  // Subscriptions
  subscribeMessages(myId, (msg) => {
    const el = document.createElement("div");
    el.className = "msg-item";
    el.innerHTML = `<p><b>${msg.sender_name}:</b> ${msg.body}</p>`;
    msgList.appendChild(el);
  });

  // Send message
  $("#sendMsgBtn").onclick = async () => {
    const text = $("#msgInput").value.trim();
    if (!text) return;

    await sendMessage({
      sender_id: myId,
      body: text,
      scope: "zone",
      to_zone: zone,
    });

    $("#msgInput").value = "";
  };
}

// =====================================================================
// LIVE LOCATION STREAM
// =====================================================================
function initLiveLocations() {
  const mapArea = $("#liveMap");

  getLiveLocationsStream(zone, (loc) => {
    const p = document.createElement("p");
    p.textContent = `${loc.user_name}: ${loc.lat}, ${loc.lng}`;
    mapArea.appendChild(p);
  });
}

// =====================================================================
// CLOCK IN / OUT
// =====================================================================
function initClockControls() {
  $("#clockInBtn").onclick = () => clockIn(myId);
  $("#clockOutBtn").onclick = () => clockOut(myId);
}

// =====================================================================
// SIGN OUT
// =====================================================================
$("#logoutBtn").onclick = async () => {
  await signOut();
  location.href = "/html/login.html";
};
