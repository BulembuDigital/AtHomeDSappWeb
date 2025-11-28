// ===================================================================
// CLIENT DASHBOARD — CLEAN SDK VERSION
// ===================================================================

import { getSession, signOut } from "./sdk/auth.js";
import { getMyProfile } from "./sdk/profiles.js";
import { getMyStudentsInstructor, getMyInstructor } from "./sdk/assignments.js";
import { 
    getMyLessons, 
    requestCancelLesson 
} from "./sdk/schedules.js";
import { getMaterialsByZone } from "./sdk/materials.js";
import { 
    getThreadMessages, 
    sendMessage, 
    subscribeMessages 
} from "./sdk/messages.js";
import { getLiveLocationsStream } from "./sdk/livelocations.js";
import { sendClockInEvent, sendClockOutEvent } from "./sdk/clockEvents.js";

import { showSplash, hideSplash } from "./splash.js";
import { initTheme } from "./theme.js";


// --------------------------------------------------------------
// INIT UI
// --------------------------------------------------------------
initTheme();
showSplash("Loading...");

const $ = id => document.getElementById(id);

// State
let me = null;
let myId = null;
let zone = null;
let instructor = null;
let lessons = [];
let materials = [];


// --------------------------------------------------------------
// BOOT
// --------------------------------------------------------------
async function boot() {

    // AUTH — redirect if not logged in
    const { userId } = await getSession();
    if (!userId) return location.href = "/html/login.html";
    myId = userId;

    // PROFILE
    me = await getMyProfile();
    if (!me) return location.href = "/html/signup-finish.html";
    if (me.status !== "approved") return location.href = "/html/pending.html";

    zone = me.zone;

    // LOAD DASHBOARD CONTENT
    await loadDashboard();

    // LIVE LOCATION STREAM
    initLiveTracking();

    hideSplash();
}


// --------------------------------------------------------------
// LOAD ALL CLIENT DASHBOARD DATA
// --------------------------------------------------------------
async function loadDashboard() {
    // GET ASSIGNED INSTRUCTOR
    instructor = await getMyInstructor(myId, zone);

    // GET LESSONS
    lessons = await getMyLessons(myId, zone);

    // GET MATERIALS
    materials = await getMaterialsByZone(zone);

    renderProfile();
    renderInstructor();
    renderLessons();
    renderMaterials();
}



// --------------------------------------------------------------
// UI RENDERING
// --------------------------------------------------------------

function renderProfile() {
    $("name").textContent = me.full_name;
    $("role").textContent = "Client";
    $("zone").textContent = me.zone;
}

function renderInstructor() {
    const box = $("instructor-box");

    if (!instructor) {
        box.innerHTML = `<p>No instructor assigned yet.</p>`;
        return;
    }

    box.innerHTML = `
        <strong>${instructor.full_name}</strong>
        <p>Email: ${instructor.email}</p>
        <button id="chat-instructor">Chat</button>
    `;

    $("chat-instructor").onclick = () => openChat(instructor.id);
}

function renderLessons() {
    const box = $("lessons");
    box.innerHTML = "";

    if (!lessons.length) {
        box.innerHTML = "<p>No booked lessons yet.</p>";
        return;
    }

    lessons.forEach(lesson => {
        const start = new Date(lesson.slot_start).toLocaleString();
        const end   = new Date(lesson.slot_end).toLocaleString();

        const div = document.createElement("div");
        div.className = "lesson-row";

        div.innerHTML = `
            <div>
                <strong>${start}</strong> → ${end}
            </div>
            <button class="cancel-lesson" data-id="${lesson.id}">
                Request Cancel
            </button>
        `;

        box.appendChild(div);
    });

    document.querySelectorAll(".cancel-lesson").forEach(btn => {
        btn.onclick = async () => {
            await requestCancelLesson(btn.dataset.id);
            alert("Cancellation request sent to Team Leader.");
            loadDashboard();
        };
    });
}

function renderMaterials() {
    const box = $("materials");
    box.innerHTML = "";

    if (!materials.length) {
        box.innerHTML = "<p>No study materials yet.</p>";
        return;
    }

    materials.forEach(m => {
        const div = document.createElement("div");
        div.className = "material-row";
        div.innerHTML = `
            <strong>${m.title}</strong>
            <p>${m.description}</p>
        `;
        box.appendChild(div);
    });
}



// ===================================================================
// CHAT SYSTEM
// ===================================================================

async function openChat(targetId) {
    showSplash("Loading chat...");

    const thread = [myId, targetId].sort().join("-");

    const history = await getThreadMessages(thread, zone);
    renderChat(history);

    // Live updates
    subscribeMessages(thread, msg => appendChat(msg));

    $("chat-box").dataset.target = targetId;

    hideSplash();
}

function renderChat(messages) {
    const box = $("chat-box");
    box.innerHTML = "";
    messages.forEach(m => appendChat(m));
}

function appendChat(msg) {
    const box = $("chat-box");
    const div = document.createElement("div");

    div.className = msg.sender_id === myId ? "msg-right" : "msg-left";
    div.textContent = msg.body;

    box.appendChild(div);
}

$("send-chat").onclick = async () => {
    const body = $("chat-input").value.trim();
    if (!body) return;

    const target = $("chat-box").dataset.target;
    const thread = [myId, target].sort().join("-");

    await sendMessage({
        thread_id: thread,
        to_user_id: target,
        to_zone: zone,
        scope: "user",
        body
    });

    $("chat-input").value = "";
};



// ===================================================================
// LIVE LOCATION STREAMING
// ===================================================================

function initLiveTracking() {
    getLiveLocationsStream(myId, point => {
        $("gps-lat").textContent = point.lat.toFixed(6);
        $("gps-lng").textContent = point.lng.toFixed(6);
        $("gps-time").textContent = new Date(point.timestamp).toLocaleTimeString();
    });
}



// ===================================================================
// CLOCK IN / CLOCK OUT
// ===================================================================

$("clock-in").onclick = async () => {
    await sendClockInEvent(myId, zone);
    alert("Clocked in");
};

$("clock-out").onclick = async () => {
    await sendClockOutEvent(myId, zone);
    alert("Clocked out");
};



// ===================================================================
// LOG OUT
// ===================================================================

$("logout").onclick = async () => {
    await signOut();
    location.href = "/html/login.html";
};



// ===================================================================
boot();
