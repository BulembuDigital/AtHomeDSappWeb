import { supabase } from "./supabaseClient.js";

/* -------------------------------------------------------
   INSERT CLOCK EVENTS
------------------------------------------------------- */

/**
 * Generic method to insert a clock event.
 * 
 * RLS guarantees:
 *   - Users can only insert for themselves.
 *   - No one can fake timestamps for another user.
 */
export async function addClockEvent(myId, type, meta = {}) {
    const { error } = await supabase
        .from("clock_events")
        .insert({
            user_id: myId,
            type,
            ts: new Date().toISOString(),
            meta
        });

    if (error) throw error;
}

/** Convenience — Clock In */
export async function clockIn(myId, meta = {}) {
    return addClockEvent(myId, "in", meta);
}

/** Convenience — Clock Out */
export async function clockOut(myId, meta = {}) {
    return addClockEvent(myId, "out", meta);
}

/**
 * Convenience — Client showed up on time.
 * Called automatically when the app detects
 * matching location + schedule.
 */
export async function markClientShow(myId, meta = {}) {
    return addClockEvent(myId, "client_showed_up", meta);
}

/* -------------------------------------------------------
   FETCH EVENTS (RESPECTING RLS)
------------------------------------------------------- */

/**
 * Fetch events visible to the current user.
 * RLS handles:
 *   - Admin/Supervisor: full zone or global
 *   - TL: assigned instructors/clients
 *   - Instructor: only clients
 *   - Client: only themselves
 */
export async function getVisibleEvents(days = 7) {
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data, error } = await supabase
        .from("clock_events")
        .select("*")
        .gte("ts", since)
        .order("ts", { ascending: false });

    if (error) throw error;
    return data;
}

/* -------------------------------------------------------
   FETCH EVENTS FOR SPECIFIC USER
   (RLS restricts access)
------------------------------------------------------- */

export async function getEventsForUser(userId, days = 7) {
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data, error } = await supabase
        .from("clock_events")
        .select("*")
        .eq("user_id", userId)
        .gte("ts", since)
        .order("ts", { ascending: false });

    if (error) throw error;
    return data;
}

/* -------------------------------------------------------
   REALTIME SUBSCRIPTION
------------------------------------------------------- */

/**
 * Realtime feed for clock activity:
 * - clock-in
 * - clock-out
 * - client_showed_up
 *
 * RLS filters which events the subscriber receives.
 */
export function subscribeClockEvents(callback) {
    return supabase
        .channel("clock_events_feed")
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "clock_events" },
            payload => callback(payload.new)
        )
        .subscribe();
}
