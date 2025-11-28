// /js/theme.js
// Robust theme manager: system-aware, persistent, multi-tab sync.

const STORAGE_KEY = "ahds-theme"; // "light" | "dark" | "system"
const DATA_ATTR = "data-theme";   // set on <html>
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const THEME_SYSTEM = "system";

// Read saved pref; default to "system"
function getSavedPref() {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === THEME_LIGHT || v === THEME_DARK || v === THEME_SYSTEM ? v : THEME_SYSTEM;
}

// Match current system dark mode
function systemPrefIsDark() {
  return globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Compute the effective theme ("light"|"dark") from pref
function computeEffectiveTheme(pref) {
  if (pref === THEME_LIGHT) return THEME_LIGHT;
  if (pref === THEME_DARK) return THEME_DARK;
  return systemPrefIsDark() ? THEME_DARK : THEME_LIGHT;
}

// Apply theme to <html> attribute and update toggle icons/labels
function applyTheme(pref = getSavedPref()) {
  const effective = computeEffectiveTheme(pref);
  document.documentElement.setAttribute(DATA_ATTR, effective);

  // Update any toggle buttons to reflect the *resulting* theme
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    // Simple icon content state; you can style with CSS masks/SVG background
    btn.setAttribute("aria-pressed", effective === THEME_DARK ? "true" : "false");
    btn.title = effective === THEME_DARK ? "Switch to light mode" : "Switch to dark mode";
    // Optional: swap an icon class
    btn.dataset.icon = effective; // "light" or "dark"
  });
}

// Persist a new preference
function setPref(pref) {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
}

// Cycle light ↔ dark (ignore "system" on click for simplicity)
function toggleTheme() {
  const current = document.documentElement.getAttribute(DATA_ATTR) || computeEffectiveTheme(getSavedPref());
  const next = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  setPref(next);
}

// React to OS theme changes *only* when pref = system
function handleSystemChange(e) {
  if (getSavedPref() === THEME_SYSTEM) applyTheme(THEME_SYSTEM);
}

// Keep tabs/windows in sync
function handleStorageSync(e) {
  if (e.key === STORAGE_KEY) applyTheme(getSavedPref());
}

// Public init: call this once on every page
export function initTheme() {
  // Initial paint
  applyTheme(getSavedPref());

  // Wire all toggles
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    e.preventDefault();
    toggleTheme();
  });

  // Optional: long-press on toggle -> cycle system/light/dark
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    let pressTimer;
    btn.addEventListener("mousedown", () => {
      pressTimer = setTimeout(() => {
        const pref = getSavedPref();
        const next =
          pref === THEME_SYSTEM ? THEME_LIGHT :
          pref === THEME_LIGHT  ? THEME_DARK  :
                                  THEME_SYSTEM;
        setPref(next);
      }, 650); // hold to cycle mode strategy
    });
    ["mouseup","mouseleave","touchend","touchcancel"].forEach(ev =>
      btn.addEventListener(ev, () => clearTimeout(pressTimer))
    );
  });

  // System changes
  if (globalThis.matchMedia) {
    const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", handleSystemChange);
    // Safari fallback:
    mq.addListener?.(handleSystemChange);
  }

  // Cross-tab sync
  globalThis.addEventListener("storage", handleStorageSync);
}

// Expose helpers if you ever need them
export const Theme = {
  getPref: getSavedPref,
  setPref,
  toggle: toggleTheme,
  effective: () => document.documentElement.getAttribute(DATA_ATTR) || computeEffectiveTheme(getSavedPref()),
};
