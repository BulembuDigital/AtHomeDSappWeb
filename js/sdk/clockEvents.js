// /js/sdk/clockEvents.js
// Unified + zone-consistent + RLS-safe

import { supabase } from "./supabaseClient.js";

/* -------------------------------------------------------------
   BASE EVENT INSERT
   RLS guarantees:
   - Users can only insert for themselves
   - Supervisors/Admin/Manager cannot fake other users’ events
   - TL sees only instructors/clients in their zone (via RLS)
------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   SHORTCUTS (used across dashboards)
------------------------------------------------------------- */
export async function clockIn(myId, meta = {}) {
  return addClockEvent(myId, "in", meta);
}

export async function clockOut(myId, meta = {}) {
  return addClockEvent(myId, "out", meta);
}

/**
 * Called when the system detects:
 * - client + instructor in same location OR
 * - instructor marks client as arrived
 */
export async function markClientShow(myId, meta = {}) {
  return addClockEvent(myId, "client_showed_up", meta);
}

/* -------------------------------------------------------------
   FETCH EVENTS VISIBLE TO CURRENT USER (RLS controlled)
------------------------------------------------------------- */

export async function getVisibleEvents(days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from("clock_events")
    .select(`
      *,
      user:profiles!user_id(name, role, zone)
    `)
    .gte("ts", since)
    .order("ts", { ascending: false });

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   FETCH EVENTS FOR A SPECIFIC USER (RLS applies)
------------------------------------------------------------- */
export async function getEventsForUser(userId, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from("clock_events")
    .select(`
      *,
      user:profiles!user_id(name, role, zone)
    `)
    .eq("user_id", userId)
    .gte("ts", since)
    .order("ts", { ascending: false });

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   SUPERVISOR-ONLY: Fetch for ALL users
   (Supervisor is the only role with global access)
------------------------------------------------------------- */
export async function getClockEventsForAll(days = 10) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from("clock_events")
    .select(`
      *,
      user:profiles!user_id(name, role, zone)
    `)
    .gte("ts", since)
    .order("ts", { ascending: false });

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   REALTIME STREAM (used by Supervisor, TL, Admin dashboards)
------------------------------------------------------------- */

export function subscribeClockEvents(callback) {
  return supabase
    .channel("clock_events_feed")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "clock_events"
      },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
