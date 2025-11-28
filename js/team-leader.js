// ============================================================================
// TEAM LEADER DASHBOARD
// Zone-restricted. TL sees instructors + clients assigned to their zone.
// ============================================================================

// AUTH
import { getSession, signOut } from "./sdk/auth.js";

// PROFILES (TL + instructors + clients)
import {
  getMyProfile,
  getProfilesByZone,
  updateProfile,
} from "./sdk/profiles.js";

// ASSIGNMENTS (TL → instructors → clients)
import {
  getInstructorsForTL,
  getClientsForTL,
  reassignClient,
} from "./sdk/assignments.js";

// ROUTES (TL personal + instructor routes)
import {
  getRoutesForUser,
  saveRoute,
  deleteRoute,
  getAllRoutesForZone,
} from "./sdk/routes.js";

// SCHEDULES (TL creates lessons)
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
  getRecipientsForTL,
} from "./sdk/messages.js";

// LIVE LOCATIONS
import { getLiveLocationsStream } from "./sdk/livelocations.js";

// CLOCK EVENTS
import {
  getClockedInInstructors,
} from "./sdk/clockEvents.js";

// HELPERS
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
  if (!userId) return (location.href = "/html/login.html");

  me = await getMyProfile();
  if (!me || me.role !== "team_leader") {
    return location.replace("/html/login.html");
  }
  if (me.status !== "approved") {
    return location.replace("/html/pending.html");
  }

  myId = me.id;
  myZone = me.zone_type;

  $("#tlName").textContent = me.name || "Team Leader";

  initTabs();
  loadRoster();
  loadRoutes();
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
  const box = $("#tabs");
  box.onclick = (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;

    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));

    t.classList.add("active");
    document.querySelector(`.panel[data-panel="${t.dataset.tab}"]`)
      .classList.add("active");
  };
}

// ============================================================================
// ROSTER — Who is clocked in (in my zone)
// ============================================================================
async function loadRoster() {
  const box = $("#roster");
  box.innerHTML = "Loading…";

  const instructors = await getClockedInInstructors(myZone);

  if (!instructors.length) {
    box.innerHTML = `<p class="muted">No instructors currently clocked in.</p>`;
    return;
  }

  box.innerHTML = instructors
    .map((i) => `
      <div class="list-row">
        <b>${i.name}</b>
        <span>${i.role}</span>
      </div>
    `)
    .join("");
}

$("#refreshRoster").onclick = loadRoster;

// ============================================================================
// ROUTE PLANNER (TL personal routes)
// ============================================================================
let plannerMap = null;
let plannerDraw = null;
let currentGeo = null;

async function loadPlanner() {
  const saved = await getRoutesForUser(myId);
  const list = $("#routesList");

  list.innerHTML = saved.length
    ? saved.map((r) => `
        <div class="list-row">
          <b>${r.title}</b>
          <button class="btn" data-load="${r.id}">Load</button>
          <button class="btn" data-del="${r.id}">Delete</button>
        </div>
      `).join("")
    : `<p class="muted">No saved routes.</p>`;

  list.onclick = async (e) => {
    const loadId = e.target.dataset.load;
    const delId = e.target.dataset.del;

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
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(plannerMap);

  plannerDraw = new L.FeatureGroup();
  plannerMap.addLayer(plannerDraw);

  const drawControl = new L.Control.Draw({
    edit: { featureGroup: plannerDraw },
    draw: {
      polyline: true,
      polygon: false,
      rectangle: false,
      marker: false,
      circle: false,
    },
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
  if (!title || !currentGeo) return alert("Missing title or route.");

  await saveRoute({
    user_id: myId,
    title,
    geojson: currentGeo,
    zone_type: myZone,
  });

  $("#route_title").value = "";
  await loadPlanner();
};

// ============================================================================
// CALENDAR (TL creates instructor availability and bookings)
// ============================================================================
async function loadCalendar() {
  const instrSelect = $("#instrSelect");
  const instructors = await getInstructorsForTL(myId);

  instrSelect.innerHTML = instructors
    .map((i) => `<option value="${i.id}">${i.name}</option>`)
    .join("");

  $("#addSlot").onclick = async () => {
    const instr = instrSelect.value;
    const date = $("#calDate").value;
    const start = $("#slotStart").value;
    const end = $("#slotEnd").value;

    if (!instr || !date || !start || !end) {
      return alert("Missing fields.");
    }

    await createScheduleSlot({
      instructor_id: instr,
      date,
      start,
      end,
      zone_type: myZone,
    });

    alert("Slot added.");
  };

  loadScheduleList();
}

async function loadScheduleList() {
  const list = $("#slots");
  list.innerHTML = "Loading…";

  const scheds = await getSchedulesForTL(myId);

  list.innerHTML = scheds.length
    ? scheds
        .map((s) => `
      <div class="list-row">
        <b>${s.instructor_name}</b>
        <span>${s.date} ${s.start} → ${s.end}</span>
      </div>
    `)
        .join("")
    : `<p class="muted">No schedule slots yet.</p>`;
}

// ============================================================================
// MESSAGING
// ============================================================================
function initMessaging() {
  // Send to individual OR broadcast to zone
  $("#sendMsg").onclick = async () => {
    const text = $("#msgBody").value.trim();
    if (!text) return;

    await sendMessage({
      sender_id: myId,
      scope: "zone",
      body: text,
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
      <small>${new Date(msg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}</small>
    `;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  });
}

// ============================================================================
// LIVE MAP
// ============================================================================
function initLiveMap() {
  const map = L.map("tl-map").setView([-29.11, 26.21], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  const markers = {};

  getLiveLocationsStream(myZone, (loc) => {
    if (markers[loc.user_id]) {
      markers[loc.user_id].setLatLng([loc.lat, loc.lng]);
    } else {
      markers[loc.user_id] = L.marker([loc.lat, loc.lng]).addTo(map);
    }
  });
}

// ============================================================================
// MATERIALS (zone restricted)
// ============================================================================
async function loadMaterials() {
  const mats = await getMaterialsForZone(myZone);
  const box = $("#materialsBox");

  box.innerHTML = mats.length
    ? mats
        .map((m) => `
      <div class="list-row">
        <b>${m.title}</b>
        <a class="btn" target="_blank" href="${m.url}">Open</a>
      </div>
    `)
        .join("")
    : `<p class="muted">No materials yet.</p>`;
}

// ============================================================================
// LOGOUT
// ============================================================================
$("#logoutBtn").onclick = async () => {
  await signOut();
  location.href = "/html/login.html";
};
