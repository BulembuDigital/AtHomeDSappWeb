// /js/env.js (ES module)
// Environment values for client-side app.
// NOTE: keep secrets out of frontend in production. Anon key is required for the browser client.

/*
  --- PROJECT VALUES ---
  Set PROJECT_URL to your Supabase project URL (https://<project>.supabase.co)
  Keep the ANON key client-side (it's public by design) but avoid committing it to public repos.
*/
const PROJECT_URL = "https://ocumymkpotzyyelbctls.supabase.co";

// Public anon key (browser). OK for the client but DO NOT commit to a public repo.
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdW15bWtwb3R6eXllbGJjdGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDk5NDEsImV4cCI6MjA2NzQ4NTk0MX0.BeAafZi4o3lPlJDQ6zdBvzxcxz9jFkXV8cBZJH92Unk";

/* ---------- Dev host detection ---------- */
const DEV_HOSTS = ["127.0.0.1", "localhost", "0.0.0.0"];
const IS_DEV = DEV_HOSTS.includes(location.hostname);

/* ---------- Helpers ---------- */
function safeTrim(s) {
  return typeof s === "string" ? s.replace(/\/+$/, "") : "";
}

/**
 * Build a functions base URL from a project URL.
 * Typical supabase functions host is: https://<project>.functions.supabase.co
 * If PROJECT_URL doesn't look like a supabase URL we simply return the trimmed value.
 */
function buildFunctionsBase(url) {
  const trimmed = safeTrim(url);
  if (!trimmed) return "";
  if (trimmed.includes(".supabase.co")) {
    // convert the right-most ".supabase.co" -> ".functions.supabase.co"
    return trimmed.replace(/\.supabase\.co$/, ".functions.supabase.co");
  }
  return trimmed;
}

/* ---------- Exports (used by client code) ---------- */
export const SUPABASE_URL = PROJECT_URL;
export const SUPABASE_ANON_KEY = ANON_KEY;
export const FUNCTIONS_BASE = buildFunctionsBase(PROJECT_URL);

// Google Maps API key (used client-side to load the Maps JS).
// NOTE: in production you should restrict this key by HTTP referrer
// to your domains and avoid embedding unrestricted keys in public repos.
export const GOOGLE_MAPS_API_KEY = "AIzaSyAaUgS1gXeFUz6WXETKXjqBfu4xK9Ttmdg"; // <-- PASTE YOUR KEY HERE (e.g. "AIza...")

// Redirect MUST be absolute & must match the entry in Supabase Auth → Redirect URLs.
// For local development we default to a common local preview address used by many dev servers.
export const VERIFY_URL = IS_DEV
  ? "http://127.0.0.1:5500/html/verify-otp.html"
  : "https://athomedrivingschool.site/html/verify-otp.html"; // ensure this exact URL is listed in your Supabase Redirect URLs

/* ---------- Runtime checks (client-only guards) ---------- */
if (!SUPABASE_URL || !SUPABASE_URL.includes(".supabase.co")) {
  console.error("[env] Invalid SUPABASE_URL:", SUPABASE_URL);
}

// anon key check: don't log the key itself
if (!SUPABASE_ANON_KEY || typeof SUPABASE_ANON_KEY !== "string" || SUPABASE_ANON_KEY.length < 20) {
  console.error("[env] Missing/invalid anon key!");
} else {
  console.log("[env] SUPABASE_ANON_KEY present (value hidden)");
}

if (!VERIFY_URL || !VERIFY_URL.startsWith("http")) {
  console.error("[env] VERIFY_URL must be absolute. Current:", VERIFY_URL);
}

if (!FUNCTIONS_BASE || !FUNCTIONS_BASE.includes(".functions.supabase.co")) {
  console.warn("[env] FUNCTIONS_BASE looks unusual (did you set PROJECT_URL?):", FUNCTIONS_BASE);
}

// Google Maps key: warn in dev if missing (safe — just a dev-time helper)
if (!GOOGLE_MAPS_API_KEY || typeof GOOGLE_MAPS_API_KEY !== "string" || GOOGLE_MAPS_API_KEY.length < 20) {
  if (IS_DEV) {
    console.warn("[env] GOOGLE_MAPS_API_KEY is not set. Map will not load until you put the key in /js/env.js");
  } else {
    console.warn("[env] GOOGLE_MAPS_API_KEY missing — production map may fail. Ensure you've added a restricted key.");
  }
}

/* ---------- Notes ----------
 - Do not store sensitive server secrets (service_role, sendgrid keys, FUNCTIONS_SECRET) in this file.
 - For production email/edge tasks, host secrets in server-side functions (Edge Functions, serverless)
   and do not expose them to browser JS.
 - Google Maps key should be restricted by HTTP referrer:
     For local dev add:
       http://127.0.0.1:5500/*
       http://localhost:5500/*
     For production add:
       https://your.production.domain/*
 ---------------------------------- */
