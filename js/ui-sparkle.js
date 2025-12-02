/* ==========================================================
   ui-sparkle.js
   Controls:
   - Soft page fade-in
   - Top progress bar (auto + manual)
   - Optional navigation fade overlay
   ========================================================== */

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */
const $ = (q) => document.querySelector(q);


/* ----------------------------------------------------------
   1) Soft page transition
---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.querySelector(".soft-page");
  if (!page) return;

  // Defer one frame for smoother CSS transition
  requestAnimationFrame(() => page.classList.add("is-ready"));
});


/* ----------------------------------------------------------
   2) Top Progress Bar Controller
---------------------------------------------------------- */
const topProgress = $("#top-progress");
let progressTimer = null;
let progressActive = false;

function resetProgress() {
  if (!topProgress) return;
  topProgress.style.width = "0%";
}

/* Start automatic progress bar */
export function sparkleStart() {
  if (!topProgress) return;

  progressActive = true;
  clearTimeout(progressTimer);

  topProgress.classList.remove("is-done");
  topProgress.classList.add("is-active");

  // Slight delay to ensure CSS transitions apply
  requestAnimationFrame(() => {
    topProgress.style.width = "100%";
  });

  // fallback auto-finish
  progressTimer = setTimeout(() => sparkleDone(), 8000);
}

/* Manually set progress (0–100) */
export function sparkleSet(pct) {
  if (!topProgress) return;
  topProgress.classList.add("is-active");
  topProgress.style.width = pct + "%";
}

/* Complete progress animation */
export function sparkleDone() {
  if (!topProgress) return;
  if (!progressActive) return;

  progressActive = false;
  clearTimeout(progressTimer);

  topProgress.classList.remove("is-active");
  topProgress.classList.add("is-done");

  // Reset after the fade-out animation
  setTimeout(() => {
    resetProgress();
    topProgress.classList.remove("is-done");
  }, 420);
}


/* ----------------------------------------------------------
   3) Navigation Fade Overlay
---------------------------------------------------------- */
const fadeOverlay = document.createElement("div");
fadeOverlay.className = "ui-fade";
document.body.appendChild(fadeOverlay);

export function sparkleFadeOut() {
  fadeOverlay.classList.add("show");

  // Ensure it never gets stuck
  setTimeout(() => fadeOverlay.classList.remove("show"), 450);
}


/* ----------------------------------------------------------
   4) Auto-trigger on page load
   (only if splash doesn't already manage load visuals)
---------------------------------------------------------- */
window.addEventListener("load", () => {
  // If a splash screen is present, skip auto-sparkle
  const splash = document.getElementById("splash");
  if (splash && splash.style.display !== "none") return;

  if (!progressActive) {
    sparkleStart();
    setTimeout(() => sparkleDone(), 650);
  }
});


/* ----------------------------------------------------------
   5) Soft navigation helper
---------------------------------------------------------- */
export function sparkleNavigate(url) {
  sparkleStart();
  sparkleFadeOut();

  setTimeout(() => {
    window.location.href = url;
  }, 260);
}


/* ----------------------------------------------------------
   6) Auto-detect <button data-nav="/path">
---------------------------------------------------------- */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-nav]");
  if (!btn) return;

  e.preventDefault();
  sparkleNavigate(btn.dataset.nav);
});
