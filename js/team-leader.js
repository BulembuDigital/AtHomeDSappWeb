// ============================================================================
// TEAM LEADER DASHBOARD (Updated to new role names + new SDK structure)
// ============================================================================

// AUTH
import { getSession, signOut } from "./sdk/auth.js";

// PROFILES
import {
  getMyProfile,
} from "./sdk/profiles.js";

// ASSIGNMENTS
import {
  getInstructorsForTL,
  getClientsForTL,
  reassignClient,
} from "./sdk/assignments.js";

// ROUTES
import {
  getRoutesForUser,
  saveRoute,
  deleteRoute,
} from "./sdk/routes.js";

// SCHEDULES
import {
  getInstructorAvailability,
  createScheduleSlot,
  getSchedulesForTL,
} from "./sdk/schedules.js";

// MATERIALS
import { getMaterialsForZone } from "./sdk/materials.js";

// MESSAGES
import {
  sendMessage,
  subscribeMessages,
} from "./sdk/messages.js";

// LIVE LOCATIONS
import { getLiveLocationsStream } from "./sdk/liveLocations.js";

// CLOCK EVENTS
import { getClockedInInstructors } from "./sdk/clockEvents.js";


// Helpers
const $ = (id) => document.getElementById(id);

// STATE
let me = null;
let myId = null;
let myZone = null;


// ============================================================================
// BOOT
// ============================================================================
async function boot() {
  const { userId } = await getSession();
  if (!userId) return location.href = "/html/login.html";

  me = await getMyProfile();
  if (!me) return location.href = "/html/login.html";

  if (me.status !== "approved") {
    return location.href = "/html/pending.html";
  }

  if (me.role !== "Team Leader") {
    return location.href = "/html/login.html";
  }

  myId = me.id;
  myZone = me.zone;

  $("#tlName").textContent = me.name || "Team Leader";

  initTabs();
  loadRoster();
  loadPlanner();
  loadCalendar();
  initMessaging();
  initLiveMap();
  loadMaterials();

  console.log("TEAM LEADER DASHBOARD READY");
}

boot();


// ============================================================================
// TABS
// ============================================================================
function initTabs() {
  const nav = $("#tabs");

  nav.onclick = (ev) => {
    const tab = ev.target.closest(".tab");
    if (!tab) return;

    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));

    tab.classList.add("active");
    const panel = document.querySelector(`.panel[data-panel="${tab.dataset.tab}"]`);
    panel.classList.add("active");
  };
}


// ============================================================================
// ROSTER (clocked-in instructors)
// ============================================================================
async function loadRoster() {
  const box = $("#roster");
  box.innerHTML = "Loading…";

  const instructors = await getClockedInInstructors(myZone);

  if (!instructors.length) {
    box.innerHTML = `<p class="muted">No instructors clocked in.</p>`;
    return;
  }

  box.innerHTML = instructors
    .map(
      (i) => `
      <div class="list-row">
        <b>${i.name}</b>
        <span>${i.role}</span>
      </div>
    `
    )
    .join("");
}

$("#refreshRoster").onclick = loadRoster;


// ============================================================================
// ROUTE PLANNER (Personal TL routes)
// ============================================================================
let plannerMap = null;
let plannerDraw = null;
let currentGeo = null;

async function loadPlanner() {
  const saved = await getRoutesForUser(myId);
  const list = $("#routesList");

  if (!saved.length) {
    list.innerHTML = `<p class="muted">No saved routes.</p>`;
  } else {
    list.innerHTML = saved
      .map(
        (r) => `
      <div class="list-row">
        <b>${r.title}</b>
        <button class="btn" data-load="${r.id}">Load</button>
        <button class="btn" data-del="${r.id}">Delete</button>
      </div>
    `
      )
      .join("");
  }

  list.onclick = async (ev) => {
    const loadId = ev.target.dataset.load;
    const delId = ev.target.dataset.del;

    if (loadId) {
      const route = saved.find((x) => x.id == loadId);
      if (!route) return;
      currentGeo = route.geojson;
      drawRouteOnPlanner();
    }

    if (delId) {
      await deleteRoute(delId);
      await loadPlanner();
    }
  };

  initPlannerMap();
}

