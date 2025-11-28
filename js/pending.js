// /js/pending.js
// Polling page for "pending approval" flow.
// Uses getClient() for DB queries and dashboardPath for redirects.

import { getClient, dashboardPath } from "./supabaseClient.js";
import { initTheme } from "./theme.js";
import { showSplash, hideSplash } from "./splash.js";

initTheme();
showSplash("Checking your approval status…");

// tolerant back button lookup (works if your button has id/backToLogin or not)
const backBtn =
  document.getElementById("backToLogin") ||
  document.querySelector("button#backToLogin") ||
  document.querySelector(".panel button") ||
  document.querySelector("button");

// UI helpers
function showStatus(msg) {
  let el = document.getElementById("pendingStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "pendingStatus";
    el.style.marginTop = "18px";
    el.style.padding = "14px";
    el.style.borderRadius = "10px";
    el.style.background = "var(--bg-card)";
    el.style.color = "var(--text)";
    el.style.maxWidth = "820px";
    const container = document.querySelector(".panel") || document.querySelector("main") || document.body;
    container.insertBefore(el, container.firstChild);
  }
  el.textContent = msg;
}

function showFinalMessage(msg, isError = false) {
  showStatus(msg);
  if (isError) {
    const el = document.getElementById("pendingStatus");
    el.style.border = "1px solid var(--accent-2)";
    el.style.color = "var(--accent-2)";
  }
}

/**
 * Fetch the current session's profile (may return { profile: null } if not created yet).
 * Always uses the real client via getClient() for predictable behavior.
 */
async function fetchProfile() {
  try {
    const client = await getClient();

    // Prefer getSession(); be defensive across sdk versions
    let session = null;
    try {
      const { data: sdata } = await client.auth.getSession();
      session = sdata?.session ?? null;
    } catch (_) {
      // fallback to getUser()
      try {
        const { data: udata } = await client.auth.getUser();
        session = udata?.user ? { user: udata.user } : null;
      } catch (_e) {
        session = null;
      }
    }

    const userId = session?.user?.id;
    if (!userId) return { profile: null, reason: "no_user" };

    const { data, error } = await client
      .from("profiles")
      .select("id,name,email,role,status,approved,created_at,updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[pending] fetchProfile db error:", error.message || error);
      return { profile: null, reason: "db_error", error };
    }

    return { profile: data ?? null };
  } catch (err) {
    console.error("[pending] fetchProfile caught:", err);
    return { profile: null, reason: "unexpected", error: err };
  }
}

/**
 * Poll for approval. Shows friendly messages and redirects using dashboardPath(role).
 */
async function pollForApproval({ intervalMs = 3000, maxTries = 200 } = {}) {
  let tries = 0;
  showStatus("Checking your approval status...");

  while (tries < maxTries) {
    tries += 1;
    try {
      const { profile, error } = await fetchProfile();

      if (error) {
        console.warn("[pending] poll error", error);
        showStatus("Error checking approval status. Retrying…");
      } else if (!profile) {
        showStatus("Waiting for your account row to be created (a few seconds)...");
      } else {
        const st = (profile.status || "").toLowerCase();
        if (st === "approved" || profile.approved === true) {
          showStatus("Approved — redirecting to your dashboard…");
          await new Promise((r) => setTimeout(r, 350));
          // Use dashboardPath from supabaseClient to keep routing consistent
          const dest = dashboardPath(profile.role || "");
          location.replace(dest);
          return;
        } else if (st === "declined" || st === "rejected") {
          showFinalMessage("Your application was declined. You will receive an email with details.", true);
          return;
        } else {
          showStatus("Your account is pending approval. We'll check again shortly...");
        }
      }
    } catch (e) {
      console.error("[pending] pollForApproval unexpected:", e);
      showStatus("Network error while checking approval. Retrying...");
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  showFinalMessage("Still pending after many attempts. If this continues please contact support.", true);
}

/* Back button */
if (backBtn) {
  backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    location.replace("/html/login.html");
  });
}

/* Boot */
(async function boot() {
  try {
    await pollForApproval({ intervalMs: 3000, maxTries: 200 });
  } catch (e) {
    console.error("[pending boot error]", e);
    showFinalMessage("Unexpected error while checking approval status.", true);
  } finally {
    hideSplash();
  }
})();
