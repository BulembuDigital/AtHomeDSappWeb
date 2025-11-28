// =====================================================================
// SUPERVISOR DASHBOARD (Global Access)
// =====================================================================

// AUTH
import { getSession, signOut } from "./sdk/auth.js";

// PROFILES
import {
  getMyProfile,
  getAllProfiles,
  updateStatus,
  searchProfiles,
} from "./sdk/profiles.js";

// SCHEDULES
import { getAllSchedules } from "./sdk/schedules.js";

// CLOCK EVENTS
import { getClockEventsForAll } from "./sdk/clockEvents.js";

// MATERIALS
import {
  getMaterialsGlobal,
  createMaterial,
} from "./sdk/materials.js";

// MESSAGES
import {
  sendMessage,
  subscribeMessages,
  getRecipients,
} from "./sdk/messages.js";

// LIVE LOCATIONS
import { getLiveLocationsStream } from "./sdk/livelocations.js";

// HELPERS
const $ = (id) => document.getElementById(id);

// STATE
let me = null;
let myId = null;

// =====================================================================
// BOOT
// =====================================================================
async function boot() {
  // Session check
  const { userId } = await getSession();
  if (!userId) return (location.href = "/html/login.html");

  // Role + profile check
  me = await getMyProfile();
  if (!me || me.role !== "supervisor") {
    return location.replace("/html/login.html");
  }
  if (me.status !== "approved") {
    return location.replace("/html/pending.html");
  }

  myId = me.id;

  $("#supName").textContent = me.name || "Supervisor";

  loadAllUsers();
  loadSchedules();
  loadClockEvents();
  loadMaterials();
  initMessaging();
  initLiveLocations();
  initEmergencyControls();

  console.log("SUPERVISOR DASHBOARD READY");
}

boot();

// =====================================================================
// USER DIRECTORY (Supervisor sees everyone)
// =====================================================================
async function loadAllUsers() {
  const list = $("#userList");
  list.innerHTML = "<p>Loading…</p>";

  const users = await getAllProfiles();

  list.innerHTML = "";

  users.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <b>${u.name || u.email}</b>
      <span>${u.role}</span>
      <span>${u.status}</span>
      <button class="btn" data-suspend="${u.id}" ${
      u.role === "supervisor" ? "disabled" : ""
    }>Suspend</button>
    `;
    list.appendChild(row);
  });

  list.onclick = async (e) => {
    if (e.target.dataset.suspend) {
      const uid = e.target.dataset.suspend;

      if (!confirm("Suspend this user?")) return;

      await updateStatus(uid, "suspended");
      await loadAllUsers();
    }
  };
}

// =====================================================================
// USER SEARCH (global search)
// =====================================================================
$("#searchUserBtn").onclick = async () => {
  const q = $("#searchUserInput").value.trim();
  if (!q) return loadAllUsers();

  const results = await searchProfiles(q);
  const box = $("#userList");
  box.innerHTML = "";

  results.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <p><b>${u.name}</b> (${u.role})</p>
    `;
    box.appendChild(row);
  });
};

// =====================================================================
// SCHEDULES (global)
// =====================================================================
async function loadSchedules() {
  const sched = await getAllSchedules(); // no zone filter
  const box = $("#scheduleBox");

  box.innerHTML = "";

  sched.forEach((s) => {
    const el = document.createElement("div");
    el.className = "schedule-item";
    el.innerHTML = `
      <p><b>${s.instructor_name}</b> → ${s.client_name}</p>
      <p>${s.date} ${s.time}</p>
    `;
    box.appendChild(el);
  });
}

// =====================================================================
// CLOCK EVENTS (global)
// =====================================================================
async function loadClockEvents() {
  const events = await getClockEventsForAll();
  const box = $("#clockEventsBox");

  box.innerHTML = "";

  events.forEach((ev) => {
    const el = document.createElement("div");
    el.className = "clock-row";
    el.innerHTML = `
      <b>${ev.user_name}</b>: ${ev.type} @ ${new Date(ev.ts).toLocaleString()}
    `;
    box.appendChild(el);
  });
}

// =====================================================================
// MATERIALS (Supervisor sees all, uploads global)
// =====================================================================
async function loadMaterials() {
  const mats = await getMaterialsGlobal();
  const box = $("#materialsBox");

  box.innerHTML = "";

  mats.forEach((m) => {
    const el = document.createElement("div");
    el.className = "material-item";
    el.innerHTML = `
      <p>${m.title}</p>
      <small>Zone: ${m.zone_type}</small>
      <a href="${m.url}" target="_blank">Open</a>
    `;
    box.appendChild(el);
  });
}

$("#uploadMaterialBtn").onclick = async () => {
  const title = $("#newMatTitle").value.trim();
  const file = $("#newMatFile").files?.[0];

  if (!title || !file) return alert("Missing title or file.");

  await createMaterial({
    title,
    file,
    created_by: myId,
    zone: "ALL",
    roles: ["manager", "admin", "team_leader", "instructor", "client"],
  });

  $("#newMatTitle").value = "";
  $("#newMatFile").value = "";

  loadMaterials();
};

// =====================================================================
// MESSAGING (Supervisor = can message ANY user, role, zone, or broadcast)
// =====================================================================
function initMessaging() {
  const msgBox = $("#msgBox");

  // Live messages
  subscribeMessages(myId, (msg) => {
    const el = document.createElement("div");
    el.className = "msg-item";
    el.innerHTML = `
      <p><b>${msg.sender_name}</b>: ${msg.body}</p>
    `;
    msgBox.appendChild(el);
  });

  // Send broadcast
  $("#sendGlobalMsgBtn").onclick = async () => {
    const text = $("#globalMsgInput").value.trim();
    if (!text) return;

    await sendMessage({
      sender_id: myId,
      scope: "all",
      body: text,
      to_user_id: null,
      to_role: null,
      to_zone: null,
    });

    $("#globalMsgInput").value = "";
  };
}

// =====================================================================
// LIVE LOCATION STREAM (Supervisor = everyone)
// =====================================================================
function initLiveLocations() {
  const box = $("#liveLocBox");

  getLiveLocationsStream("ALL", (loc) => {
    const p = document.createElement("p");
    p.textContent = `${loc.user_name}: ${loc.lat}, ${loc.lng}`;
    box.appendChild(p);
  });
}

// =====================================================================
// EMERGENCY CONTROLS (soft shutdown / alerts)
// =====================================================================
function initEmergencyControls() {
  $("#emStopSystemBtn").onclick = () => {
    alert("System STOP triggered (placeholder — requires backend action).");
  };

  $("#emAlertAllBtn").onclick = async () => {
    await sendMessage({
      sender_id: myId,
      scope: "all",
      body: "[SYSTEM ALERT] Immediate attention required.",
    });
  };
}

// =====================================================================
// LOGOUT
// =====================================================================
$("#logoutBtn").onclick = async () => {
  await signOut();
  location.href = "/html/login.html";
};
