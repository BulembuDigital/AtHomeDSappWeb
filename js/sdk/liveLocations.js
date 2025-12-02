// /js/sdk/liveLocations.js
// Unified live-location system with full RLS support
import { supabase } from "./supabaseClient.js";

/* ============================================================
   REALTIME STREAMING
   ============================================================
   getLiveLocationsStream(scope, callback)
   scope can be:
     - "ALL" → Supervisor only
     - zone string (e.g., "CUT", "UFS") → Admin, Manager, TL
     - user_id → Instructor / Client
============================================================ */

export function getLiveLocationsStream(scope, callback) {
  const channel = supabase.channel("live_locations_stream_" + scope);

  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "live_locations"
    },
    (payload) => {
      const loc = payload.new;

      // Supervisor sees ALL
      if (scope === "ALL") {
        callback(loc);
        return;
      }

      // Zone-based (Admin, Manager, TL)
      if (typeof scope === "string" && scope !== "ALL") {
        if (loc.zone === scope) callback(loc);
        return;
      }

      // User-based (Instructor, Client)
      if (loc.user_id === scope) callback(loc);
    }
  );

  channel.subscribe();
  return channel;
}

/* ============================================================
   UPDATE OWN LOCATION
   ============================================================
   Called by any logged-in user.
   RLS ensures a user can ONLY update their own row.
============================================================ */

export async function updateMyLocation(myId, coords) {
  const {
    lat,
    lng,
    accuracy = null,
    heading = null,
    speed = null
  } = coords;

  const { error } = await supabase
    .from("live_locations")
    .update({
      lat,
      lng,
      accuracy,
      heading,
      speed,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", myId);

  if (error) throw error;
}

/* ============================================================
   ENSURE LOCATION ROW EXISTS
   ============================================================
   Called after login.
   RLS must allow INSERT for the user or you must have a SQL trigger.
============================================================ */

export async function ensureMyLocationRow(myId, role, zone) {
  const { data } = await supabase
    .from("live_locations")
    .select("user_id")
    .eq("user_id", myId)
    .maybeSingle();

  if (data) return; // already exists

  const { error } = await supabase
    .from("live_locations")
    .insert({
      user_id: myId,
      role,
      zone,
      lat: null,
      lng: null,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

/* ============================================================
   LIST VISIBLE LOCATIONS (RLS LIMITS VISIBILITY)
============================================================ */

export async function getVisibleLocations() {
  const { data, error } = await supabase
    .from("live_locations")
    .select("*");

  if (error) throw error;

  return data;
}

/* ============================================================
   SINGLE USER LOOKUP
============================================================ */

export async function getUserLocation(userId) {
  const { data, error } = await supabase
    .from("live_locations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
