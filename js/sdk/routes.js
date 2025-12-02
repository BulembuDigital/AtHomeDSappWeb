// /js/sdk/routes.js
// Clean, RLS-friendly route manager.
// Supports: TL personal routes, Instructor personal routes,
// Admin/Manager zone routes, Supervisor global routes.

import { supabase } from "./supabaseClient.js";

/* ============================================================
   GET ALL ROUTES VISIBLE TO CURRENT USER (RLS enforced)
============================================================ */
export async function getAllRoutes() {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* ============================================================
   GET ROUTES FOR SPECIFIC USER (TL or Instructor)
============================================================ */
export async function getRoutesForUser(userId) {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* ============================================================
   GET ALL ROUTES IN A ZONE (Admin/Manager/Supervisor)
============================================================ */
export async function getAllRoutesForZone(zone) {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("zone_type", zone)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* ============================================================
   GET SINGLE ROUTE
============================================================ */
export async function getRouteById(id) {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/* ============================================================
   SAVE ROUTE (TL, Instructor, Admin, Manager)
   Smart upsert: create OR update
============================================================ */
export async function saveRoute(route) {
  // Expected shape:
  // { id?, user_id, title, geojson, zone_type }

  const { data, error } = await supabase
    .from("routes")
    .upsert(route, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* ============================================================
   DELETE ROUTE
============================================================ */
export async function deleteRoute(id) {
  const { error } = await supabase
    .from("routes")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}

/* ============================================================
   REALTIME SUBSCRIPTION
============================================================ */
export function subscribeRoutes(callback) {
  return supabase
    .channel("routes_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "routes" },
      (payload) => callback(payload)
    )
    .subscribe();
}
