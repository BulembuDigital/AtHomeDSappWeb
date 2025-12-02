// /js/supabaseClient.js
// Shared Supabase client for all SDK + page scripts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Project constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = "https://ocumymkpotzyyelbctls.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdW15bWtwb3R6eXllbGJjdGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDk5NDEsImV4cCI6MjA2NzQ4NTk0MX0.BeAafZi4o3lPlJDQ6zdBvzxcxz9jFkXV8cBZJH92Unk";


// ---------------------------------------------------------------------------
// Prevent duplicate clients (hot reload, Vercel, local dev, etc.)
// ---------------------------------------------------------------------------

if (!window.__supabaseSingleton) {
  window.__supabaseSingleton = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = window.__supabaseSingleton;


// ---------------------------------------------------------------------------
// Helpers (consistent across all SDK modules)
// ---------------------------------------------------------------------------

/**
 * Ensures every SDK call returns:
 * { ok: boolean, data?: any, error?: string }
 */
export function wrap(result) {
  if (!result) {
    return { ok: false, error: "Unknown Supabase error" };
  }

  if (result.error) {
    return {
      ok: false,
      error: result.error.message || "Unexpected error",
    };
  }

  return {
    ok: true,
    data: result.data ?? null,
  };
}


/**
 * Returns the active session object or null
 */
export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}


/**
 * Returns the authenticated userId or null
 */
export async function getCurrentUserId() {
  const session = await getCurrentSession();
  return session?.user?.id || null;
}


/**
 * Update persistence mode:
 * - "local"   → stays logged in across tabs/reloads
 * - "session" → logs out when browser closes
 * - "none"    → logs out on reload
 */
export async function setAuthPersistence(mode = "local") {
  try {
    await supabase.auth.setPersistence(mode);
  } catch (err) {
    console.warn("Failed to set persistence:", err.message);
  }
}
