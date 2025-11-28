// /js/supervisor-approvals.js
// Supervisor Approvals Module
// Exports: initialize, fetchPending, renderPending, approveById, rejectById, setOnChange

import { getClient } from "./supabaseClient.js";

let sb = null;
async function ensureClient() {
  if (sb) return sb;
  sb = await getClient();
  return sb;
}

/* Logging helpers */
function _log(...a) { console.log("[supervisor-approvals]", ...a); }
function _warn(...a) { console.warn("[supervisor-approvals]", ...a); }
function _err(...a) { console.error("[supervisor-approvals]", ...a); }

/* DOM helpers */
function el(id) {
  return (typeof id === "string")
    ? globalThis.document?.getElementById(id)
    : id;
}
function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

/* Host callback */
let _onChange = null;
export function setOnChange(fn) {
  _onChange = (typeof fn === "function") ? fn : null;
}
function notifyHost(payload) {
  try { _onChange && _onChange(payload); }
  catch (err) { _warn("host callback error", err); }
}

/* -----------------------------------------------------
   Fetch pending profiles (NOW INCLUDES given_name & surname)
   ----------------------------------------------------- */
export async function fetchPending() {
  await ensureClient();
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("id, given_name, surname, name, email, role, zone, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) throw error;

    // Normalize display name
    return (data || []).map(p => {
      const gn = p.given_name?.trim() || "";
      const sn = p.surname?.trim() || "";
      const combined = `${gn} ${sn}`.trim();
      return {
        ...p,
        name: combined || p.name || p.email
      };
    });
  } catch (err) {
    _err("fetchPending error", err);
    throw err;
  }
}

/* -----------------------------------------------------
   Render pending list (mobile column)
   ----------------------------------------------------- */
export function renderPending(rows) {
  try {
    const listEl = el("approvalsList");
    if (!listEl) return;

    if (!rows || rows.length === 0) {
      listEl.innerHTML = `<div style="padding:12px;"><em class="muted">No pending users.</em></div>`;
      return;
    }

    listEl.innerHTML = "";

    rows.forEach((p) => {
      const row = globalThis.document.createElement("div");
      row.className = "pending-row";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "8px";

      const left = globalThis.document.createElement("div");
      left.innerHTML = `
        <strong>${escapeHTML(p.name || p.email || "—")}</strong>
        <div class="meta">${escapeHTML(p.email || "")} · 
          <small>${escapeHTML(p.role || "")}</small>
        </div>`;

      const right = globalThis.document.createElement("div");
      right.className = "pending-actions";

      const btnApprove = globalThis.document.createElement("button");
      btnApprove.className = "btn primary";
      btnApprove.textContent = "Approve";
      btnApprove.dataset.approve = p.id;

      const btnDecline = globalThis.document.createElement("button");
      btnDecline.className = "btn";
      btnDecline.textContent = "Decline";
      btnDecline.dataset.decline = p.id;

      right.appendChild(btnApprove);
      right.appendChild(btnDecline);

      row.appendChild(left);
      row.appendChild(right);

      listEl.appendChild(row);
    });

    // Delegated listener (only attach once)
    if (!listEl._approvals_click_attached) {
      listEl._approvals_click_attached = true;

      listEl.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("button");
        if (!btn) return;

        const approveId = btn.dataset.approve;
        const declineId = btn.dataset.decline;

        if (approveId) {
          btn.disabled = true;
          btn.textContent = "Approving…";
          try {
            const res = await approveById(approveId);
            if (!res?.ok) throw res?.rpcError || new Error("Approve failed");
            notifyHost({ type: "approved", profile: res.profile });
          } catch (err) {
            _err("mobile approve error", err);
            alert(err?.message || String(err));
          } finally {
            btn.disabled = false;
            btn.textContent = "Approve";
          }
          return;
        }

        if (declineId) {
          const reason = prompt("Provide a reason for rejecting this user (optional):", "") ?? "";
          btn.disabled = true;
          btn.textContent = "Declining…";
          try {
            const res = await rejectById(declineId, reason);
            if (!res?.ok) throw res?.rpcError || new Error("Reject failed");
            notifyHost({ type: "rejected", profile: res.profile });
          } catch (err) {
            _err("mobile reject error", err);
            alert(err?.message || String(err));
          } finally {
            btn.disabled = false;
            btn.textContent = "Decline";
          }
          return;
        }
      });
    }

  } catch (err) {
    _err("renderPending error", err);
  }
}

/* -----------------------------------------------------
   RPC wrapper
   ----------------------------------------------------- */
async function _rpcWrapper(name, params) {
  await ensureClient();
  try {
    const { data, error } = await sb.rpc(name, params);

    if (error) {
      _err(`${name} transport error`, error);
      return { ok: false, rpcError: error };
    }

    if (data && typeof data === "object") {
      if (data.ok) return { ok: true, profile: data.profile || null };
      return { ok: false, rpcError: data.rpcError || data };
    }

    return { ok: true, profile: data || null };
  } catch (err) {
    _err(`${name} unexpected error`, err);
    return { ok: false, rpcError: err };
  }
}

/* Approve / Reject */
export async function approveById(id) {
  if (!id) return { ok: false, rpcError: new Error("missing id") };
  return await _rpcWrapper("approve_user_for_id", { target_id: id });
}

export async function rejectById(id, reason = "") {
  if (!id) return { ok: false, rpcError: new Error("missing id") };
  return await _rpcWrapper("reject_user_for_id", {
    target_id: id,
    p_reason: reason
  });
}

/* -----------------------------------------------------
   Initialize
   ----------------------------------------------------- */
let _initialized = false;
export async function initialize() {
  if (_initialized) return;
  await ensureClient();
  _initialized = true;
  _log("initialized");
}

export default {
  initialize,
  fetchPending,
  renderPending,
  approveById,
  rejectById,
  setOnChange
};
