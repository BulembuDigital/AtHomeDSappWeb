// /js/pending.js
// Polls user profile until approved, then redirects.
// Uses updated SDK: getSession(), getProfileById(), dashboardPath().

import { getSession } from "/js/sdk/auth.js";
import { getProfileById } from "/js/sdk/profiles.js";
import { dashboardPath } from "/js/sdk/profiles.js";  // we expose it here
import { initTheme } from "/js/theme.js";
import { showSplash, hideSplash } from "/js/splash.js";

initTheme();
showSplash("Checking your approval status…");

// Fallback back button finder
const backBtn =
  document.getElementById("backToLogin") ||
  document.querySelector("button#backToLogin") ||
  document.querySelector(".panel button") ||
  document.querySelector("button");

// ------------------------------
// UI helper renderers
// ------------------------------
function showStatus(msg) {
  let el = document.getElementById("pendingStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "pendingStatus";
    el.style.marginTop = "18px";
    el.style.padding = "14px";
    el.style.borderRadius = "10px";
    el.style.background = "var(--bg-elev)";
    el.style.color = "var(--text)";
    el.style.maxWidth = "620px";
    el.style.border = "1px solid var(--border)";
    const container =
      document.querySelector(".panel") ||
      document.querySelector("main") ||
      document.body;
    container.insertBefore(el, container.firstChild);
  }
  el.textContent = msg;
}

function showFinalMessage(msg, isError = false) {
  showStatus(msg);
  if (isError) {
    const el = document.getElementById("pendingStatus");
    el.style.border = "1px solid var(--accent)";
    el.style.color = "var(--accent)";
  }
}

// ------------------------------
// Fetch current user's profile
// ------------------------------
async function fetchProfile() {
  try {
    const { userId } = await getSession();
    if (!userId) return { profile: null, reason: "no_user" };

    const profile = await getProfileById(userId);
    return { profile };
  } catch (err) {
    console.warn("[pending] fetchProfile error:", err);
    return { profile: null, reason: "unexpected", error: err };
  }
}

// ------------------------------
// Poll for approval
// ------------------------------
async function pollForApproval({ intervalMs = 3000, maxTries = 200 } = {}) {
  let tries = 0;
  showStatus("Checking your approval status...");

  while (tries < maxTries) {
    tries++;

    try {
      const { profile, error } = await fetchProfile();

      if (error) {
        showStatus("Error checking status. Retrying…");
      } else if (!profile) {
        showStatus("Waiting for your account to be created…");
      } else {
        const st = (profile.status || "").toLowerCase();

        if (st === "approved") {
          showStatus("Approved — redirecting to your dashboard…");
          await new Promise((r) => setTimeout(r, 350));
          location.replace(dashboardPath(profile.role));
          return;
        }

        if (st === "declined" || st === "rejected") {
          showFinalMessage(
            "Your account was declined. You will receive an email with details.",
            true
          );
          return;
        }

        // otherwise pending
        showStatus("Still pending approval. Checking again shortly…");
      }
    } catch (err) {
      console.error("[pending] poll error:", err);
      showStatus("Network issue. Retrying…");
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  showFinalMessage(
    "Still pending after multiple attempts. Contact support.",
    true
  );
}

// ------------------------------
// Back to login
// ------------------------------
if (backBtn) {
  backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    location.replace("/html/login.html");
  });
}

// ------------------------------
// Boot
// ------------------------------
(async function boot() {
  try {
    await pollForApproval();
  } catch (err) {
    console.error("[pending boot]", err);
    showFinalMessage("Unexpected error while checking approval.", true);
  } finally {
    hideSplash();
  }
})();
