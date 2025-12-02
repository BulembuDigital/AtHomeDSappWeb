// =====================================================================
// MANAGER DASHBOARD — FINAL, CLEAN, SDK-ALIGNED VERSION
// =====================================================================

// AUTH + PROFILES ------------------------------------------------------
import { getSession, logout } from "/js/sdk/auth.js";
import { getMyProfile, getUsersByZone } from "/js/sdk/profiles.js";

// SCHEDULES ------------------------------------------------------------
import { getAllSchedules } from "/js/sdk/schedules.js";

// MATERIALS ------------------------------------------------------------
import { getMaterialsForZone, createMaterial } from "/js/sdk/materials.js";

// ASSIGNMENTS ----------------------------------------------------------
import { getAssignmentsForAdmin as getZoneAssignments } from "/js/sdk/assignments.js";

// MESSAGING ------------------------------------------------------------
import { sendMessage, subscribeMessages } from "/js/sdk/messages.js";

// LIVE LOCATIONS -------------------------------------------------------
import { getLiveLocationsStream } from "/js/sdk/liveLocations.js";

// CLOCK EVENTS ----------------------------------------------------------
import { clockIn, clockOut } from "/js/sdk/clockEvents.js";

// UI helper -------------------------------------------------------------
const $ = (id) => document.getElementById(id);

// STATE ----------------------------------------------------------------
let me = null;
let myId = null;
let zone = null;

// =====================================================================
// BOOT
// =====================================================================
async function boot() {
  // Auth
  const { userId } = await getSession();
  if (!userId) return (location.href = "/html/login.html");
  myId = userId;

  // Profile
  me = await getMyProfile();
  if (!me) return (location.href = "/html/login.html");

  if (me.status !== "approved")
    return (location.href = "/html/pending.html");

  if (me.role !== "Manager")
    return (location.href = "/html/login.html");

  zone = me.zone;

  // UI hydrate
  $("#mgrName").textContent = me.name ?? "Manager";
  $("#mgrZone").textContent = zone ?? "—";

  // Load dashboard sections
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
// SCHEDULES — All schedules in manager’s zone
// =====================================================================
async function loadSchedules() {
  const schedules = await getAllSchedules(zone);
  const box = $("#scheduleBox");

  box.innerHTML = "";

  if (!schedules?.length) {
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
// ZONE USERS — Instructors & Clients
// =====================================================================
async function loadZoneUsers() {
  const users = await getUsersByZone(zone);

  const instructors = users.filter((u) => u.role === "Instructor");
  const clients = users.filter((u) => u.role === "Client");

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
// ASSIGNMENTS — Instructor <-> Client pairs
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
    row.innerHTML = `<p>${a.client_name} → ${a.instructor_name}</p>`;
    box.appendChild(row);
  });
}

// =====================================================================
// MATERIALS — View & Upload
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

// Upload Material
$("#materialUpload")?.addEventListener("click", async () => {
  const title = $("#matTitle").value.trim();
  const file = $("#matFile").files?.[0];

  if (!title || !file) return alert("Missing fields.");

  await createMaterial({
    title,
    file,
    zone,
    created_by: myId,
    roles: ["Instructor", "Client", "Team Leader", "Manager"],
  });

  $("#matTitle").value = "";
  $("#matFile").value = "";
  loadMaterials();
});

// =====================================================================
// MESSAGING
// =====================================================================
function initMessaging() {
  const list = $("#messageList");

  subscribeMessages(myId, (msg) => {
    const el = document.createElement("div");
    el.className = "msg-item";
    el.innerHTML = `<p><b>${msg.sender_name}:</b> ${msg.body}</p>`;
    list.appendChild(el);
  });

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
// LIVE LOCATION STREAM — Instructors in zone
// =====================================================================
function initLiveLocations() {
  const box = $("#liveLocBox");

  getLiveLocationsStream(zone, (point) => {
    const p = document.createElement("p");
    p.textContent = `${point.user_name}: ${point.lat}, ${point.lng}`;
    box.appendChild(p);
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
$("#logoutBtn").onclick = async () => {
  await logout();
};
