// /js/theme.js
// Smart theme manager: system-aware, persistent, cross-tab synced.

const STORAGE_KEY = "ahds-theme"; // "light" | "dark" | "system"
const DATA_ATTR = "data-theme";   // applied to <html>

const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const THEME_SYSTEM = "system";


// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function getSavedPref() {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === THEME_LIGHT || v === THEME_DARK || v === THEME_SYSTEM) return v;
  return THEME_SYSTEM;
}

function systemPrefIsDark() {
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function computeEffective(pref) {
  if (pref === THEME_LIGHT) return THEME_LIGHT;
  if (pref === THEME_DARK) return THEME_DARK;
  return systemPrefIsDark() ? THEME_DARK : THEME_LIGHT;
}


// -------------------------------------------------------------
// Apply theme to DOM
// -------------------------------------------------------------
function applyTheme(pref = getSavedPref()) {
  const effective = computeEffective(pref);

  document.documentElement.setAttribute(DATA_ATTR, effective);

  // Update toggle buttons to reflect REAL resulting state
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-pressed", effective === THEME_DARK ? "true" : "false");
    btn.dataset.icon = effective; // CSS can style icons based on light/dark
    btn.title =
      effective === THEME_DARK ? "Switch to light mode" : "Switch to dark mode";
  });
}


// -------------------------------------------------------------
// Persistence + Toggles
// -------------------------------------------------------------
function setPref(pref) {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute(DATA_ATTR) ||
    computeEffective(getSavedPref());

  const next = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  setPref(next);
}


// -------------------------------------------------------------
// Reactive Behavior (system & multi-tab)
// -------------------------------------------------------------
function handleSystemChange() {
  if (getSavedPref() === THEME_SYSTEM) {
    applyTheme(THEME_SYSTEM);
  }
}

function handleStorageSync(e) {
  if (e.key === STORAGE_KEY) {
    applyTheme(getSavedPref());
  }
}


// -------------------------------------------------------------
// INIT — Call on every page
// -------------------------------------------------------------
export function initTheme() {
  // 1. First paint
  applyTheme(getSavedPref());

  // 2. Click toggles
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-theme-toggle]");
    if (!btn) return;
    ev.preventDefault();
    toggleTheme();
  });

  // 3. Long-press to cycle system → light → dark → system
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    let timer;
    btn.addEventListener("mousedown", () => {
      timer = setTimeout(() => {
        const p = getSavedPref();
        const next =
          p === THEME_SYSTEM ? THEME_LIGHT :
          p === THEME_LIGHT  ? THEME_DARK  :
                               THEME_SYSTEM;
        setPref(next);
      }, 650);
    });

    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((ev) =>
      btn.addEventListener(ev, () => clearTimeout(timer))
    );
  });

  // 4. System theme changes
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", handleSystemChange);
  mq.addListener?.(handleSystemChange); // Safari fallback

  // 5. Multi-tab sync
  addEventListener("storage", handleStorageSync);
}


// -------------------------------------------------------------
// Optional public API
// -------------------------------------------------------------
export const Theme = {
  getPref: getSavedPref,
  setPref,
  toggle: toggleTheme,
  effective: () =>
    document.documentElement.getAttribute(DATA_ATTR) ||
    computeEffective(getSavedPref()),
};