function initPlannerMap() {
  plannerMap = L.map("planner-map").setView([-29.11, 26.21], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(plannerMap);

  plannerDraw = new L.FeatureGroup();
  plannerMap.addLayer(plannerDraw);

  const drawControl = new L.Control.Draw({
    edit: { featureGroup: plannerDraw },
    draw: { polyline: true, polygon: false, rectangle: false, marker: false, circle: false },
  });

  plannerMap.addControl(drawControl);

  plannerMap.on(L.Draw.Event.CREATED, (ev) => {
    plannerDraw.clearLayers();
    plannerDraw.addLayer(ev.layer);
    currentGeo = ev.layer.toGeoJSON();
  });
}

function drawRouteOnPlanner() {
  plannerDraw.clearLayers();
  if (!currentGeo) return;

  const layer = L.geoJSON(currentGeo);
  plannerDraw.addLayer(layer);
  plannerMap.fitBounds(layer.getBounds());
}

$("#saveRoute").onclick = async () => {
  const title = $("#route_title").value.trim();
  if (!title || !currentGeo) return alert("Missing route title or geometry");

  await saveRoute({
    user_id: myId,
    title,
    geojson: currentGeo,
    zone: myZone,
  });

  $("#route_title").value = "";
  await loadPlanner();
};


// ============================================================================
// CALENDAR (TL adds instructor availability)
// ============================================================================
async function loadCalendar() {
  const instructors = await getInstructorsForTL(myId);
  const select = $("#instrSelect");

  select.innerHTML = instructors.map((i) => `<option value="${i.id}">${i.name}</option>`).join("");

  $("#addSlot").onclick = async () => {
    const instr = select.value;
    const date = $("#calDate").value;
    const start = $("#slotStart").value;
    const end = $("#slotEnd").value;

    if (!instr || !date || !start || !end) {
      return alert("Please fill all fields.");
    }

    await createScheduleSlot({
      instructor_id: instr,
      date,
      start,
      end,
      zone: myZone,
    });

    alert("Slot added.");
    loadScheduleList();
  };

  loadScheduleList();
}

async function loadScheduleList() {
  const sched = await getSchedulesForTL(myId);
  const list = $("#slots");

  if (!sched.length) {
    list.innerHTML = `<p class="muted">No schedule slots yet.</p>`;
    return;
  }

  list.innerHTML = sched
    .map(
      (s) => `
    <div class="list-row">
      <b>${s.instructor_name}</b>
      <span>${s.date} ${s.start} → ${s.end}</span>
    </div>
  `
    )
    .join("");
}


// ============================================================================
// MESSAGING (zone-wide + direct messages)
// ============================================================================
function initMessaging() {
  // Send message
  $("#sendMsg").onclick = async () => {
    const body = $("#msgBody").value.trim();
    if (!body) return;

    await sendMessage({
      sender_id: myId,
      scope: "zone",
      body,
      to_zone: myZone,
    });

    $("#msgBody").value = "";
  };

  // Incoming
  subscribeMessages(myId, (msg) => {
    const box = $("#threadBox");
    const el = document.createElement("div");
    el.className = "msg other";
    el.innerHTML = `
      <div>${msg.body}</div>
      <small>${new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
    `;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  });
}


// ============================================================================
// LIVE MAP (instructors in zone)
// ============================================================================
function initLiveMap() {
  const map = L.map("tl-map").setView([-29.11, 26.21], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  const markers = {};

  getLiveLocationsStream(myZone, (loc) => {
    const pos = [loc.lat, loc.lng];

    if (markers[loc.user_id]) {
      markers[loc.user_id].setLatLng(pos);
    } else {
      markers[loc.user_id] = L.marker(pos).addTo(map);
    }
  });
}


// ============================================================================
// MATERIALS
// ============================================================================
async function loadMaterials() {
  const mats = await getMaterialsForZone(myZone);
  const box = $("#materialsBox");

  if (!mats.length) {
    box.innerHTML = `<p class="muted">No materials available.</p>`;
    return;
  }

  box.innerHTML = mats
    .map(
      (m) => `
    <div class="list-row">
      <b>${m.title}</b>
      <a href="${m.url}" class="btn" target="_blank">Open</a>
    </div>
  `
    )
    .join("");
}


// ============================================================================
// LOGOUT
// ============================================================================
$("#logoutBtn").onclick = async () => {
  await signOut();
  location.href = "/html/login.html";
};
