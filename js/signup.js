// /js/signup.js

import { getSession } from "./sdk/auth.js";
import { getProfileById, updateProfile } from "./sdk/profiles.js";

/* -----------------------------------------------------------
   Local dashboardPath helper
   (kept local so signup.js stays self-contained)
----------------------------------------------------------- */
function dashboardPath(role = "") {
  switch (role) {
    case "Supervisor": return "/html/supervisor.html";
    case "Admin": return "/html/admin.html";
    case "Manager": return "/html/manager.html";
    case "Team Leader": return "/html/team-leader.html";
    case "Instructor": return "/html/instructor.html";
    case "Client": return "/html/client.html";
    default: return "/html/pending.html";
  }
}

/* -----------------------------------------------------------
   BOOT: prefill fields & redirect if already approved
----------------------------------------------------------- */
(async function setup() {
  const { userId } = await getSession();
  if (!userId) {
    location.href = "/html/login.html";
    return;
  }

  const profile = await getProfileById(userId);

  // Already approved → skip signup entirely
  if (profile?.status === "approved") {
    location.href = dashboardPath(profile.role);
    return;
  }

  // Prefill if partially completed
  if (profile) {
    if (profile.name) document.getElementById("name").value = profile.name;
    if (profile.phone) document.getElementById("phone").value = profile.phone;
    if (profile.role) document.getElementById("role").value = profile.role;

    const zoneRoles = ["Manager", "Team Leader", "Instructor", "Client"];

    // Show zone picker if needed
    if (zoneRoles.includes(profile.role)) {
      const zoneRow = document.getElementById("zoneRow");
      if (zoneRow) zoneRow.classList.remove("hidden");
      if (profile.zone) document.getElementById("zone").value = profile.zone;
    }

    // Show Supervisor key input if necessary
    if (profile.role === "Supervisor") {
      const supRow = document.getElementById("supKeyRow");
      if (supRow) supRow.classList.remove("hidden");
    }
  }
})();

/* -----------------------------------------------------------
   Role Change → toggle visible fields
----------------------------------------------------------- */
document.getElementById("role").addEventListener("change", (e) => {
  const role = e.target.value;

  const zoneRow = document.getElementById("zoneRow");
  const supKeyRow = document.getElementById("supKeyRow");

  // Zone roles (capitalized correctly)
  const zoneRoles = ["Manager", "Team Leader", "Instructor", "Client"];

  // Zone display
  if (zoneRow) {
    if (zoneRoles.includes(role)) {
      zoneRow.classList.remove("hidden");
    } else {
      zoneRow.classList.add("hidden");
      const z = document.getElementById("zone");
      if (z) z.value = "";
    }
  }

  // Supervisor key display
  if (supKeyRow) {
    if (role === "Supervisor") {
      supKeyRow.classList.remove("hidden");
    } else {
      supKeyRow.classList.add("hidden");
      const sk = document.getElementById("supKey");
      if (sk) sk.value = "";
    }
  }
});

/* -----------------------------------------------------------
   Submit Profile → set status=pending
----------------------------------------------------------- */
document.getElementById("save").addEventListener("click", async () => {
  try {
    const name = document.getElementById("name").value.trim();
    const role = document.getElementById("role").value;
    const phone = document.getElementById("phone").value.trim();

    const zoneEl = document.getElementById("zone");
    const zone = zoneEl ? (zoneEl.value || null) : null;

    const supKeyEl = document.getElementById("supKey");
    const supKey = supKeyEl ? supKeyEl.value.trim() : "";

    if (!name) return alert("Please enter your full name.");
    if (!role) return alert("Please select your role.");

    // Supervisor key validation
    if (role === "Supervisor") {
      const VALID_SUP_KEY = "SAHA-2025"; // Replace later with secure env
      if (supKey !== VALID_SUP_KEY) {
        return alert("Invalid supervisor key.");
      }
    }

    // Build payload for DB
    const payload = {
      name,
      phone,
      role,
      zone,
      status: "pending",
    };

    await updateProfile(payload);

    alert("Profile submitted. An Admin/Supervisor must approve your account.");
    location.href = "/html/pending.html";

  } catch (err) {
    console.error(err);
    alert(err.message || "Something went wrong while saving your profile.");
  }
});
