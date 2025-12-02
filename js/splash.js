// /js/splash.js
// Unified splash controller:
// 1) First-visit full-screen SAHA splash
// 2) Reusable in-app "Loading…" overlay

/* ----------------------------------------------------
   FIRST VISIT — BRAND SPLASH
---------------------------------------------------- */
(function initBrandSplash() {
  const splash = document.getElementById("splash");

  if (!splash) return; // page doesn't have splash markup

  const hasSeen = localStorage.getItem("saha_splash_seen");

  if (hasSeen) {
    // Hide instantly on all future visits
    splash.style.display = "none";
    return;
  }

  // Mark as seen
  localStorage.setItem("saha_splash_seen", "yes");

  // Auto-hide after animation time
  setTimeout(() => {
    splash.classList.add("hide");

    // Fully remove from layout
    setTimeout(() => {
      splash.style.display = "none";
    }, 350);
  }, 1400);
})();


/* ----------------------------------------------------
   PROGRAMMATIC SPLASH (used in dashboard JS)
   showSplash("Loading…")
   hideSplash()
---------------------------------------------------- */

let appSplash = null;

function ensureAppSplash() {
  if (appSplash) return appSplash;

  appSplash = document.createElement("div");
  appSplash.id = "app-splash";
  appSplash.style.position = "fixed";
  appSplash.style.inset = "0";
  appSplash.style.display = "none";
  appSplash.style.background = "rgba(0,0,0,0.55)";
  appSplash.style.backdropFilter = "blur(4px)";
  appSplash.style.zIndex = "9999";
  appSplash.style.display = "grid";
  appSplash.style.placeItems = "center";

  const box = document.createElement("div");
  box.style.padding = "20px 28px";
  box.style.borderRadius = "16px";
  box.style.background = "var(--bg-elev)";
  box.style.color = "var(--text)";
  box.style.fontSize = "17px";
  box.style.boxShadow = "0 4px 14px rgba(0,0,0,0.35)";
  box.id = "app-splash-text";
  box.textContent = "Loading…";

  appSplash.appendChild(box);
  document.body.appendChild(appSplash);

  return appSplash;
}

/**
 * Show an in-app splash overlay with optional text.
 */
export function showSplash(text = "Loading…") {
  const el = ensureAppSplash();
  const box = document.getElementById("app-splash-text");

  if (box) box.textContent = text;
  el.style.display = "grid";
}

/**
 * Hide in-app overlay
 */
export function hideSplash() {
  if (!appSplash) return;
  appSplash.style.display = "none";
}
