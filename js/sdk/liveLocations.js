import { supabase } from "./supabaseClient.js";

/* -------------------------------------------------------
   REALTIME SUBSCRIPTION
------------------------------------------------------- */

/**
 * Subscribe to location updates for your zone.
 * 
 * The server RLS automatically restricts which rows
 * the client will receive.
 */
export function subscribeLiveLocations(callback) {
    return supabase
        .channel("live_locations_changes")
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "live_locations" },
            payload => callback(payload.new)
        )
        .subscribe();
}

/* -------------------------------------------------------
   UPDATE OWN LOCATION
------------------------------------------------------- */

/**
 * Called by any authenticated user (client/instructor/TL/admin/supervisor).
 *
 * RLS ensures:
 *  - Users can update ONLY their own row,
 *  - They cannot overwrite someone else’s location,
 *  - They cannot fake role/zone because those come from INSERT.
 */
export async function updateMyLocation(myId, coords) {
    const { lat, lng, accuracy = null, heading = null, speed = null } = coords;

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

/* -------------------------------------------------------
   INITIALIZE LOCATION ROW
------------------------------------------------------- */

/**
 * Ensures the user has a location row.  
 * Called after login.
 *
 * You MUST create the row server-side (edge function or SQL trigger)
 * OR explicitly allow INSERT for the user (your RLS does).
 */
export async function ensureMyLocationRow(myId, role, zone) {
    const { data } = await supabase
        .from("live_locations")
        .select("user_id")
        .eq("user_id", myId)
        .maybeSingle();

    if (data) return; // already exists

    const { error } = await supabase.from("live_locations").insert({
        user_id: myId,
        role,
        zone,
        lat: null,
        lng: null,
        updated_at: new Date().toISOString()
    });

    if (error) throw error;
}

/* -------------------------------------------------------
   READ ACCESS (RLS-SAFE)
------------------------------------------------------- */

/**
 * Get all locations the logged-in user is permitted to see.
 *
 * RLS handles all filtering:
 *  - Admins → only their zone
 *  - Supervisor → all zones
 *  - TL → instructors & clients assigned to them
 *  - Instructor → only their clients
 *  - Client → only themself
 */
export async function getVisibleLocations() {
    const { data, error } = await supabase
        .from("live_locations")
        .select("*");

    if (error) throw error;

    return data;
}

/* -------------------------------------------------------
   SINGLE USER LOOKUP
------------------------------------------------------- */

export async function getUserLocation(userId) {
    const { data, error } = await supabase
        .from("live_locations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}
