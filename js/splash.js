// js/splash.js — updated to match the new polished splash.css

const SPLASH_ID = "ahds-splash-overlay";
let shownAt = 0;

/**
 * Show the splash overlay.
 * @param {string} message   The small tagline text.
 * @param {number} minMs     Minimum visible time.
 * @param {number} maxMs     Maximum before auto-hide.
 */
export function showSplash(message = "Loading…", minMs = 350, maxMs = 8000) {
  shownAt = performance.now();
  let el = document.getElementById(SPLASH_ID);

  if (!el) {
    el = document.createElement("div");
    el.id = SPLASH_ID;
    el.className = "splash-overlay";

    el.innerHTML = `
      <div class="splash">
        <div class="logo-wrap">
          <div class="glow"></div>
          <div class="bloom"></div>
          <img class="logo" src="/images/logo.png" alt="logo" />
        </div>

        <h1 class="brand-text">At Home Driving School</h1>
        <p class="tagline splash-message"></p>

        <div class="loader">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>

        <div class="footer-note">
          Powered by <span class="glow">SAHA</span>
        </div>
      </div>
    `;

    document.body.appendChild(el);
  }

  // Update message
  el.querySelector(".splash-message").textContent = message;

  // Show it
  el.classList.add("show");
  el.classList.remove("hide");

  // Safeguard: auto-hide after maxMs
  clearTimeout(el._maxTimer);
  el._minMs = minMs;
  el._maxTimer = setTimeout(() => forceHide(el), maxMs);
}

/**
 * Hide the splash screen if minimum display time has passed.
 */
export async function hideSplash() {
  const el = document.getElementById(SPLASH_ID);
  if (!el) return;

  const elapsed = performance.now() - shownAt;
  const wait = Math.max(0, (el._minMs || 0) - elapsed);

  await new Promise((r) => setTimeout(r, wait));
  forceHide(el);
}

/**
 * Immediately hide + remove splash with transition.
 */
function forceHide(el) {
  if (!el || el.classList.contains("hide")) return;

  el.classList.add("hide");
  el.classList.remove("show");
  clearTimeout(el._maxTimer);

  // Remove after fade-out transition
  const cleanup = () => el.remove();
  el.addEventListener("transitionend", cleanup, { once: true });

  // Fallback
  setTimeout(cleanup, 650);
}
