// js/verify-otp.js — final, stable redirect handler
// Works with your updated supabaseClient.js + dashboardPath()

import { supabase, dashboardPath } from "./supabaseClient.js";

const $result = document.getElementById("result");
const $debug  = document.getElementById("debug");
const $status = document.getElementById("statusBar");

// -------------------------------
// Helpers
// -------------------------------
function msg(html, ok = false) {
  if (!$result) return console[ok ? "info" : "error"](html);

  $result.classList.remove("hidden");
  $result.innerHTML = ok
    ? `<div class="notice-ok">${html}</div>`
    : `<div class="notice-err">${html}</div>`;
}

function dbg(data) {
  if (!$debug) return;
  try {
    $debug.textContent = JSON.stringify(data, null, 2);
  } catch {
    $debug.textContent = String(data);
  }
}

function normalizeRole(r) {
  if (!r) return "Client";
  r = r.toLowerCase();

  if (["admin","manager","instructor","supervisor","client"].includes(r))
    return r;

  if (["team leader","team-leader","team_leader"].includes(r))
    return "Team Leader";

  return "Client";
}


// -------------------------------
// Wait for a fully restored Supabase session
// Fixes the “redirect loop” issue
// -------------------------------
async function waitForSession() {
  for (let i = 0; i < 16; i++) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) return data.session;
    } catch {}
    await new Promise(res => setTimeout(res, 300));
  }
  return null;
}


// -------------------------------
// Upsert profile into database
// -------------------------------
async function saveProfile(payload) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (error) return { ok: false, error };
    return { ok: true, profile: data };
  } catch (err) {
    return { ok: false, error: err };
  }
}


// -------------------------------
// Routing
// -------------------------------
function route(profile, fallbackRole) {
  const role = normalizeRole(profile?.role || fallbackRole);
  const approved = profile?.status === "approved";

  dbg({ profile, role, approved });

  // Supervisors always bypass approval
  if (role === "supervisor") {
    return location.replace("/html/supervisor.html");
  }

  if (approved) {
    return location.replace(dashboardPath(role));
  }

  return location.replace("/html/pending.html");
}


// -------------------------------
// MAIN FLOW
// -------------------------------
async function finalizeOTP() {
  if ($status) $status.style.display = "block";

  try {
    // Handle "?code=" redirect
    const url = new URL(location.href);
    const code = url.searchParams.get("code");

    if (code && supabase.auth.exchangeCodeForSession) {
      try { await supabase.auth.exchangeCodeForSession(code); } catch {}
    }

    // Wait for Supabase session
    const session = await waitForSession();
    if (!session) {
      msg("Could not restore session. Try the login link again.");
      return;
    }

    const user = session.user;
    const meta = user.user_metadata || {};

    // Fallback: this never overrides DB roles
    const localRole = localStorage.getItem("role") || "";
    const localName = localStorage.getItem("name") || "";
    const localPhone = localStorage.getItem("phone") || "";

    const rawRole =
      meta.role ||
      meta.intended_role ||
      localRole ||
      "Client";

    const role = normalizeRole(rawRole);

    const payload = {
      id: user.id,
      email: user.email,
      name: localName || meta.name || user.email?.split("@")[0],
      phone: localPhone || meta.phone || null,
      role,
      status: role === "supervisor" ? "approved" : "pending",
      updated_at: new Date().toISOString(),
    };

    dbg({ payload });

    const r = await saveProfile(payload);
    if (!r.ok) {
      dbg({ profileError: r.error });
      return msg("Could not save your profile. Contact admin.");
    }

    return route(r.profile, role);

  } catch (err) {
    msg("Verification failed: " + err?.message);
  } finally {
    if ($status) $status.style.display = "none";
  }
}

finalizeOTP();
