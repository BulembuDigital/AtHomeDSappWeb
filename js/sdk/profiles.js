// /js/sdk/profiles.js
// Centralized profile manager — fully RLS-compliant with your role model.

import { supabase } from "./supabaseClient.js";

/* ============================================================
   AUTH → GET CURRENT PROFILE
============================================================ */

/**
 * Fetch the authenticated user's profile.
 * RLS ensures the user can only see their own row unless Admin/Supervisor.
 */
export async function getMyProfile() {
  const { data: sessionData, error: sessErr } = await supabase.auth.getUser();
  if (sessErr) throw sessErr;

  const user = sessionData?.user;
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/* ============================================================
   PROFILE UPDATE (SELF-ONLY)
============================================================ */

/**
 * Update authenticated user’s own profile.
 * Allowed fields: name, phone, zone, avatar_url, etc.
 * RLS ensures they cannot elevate role or modify protected fields.
 */
export async function updateMyProfile(updates = {}) {
  const { data: sessionData, error: sessErr } = await supabase.auth.getUser();
  if (sessErr) throw sessErr;

  const user = sessionData?.user;
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ============================================================
   ADMIN / SUPERVISOR ACCESSORS
============================================================ */

/**
 * Fetch ANY user's profile (Supervisor = global,
 * Admin = restricted by RLS to their zone).
 */
export async function getProfileById(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * List users by optional filters.
 * RLS limits results depending on the caller.
 * Supervisor → all
 * Admin → their zone
 * Manager → their zone
 */
export async function listProfiles({ role = null, zone = null, status = null } = {}) {
  let q = supabase.from("profiles").select("*");

  if (role) q = q.eq("role", role);
  if (zone) q = q.eq("zone", zone);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/* ============================================================
   APPROVAL FLOW (Admin/Supervisor)
============================================================ */

/**
 * Approve a user.
 * - Supervisor: any user
 * - Admin: only within their zone (RLS enforced)
 */
export async function approveUser(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ status: "approved", approved: true })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Suspend a user.
 * - Supervisor: anyone except other supervisors
 * - Admin: anyone except Supervisor, restricted by their zone
 */
export async function suspendUser(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ status: "suspended", approved: false })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ============================================================
   SEARCH (Supervisor + Admin zone-restricted)
============================================================ */

/**
 * Search users by name or email.
 * RLS restricts results automatically.
 */
export async function searchProfiles(query) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

/* ============================================================
   ZONE HELPERS (Manager / TL)
============================================================ */

/**
 * Get all profiles inside a specific zone.
 * - Admin: can see own zone fully
 * - Manager: same
 * - TL / Instructor / Client: RLS blocks rows they shouldn’t see
 */
export async function getUsersByZone(zone) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("zone", zone);

  if (error) throw error;
  return data;
}
