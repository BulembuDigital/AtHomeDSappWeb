// =====================================================================
// MANAGER DASHBOARD
// =====================================================================

// --- AUTH & PROFILE ---------------------------------------------------
import { getSession, signOut } from "./sdk/auth.js";
import { getMyProfile, getUsersByZone } from "./sdk/profiles.js";

// --- SCHEDULES --------------------------------------------------------
import { getAllSchedules } from "./sdk/schedules.js";

// --- MATERIALS --------------------------------------------------------
import {
  getMaterialsForZone,
  createMaterial,
} from "./sdk/materials.js";

// --- ASSIGNMENTS ------------------------------------------------------
import {
  getAssignmentsForAdmin as getZoneAssignments,
} from "./sdk/assignments.js";

// --- MESSAGING --------------------------------------------------------
import {
  sendMessage,
  subscribeMessages,
  getRecipients,
} from "./sdk/messages.js";

// --- LIVE LOCATIONS ---------------------------------------------------
import { getLiveLocationsStream } from "./sdk/livelocations.js";

// --- CLOCK EVENTS -----------------------------------------------------
import { clockIn, clockOut } from "./sdk/clockEvents.js";

// --- UI HELPERS -------------------------------------------------------
const $ = (id) => document.getElementById(id);

// --- STATE ------------------------------------------------------------
let me = null;
let myId = null;
let zone = null;

// =====================================================================
// BOOT
// =====================================================================
async function boot() {
  // Auth session
  const { userId } = await getSession();
  if (!userId) return (location.href = "/html/login.html");

  // Profile check
  me = await getMyProfile();
  if (!me) return location.replace("/html/login.html");
  if (me.status !== "approved") return location.replace("/html/pending.html");
  if (me.role !== "manager") return location.replace("/html/login.html");

  myId = me.id;
  zone = me.zone;

  $("#mgrName").textContent = me.name || "Manager";
  $("#mgrZone").textContent = zone;

  // Load dashboard modules
  loadSchedules();
  loadZoneUsers();
  loadZoneAssignments();
  loadMaterials();
  initMessaging();
  initLiveLocations();
  initClockControls();

  console.log("MANAGER DASHBOARD READY");
}

boot();

// =====================================================================
// SCHEDULES (Zone-bound)
// =====================================================================
async function loadSchedules() {
  const schedules = await getAllSchedules(zone);
  const box = $("#scheduleBox");

  box.innerHTML = "";

  if (!schedules.length) {
    box.innerHTML = "<p>No schedules.</p>";
    return;
  }

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
// USERS (Instructor + Clients in zone)
// =====================================================================
async function loadZoneUsers() {
  const users = await getUsersByZone(zone);
  const instructors = users.filter((u) => u.role === "instructor");
  const clients = users.filter((u) => u.role === "client");

  // Instructors
  const iBox = $("#instructorsBox");
  iBox.innerHTML = "";

  instructors.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `<p>${u.name}</p>`;
    iBox.appendChild(row);
  });

  // Clients
  const cBox = $("#clientsBox");
  cBox.innerHTML = "";

  clients.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `<p>${u.name}</p>`;
    cBox.appendChild(row);
  });
}

// =====================================================================
// ASSIGNMENTS — Manager sees all instructor-client pairs in their zone
// =====================================================================
async function loadZoneAssignments() {
  const assigns = await getZoneAssignments(zone);
  const box = $("#assignBox");
  box.innerHTML = "";

  if (!assigns.length) {
    box.innerHTML = "<p>No assignments yet.</p>";
    return;
  }

  assigns.forEach((a) => {
    const row = document.createElement("div");
    row.className = "assign-item";
    row.innerHTML = `
      <p>${a.client_name} → ${a.instructor_name}</p>
    `;
    box.appendChild(row);
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
    box.innerHTML = "<p>No materials yet.</p>";
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

// Manager uploads materials (ex: images, pdfs)
$("#uploadMaterialBtn")?.addEventListener("click", async () => {
  const title = $("#matTitle").value.trim();
  const file = $("#matFile").files?.[0];
  if (!title || !file) return alert("Missing fields.");

  await createMaterial({
    title,
    file,
    created_by: myId,
    zone,
    roles: ["instructor", "client", "team_leader", "manager"],
  });

  $("#matTitle").value = "";
  $("#matFile").value = "";
  loadMaterials();
});

// =====================================================================
// MESSAGING (zone-bound, plus user & role chat)
// =====================================================================
function initMessaging() {
  const msgList = $("#messageList");

  // Live subscription
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
// LIVE LOCATION STREAM (instructors only)
// =====================================================================
function initLiveLocations() {
  const box = $("#liveLocBox");

  getLiveLocationsStream(zone, (loc) => {
    const p = document.createElement("p");
    p.textContent = `${loc.user_name}: ${loc.lat}, ${loc.lng}`;
    box.appendChild(p);
  });
}

// =====================================================================
// CLOCK IN / CLOCK OUT
// =====================================================================
function initClockControls() {
  $("#clockInBtn").onclick = () => clockIn(myId);
  $("#clockOutBtn").onclick = () => clockOut(myId);
}

// =====================================================================
// LOGOUT
// =====================================================================
$("#logoutBtn").onclick = async () => {
  await signOut();
  location.href = "/html/login.html";
};
