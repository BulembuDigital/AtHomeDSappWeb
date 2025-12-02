// =====================================================================
// SUPERVISOR DASHBOARD (Global Access, Modern SDK Version)
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
} from "./sdk/messages.js";

// LIVE LOCATIONS
import { getLiveLocationsStream } from "./sdk/liveLocations.js";

// UI SYSTEM
import { showSplash, hideSplash } from "./splash.js";
import { initTheme } from "./theme.js";

initTheme();
showSplash("Loading Supervisor Dashboard…");

// Helpers
const $ = (id) => document.getElementById(id);

let me = null;
let myId = null;


// =====================================================================
// BOOT
// =====================================================================
async function boot() {
  const { userId } = await getSession();
  if (!userId) return location.href = "/html/login.html";

  me = await getMyProfile();
  if (!me) return location.href = "/html/login.html";

  if (me.status !== "approved") {
    return location.href = "/html/pending.html";
  }

  if (me.role !== "Supervisor") {
    return location.href = "/html/login.html";
  }

  myId = me.id;

  $("#supName").textContent = me.name || "Supervisor";

  await loadAllUsers();
  await loadSchedules();
  await loadClockEvents();
  await loadMaterials();
  initMessaging();
  initLiveLocations();
  initEmergencyControls();

  hideSplash();
  console.log("SUPERVISOR DASHBOARD READY");
}

boot();


// =====================================================================
// USER DIRECTORY — Supervisor sees every profile
// =====================================================================
async function loadAllUsers() {
  const box = $("#userList");
  box.innerHTML = "<p>Loading users…</p>";

  const users = await getAllProfiles();
  box.innerHTML = "";

  if (!users.length) {
    box.innerHTML = "<p>No users found.</p>";
    return;
  }

  users.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <div class="col">
        <b>${u.name || u.email}</b>
        <small>${u.role} • ${u.status}</small>
      </div>
      <button class="btn suspendBtn" data-id="${u.id}"
        ${u.role === "Supervisor" ? "disabled" : ""}>
        Suspend
      </button>
    `;
    box.appendChild(row);
  });

  box.querySelectorAll(".suspendBtn").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.id;
      if (!confirm("Suspend this user?")) return;
      await updateStatus(uid, "suspended");
      loadAllUsers();
    };
  });
}


// =====================================================================
// PROFILE SEARCH — Global search by name or email
// =====================================================================
$("#searchUserBtn").onclick = async () => {
  const q = $("#searchUserInput").value.trim();
  const box = $("#userList");

  if (!q) {
    loadAllUsers();
    return;
  }

  const results = await searchProfiles(q);
  box.innerHTML = "";

  if (!results.length) {
    box.innerHTML = "<p>No results.</p>";
    return;
  }

  results.forEach((u) => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <b>${u.name}</b>
      <span>${u.role}</span>
    `;
    box.appendChild(row);
  });
};


// =====================================================================
// SCHEDULES — Supervisor sees global schedules
// =====================================================================
async function loadSchedules() {
  const sched = await getAllSchedules();
  const box = $("#scheduleBox");

  box.innerHTML = "";

  if (!sched.length) {
    box.innerHTML = "<p>No scheduled lessons found.</p>";
    return;
  }

  sched.forEach((s) => {
    const row = document.createElement("div");
    row.className = "schedule-item";

    row.innerHTML = `
      <p><b>${s.instructor_name}</b> → ${s.client_name}</p>
      <p>${s.date} ${s.time}</p>
    `;
    box.appendChild(row);
  });
}


// =====================================================================
// CLOCK EVENTS — Global list for all users
// =====================================================================
async function loadClockEvents() {
  const events = await getClockEventsForAll();
  const box = $("#clockEventsBox");

  box.innerHTML = "";

  if (!events.length) {
    box.innerHTML = "<p>No clock events yet.</p>";
    return;
  }

  events.forEach((ev) => {
    const row = document.createElement("div");
    row.className = "clock-row";
    row.innerHTML = `
      <b>${ev.user_name}</b>
      <span>${ev.type} — ${new Date(ev.ts).toLocaleString()}</span>
    `;
    box.appendChild(row);
  });
}


// =====================================================================
// MATERIALS — Supervisor sees all zone + global materials
// =====================================================================
async function loadMaterials() {
  const mats = await getMaterialsGlobal();
  const box = $("#materialsBox");

  box.innerHTML = "";

  if (!mats.length) {
    box.innerHTML = "<p>No materials uploaded.</p>";
    return;
  }

  mats.forEach((m) => {
    const row = document.createElement("div");
    row.className = "material-item";

    row.innerHTML = `
      <p>${m.title}</p>
      <small>Zone: ${m.zone_type}</small>
      <a href="${m.url}" target="_blank">Open</a>
    `;
    box.appendChild(row);
  });
}


// Upload new global material
$("#uploadMaterialBtn").onclick = async () => {
  const title = $("#newMatTitle").value.trim();
  const file = $("#newMatFile").files?.[0];

  if (!title || !file) return alert("Missing title or file.");

  await createMaterial({
    title,
    file,
    created_by: myId,
    zone: "ALL",
    roles: ["Supervisor", "Admin", "Manager", "Team Leader", "Instructor", "Client"],
  });

  $("#newMatTitle").value = "";
  $("#newMatFile").value = "";

  loadMaterials();
};


// =====================================================================
// MESSAGING — Supervisor can broadcast to entire system
// =====================================================================
function initMessaging() {
  const box = $("#msgBox");

  subscribeMessages(myId, (msg) => {
    const el = document.createElement("div");
    el.className = "msg-item";
    el.innerHTML = `<b>${msg.sender_name}:</b> ${msg.body}`;
    box.appendChild(el);
  });

  $("#sendGlobalMsgBtn").onclick = async () => {
    const text = $("#globalMsgInput").value.trim();
    if (!text) return;

    await sendMessage({
      sender_id: myId,
      scope: "all",
      body: text,
    });

    $("#globalMsgInput").value = "";
  };
}


// =====================================================================
// LIVE LOCATION STREAM — Supervisor monitors all instructors
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
// EMERGENCY CONTROLS
// =====================================================================
function initEmergencyControls() {
  $("#emStopSystemBtn").onclick = () => {
    alert("SYSTEM STOP triggered — backend action required.");
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
