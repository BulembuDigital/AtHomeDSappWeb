import { supabase } from "./supabaseClient.js";

/**
 * Get the current authenticated user's profile
 */
export async function getMyProfile() {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("Not authenticated.");

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update profile fields of the current user
 * Only allowed fields: name, phone, avatar_url, bio, etc. (your schema)
 */
export async function updateMyProfile(updates) {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError) throw userError;
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

/**
 * Admin or Supervisor: Get ANY profile
 */
export async function getProfileById(id) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Supervisor and Admin: list profiles by role/zone/status
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

/**
 * Approve a user (Admin or Supervisor)
 */
export async function approveUser(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .update({ status: "approved" })
        .eq("id", userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Suspend a user (Admin or Supervisor)
 */
export async function suspendUser(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .update({ status: "suspended" })
        .eq("id", userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}
