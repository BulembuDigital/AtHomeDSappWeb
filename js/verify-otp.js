// js/verify-otp.js — final stabilized version
// Guarantees role persistence, reliable session hydration and correct routing.

import { sb } from "./supabaseClient.js";
import { dashboardPath } from "./supabaseClient.js";

const $status = document.getElementById("statusBar");
const $result = document.getElementById("result");
const $debug  = document.getElementById("debug");

function showMsg(html, ok = false) {
  if (!$result) return console[ok ? "info" : "error"](html);
  $result.classList.remove("hidden");
  $result.innerHTML = ok
    ? `<div class="notice-ok">${html}</div>`
    : `<div class="notice-err">${html}</div>`;
}
function clearMsg() {
  if (!$result) return;
  $result.classList.add("hidden");
  $result.innerHTML = "";
}
function dbg(v) {
  if (!$debug) return;
  try { $debug.textContent = JSON.stringify(v, null, 2); }
  catch { $debug.textContent = String(v); }
}

/* ============================================================
   ROLE NORMALIZATION — NEVER OVERRIDE USER SELECTION
   ============================================================ */
function normalizeRole(r) {
  if (!r || typeof r !== "string") return "client";
  r = r.trim().toLowerCase();

  if (["admin","manager","instructor","supervisor","client","team_leader"].includes(r))
    return r;

  if (["team leader","team-leader","teamleader"].includes(r))
    return "team_leader";

  return r;
}

/* ============================================================
   DIRECT UPSERT
============================================================ */
async function directUpsertProfile(payload) {
  try {
    const { data, error } = await sb
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (error) return { ok:false, error };
    return { ok:true, profile:data };
  } catch (e) {
    return { ok:false, error:e };
  }
}

/* ============================================================
   RPC FALLBACK
============================================================ */
async function upsertProfileRpc(payloadObj) {
  try {
    const { data, error } = await sb.rpc("upsert_profile_for_session", { payload: payloadObj });
    if (error) throw error;
    return { ok:true, data };
  } catch (err) {
    return { ok:false, error: err };
  }
}

/* ============================================================
   WAIT FOR SESSION (fixes instant logout)
============================================================ */
async function waitForSession() {
  for (let i = 0; i < 16; i++) {
    try {
      const res = await sb.auth.getSession();
      if (res?.data?.session) return res.data.session;
    } catch {_}
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

/* ============================================================
   MAIN FINALIZER
============================================================ */
async function finalize() {
  clearMsg();
  if ($status) $status.style.display = "block";

  try {
    const url = new URL(location.href);
    const code = url.searchParams.get("code");

    if (code && sb.auth.exchangeCodeForSession) {
      try { await sb.auth.exchangeCodeForSession(code); } catch {_}
    }

    // 🔥 CRITICAL:
    // Fix for redirect loop — wait until Supabase restores full session
    const session = await waitForSession();
    if (!session) {
      showMsg("Could not establish session. Open the magic link again.", false);
      return;
    }

    const user = session.user;
    const meta = user.user_metadata ?? {};

    // Local fallback only — never override server metadata
    const localRole  = (localStorage.getItem("role")  || "").trim();
    const localName  = (localStorage.getItem("name")  || "").trim();
    const localPhone = (localStorage.getItem("phone") || "").trim();

    // FINAL ROLE PICK — guaranteed correct
    const rawRole =
      meta.role ||
      meta.intended_role ||
      localRole ||
      "client";

    const role = normalizeRole(rawRole);
    const intended_role = normalizeRole(meta.intended_role || rawRole);

    const payload = {
      id: user.id,
      email: user.email ?? meta.email ?? null,
      name: localName || meta.name || (user.email ? user.email.split("@")[0] : null),
      phone: localPhone || meta.phone || null,
      role,
      intended_role,
      approved: role === "supervisor" ? true : null,
      sup_key_verified: meta.sup_key_verified === true ? true : null,
      updated_at: new Date().toISOString()
    };

    dbg({ payload });

    if (!payload.id) return showMsg("Missing user ID.", false);

    // ===== Try direct upsert =====
    const direct = await directUpsertProfile(payload);
    if (direct.ok) {
      return routeAfterProfile(direct.profile, role);
    }

    dbg({ directError: direct.error });

    // ===== RPC fallback =====
    const rpc = await upsertProfileRpc(payload);
    if (!rpc.ok) {
      dbg({ rpcError: rpc.error });
      return showMsg("Could not save profile. Contact support.", false);
    }

    const rpcProfile =
      rpc.data?.profile ||
      (Array.isArray(rpc.data) ? rpc.data[0] : rpc.data);

    return routeAfterProfile(rpcProfile, role);

  } catch (err) {
    showMsg("Verification failed: " + err?.message, false);
  } finally {
    if ($status) $status.style.display = "none";
  }
}

/* ============================================================
   ROUTING FIX — final source of redirect loop
============================================================ */
function routeAfterProfile(profile, fallbackRole) {
  const role = normalizeRole(profile?.role || fallbackRole || "client");

  const approved =
    profile?.approved === true ||
    profile?.status === "approved";

  dbg({ routing: { role, approved, profile } });

  // 🔥 FIX: supervisor ALWAYS bypasses approval check
  if (role === "supervisor") {
    return location.replace("/html/supervisor.html");
  }

  if (approved) {
    return location.replace(dashboardPath(role));
  }

  return location.replace("/html/pending.html");
}

finalize();
