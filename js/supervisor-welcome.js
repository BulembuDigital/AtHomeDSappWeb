"use strict";

import { sb } from "./supabaseClient.js";
import { initTheme } from "./theme.js";
initTheme();

const profileBox = document.getElementById("profileBox");
const editBtn    = document.getElementById("editBtn");
const zoneSelect = document.getElementById("zoneSelect");
const saveBtn    = document.getElementById("saveBtn");
const skipBtn    = document.getElementById("skipBtn");
const msg        = document.getElementById("msg");

function show(html, ok = true) {
  msg.classList.remove("hidden");
  msg.className = ok ? "notice-ok mt" : "notice-err mt";
  msg.innerHTML = html;
}

(async function boot() {
  const { data: { user }, error: uErr } = await sb.auth.getUser();
  if (uErr || !user) {
    show("Not signed in. Please log in again.", false);
    setTimeout(() => (location.href = "/html/login.html"), 1200);
    return;
  }

  const { data: me, error } = await sb
    .from("profiles")
    .select("id, email, name, phone, role, status, zone")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[welcome] profile fetch:", error);
    show("Could not load your profile.", false);
    return;
  }

  // Safety: only supervisor should land here
  if (me.role !== "supervisor" || me.status !== "approved") {
    location.href = "/html/pending.html";
    return;
  }

  // Populate UI
  profileBox.innerHTML = `
    <div><b>Name:</b> ${me.name || "-"}</div>
    <div><b>Email:</b> ${me.email}</div>
    <div><b>Phone:</b> ${me.phone || "-"}</div>
    <div><b>Zone:</b> ${me.zone || "-"}</div>
  `;

  if (me.zone) zoneSelect.value = me.zone;

  editBtn.addEventListener("click", async () => {
    const name  = prompt("Your name:", me.name || "")?.trim() || me.name;
    const phone = prompt("Your phone:", me.phone || "")?.trim() || me.phone;

    const { error: upErr } = await sb
      .from("profiles")
      .update({ name, phone })
      .eq("id", me.id);

    if (upErr) {
      console.error(upErr);
      show("Could not save profile.", false);
    } else {
      show("Profile updated.", true);
      profileBox.innerHTML = `
        <div><b>Name:</b> ${name || "-"}</div>
        <div><b>Email:</b> ${me.email}</div>
        <div><b>Phone:</b> ${phone || "-"}</div>
        <div><b>Zone:</b> ${zoneSelect.value || "-"}</div>
      `;
    }
  });

  async function finish(allowEmptyZone = false) {
    const zone = zoneSelect.value || "";
    if (!allowEmptyZone && !zone) {
      show("Please select a zone before continuing.", false);
      return;
    }

    // Save zone if provided
    if (zone) {
      const { error: zErr } = await sb
        .from("profiles")
        .update({ zone })
        .eq("id", me.id);
      if (zErr) {
        console.error(zErr);
        show("Could not save zone.", false);
        return;
      }
    }

    // First-time flag cleanup
    try { localStorage.removeItem("first_login"); } catch {_}

    // Go to supervisor dashboard
    location.href = "/html/supervisor.html";
  }

  saveBtn.addEventListener("click", () => finish(false));
  skipBtn.addEventListener("click", () => finish(true));
})();
