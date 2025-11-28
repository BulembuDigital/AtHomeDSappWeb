// --------------------------------------------------------------
// INSTRUCTOR DASHBOARD (clean SDK version)
// --------------------------------------------------------------

import { getSession, signOut } from "./sdk/auth.js";
import { getMyProfile } from "./sdk/profiles.js";
import { getMyRoutes, saveRoute } from "./sdk/routes.js";
import { 
    getInstructorSlots, 
    addSlot, 
    deleteSlot, 
    markSlotAvailable 
} from "./sdk/schedules.js";
import { 
    getMyStudents, 
    assignStudent 
} from "./sdk/assignments.js";
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
// INIT
// --------------------------------------------------------------
initTheme();
showSplash("Loading...");

const $ = id => document.getElementById(id);

// State
let me = null;
let myId = null;
let zone = null;
let route = null;
let students = [];
let materials = [];


// --------------------------------------------------------------
// BOOT SEQUENCE
// --------------------------------------------------------------
async function boot() {
    // 1. AUTH
    const { userId } = await getSession();
    if (!userId) return location.href = "/html/login.html";
    myId = userId;

    // 2. PROFILE
    me = await getMyProfile();
    if (!me) return location.href = "/html/signup-finish.html";
    if (me.status !== "approved") {
        return location.href = "/html/pending.html";
    }

    zone = me.zone;

    // 3. LOAD DASHBOARD DATA
    await loadDashboard();

    // 4. START LIVE LOCATION STREAM
    initLiveTracking();

    hideSplash();
}


// --------------------------------------------------------------
// LOAD ALL DASHBOARD DATA
// --------------------------------------------------------------
async function loadDashboard() {
    // 🧭 Load Route
    route = await getMyRoutes(myId);

    // 🎒 Load students I am assigned to
    students = await getMyStudents(myId, zone);

    // 📚 Load materials for my zone
    materials = await getMaterialsByZone(zone);

    // 🗓️ Load my time slots (lesson availability)
    const slots = await getInstructorSlots(myId, zone);

    renderProfile();
    renderStudents();
    renderSlots(slots);
    renderMaterials();
}


// --------------------------------------------------------------
// UI RENDERING
// --------------------------------------------------------------
function renderProfile() {
    $("name").textContent = me.full_name;
    $("role").textContent = "Instructor";
    $("zone").textContent = me.zone;
}

function renderStudents() {
    const box = $("students");
    box.innerHTML = "";

    if (!students.length) {
        box.innerHTML = "<p>No assigned students yet.</p>";
        return;
    }

    students.forEach(s => {
        const div = document.createElement("div");
        div.className = "item-row";
        div.innerHTML = `
            <strong>${s.full_name}</strong>
            <button data-id="${s.id}" class="open-chat">Chat</button>
        `;
        box.appendChild(div);
    });

    // hook chat buttons
    document.querySelectorAll(".open-chat").forEach(btn => {
        btn.onclick = () => openChat(btn.dataset.id);
    });
}

function renderSlots(slots) {
    const box = $("slots");
    box.innerHTML = "";

    slots.forEach(slot => {
        const div = document.createElement("div");
        div.className = "slot-row";
        div.innerHTML = `
            <span>${new Date(slot.slot_start).toLocaleString()}</span>
            <button class="delete-slot" data-id="${slot.id}">Delete</button>
        `;
        box.appendChild(div);
    });

    document.querySelectorAll(".delete-slot").forEach(btn => {
        btn.onclick = async () => {
            await deleteSlot(btn.dataset.id);
            loadDashboard();
        };
    });
}

function renderMaterials() {
    const box = $("materials");
    box.innerHTML = "";

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


// --------------------------------------------------------------
// CHAT SYSTEM
// --------------------------------------------------------------
async function openChat(studentId) {
    showSplash("Loading chat...");

    const threadId = [myId, studentId].sort().join("-");

    const msgs = await getThreadMessages(threadId, zone);
    renderChat(msgs);

    // live updates
    subscribeMessages(threadId, newMsg => {
        appendChat(newMsg);
    });

    hideSplash();
}

function renderChat(messages) {
    const box = $("chat-box");
    box.innerHTML = "";

    messages.forEach(msg => appendChat(msg));
}

function appendChat(msg) {
    const box = $("chat-box");
    const div = document.createElement("div");
    div.className = msg.sender_id === myId ? "msg-right" : "msg-left";
    div.textContent = msg.body;
    box.appendChild(div);
}

$("send-chat").onclick = async () => {
    const input = $("chat-input");
    const body = input.value.trim();
    if (!body) return;

    const studentId = $("chat-box").dataset.student;
    const threadId = [myId, studentId].sort().join("-");

    await sendMessage({
        thread_id: threadId,
        to_user_id: studentId,
        scope: "user",
        to_zone: zone,
        body
    });

    input.value = "";
};


// --------------------------------------------------------------
// LIVE LOCATION STREAMING
// --------------------------------------------------------------
function initLiveTracking() {
    getLiveLocationsStream(myId, point => {
        $("live-lat").textContent = point.lat.toFixed(6);
        $("live-lng").textContent = point.lng.toFixed(6);
        $("live-time").textContent = new Date(point.timestamp).toLocaleTimeString();
    });
}


// --------------------------------------------------------------
// CLOCK IN / CLOCK OUT
// --------------------------------------------------------------
$("clock-in").onclick = async () => {
    await sendClockInEvent(myId, zone);
    alert("Clocked in");
};

$("clock-out").onclick = async () => {
    await sendClockOutEvent(myId, zone);
    alert("Clocked out");
};


// --------------------------------------------------------------
// LOGOUT
// --------------------------------------------------------------
$("logout").onclick = async () => {
    await signOut();
    location.href = "/html/login.html";
};


// --------------------------------------------------------------
boot();
