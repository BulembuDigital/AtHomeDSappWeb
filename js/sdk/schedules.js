// /js/sdk/schedules.js
// Unified schedule SDK for TL, Instructor, Client, Admin, Manager.
// All visibility is handled by RLS automatically.

import { supabase } from "./supabaseClient.js";

/* =====================================================================
   FETCH ALL VISIBLE SCHEDULES (global reader)
   (Supervisor → all, Admin/Manager → zone, TL → instructors, etc.)
===================================================================== */
export async function getAllSchedules(zone = null) {
  let q = supabase
    .from("schedules")
    .select(`
        *,
        instructor:profiles!instructor_id(*),
        client:profiles!client_id(*)
    `)
    .order("slot_start", { ascending: true });

  if (zone) q = q.eq("zone_type", zone);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/* =====================================================================
   INSTRUCTOR — get availability + booked lessons
===================================================================== */
export async function getInstructorSlots(instructorId, zone = null) {
  let q = supabase
    .from("schedules")
    .select("*")
    .eq("instructor_id", instructorId)
    .order("slot_start");

  if (zone) q = q.eq("zone_type", zone);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/* =====================================================================
   CLIENT — get lessons
===================================================================== */
export async function getMyLessons(clientId, zone = null) {
  let q = supabase
    .from("schedules")
    .select(`
        *,
        instructor:profiles!instructor_id(*)
    `)
    .eq("client_id", clientId)
    .order("slot_start");

  if (zone) q = q.eq("zone_type", zone);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/* =====================================================================
   TEAM LEADER — see zone instructor schedules
===================================================================== */
export async function getSchedulesForTL(tlId) {
  const { data, error } = await supabase
    .from("schedules")
    .select(`
        *,
        instructor:profiles!instructor_id(*),
        client:profiles!client_id(*)
    `)
    .eq("team_leader_id", tlId)
    .order("slot_start");

  if (error) throw error;
  return data;
}

/* =====================================================================
   CREATE AVAILABILITY SLOT (TL or Manager)
===================================================================== */
export async function createScheduleSlot({ instructor_id, date, start, end, zone_type }) {
  const slot_start = `${date}T${start}:00`;
  const slot_end   = `${date}T${end}:00`;

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      instructor_id,
      slot_start,
      slot_end,
      zone_type,
      status: "available"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =====================================================================
   BOOK SLOT (TL or Client)
===================================================================== */
export async function bookSchedule(scheduleId, clientId) {
  const { data, error } = await supabase
    .from("schedules")
    .update({
      client_id: clientId,
      status: "booked"
    })
    .eq("id", scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =====================================================================
   REQUEST LESSON CANCELLATION (Client)
===================================================================== */
export async function requestCancelLesson(scheduleId) {
  const { data, error } = await supabase
    .from("schedules")
    .update({
      status: "cancel_requested"
    })
    .eq("id", scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =====================================================================
   TEAM LEADER APPROVES / DECLINES CANCELLATION
===================================================================== */
export async function approveCancel(scheduleId) {
  const { data, error } = await supabase
    .from("schedules")
    .update({
      client_id: null,
      status: "cancelled"
    })
    .eq("id", scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function declineCancel(scheduleId) {
  const { data, error } = await supabase
    .from("schedules")
    .update({
      status: "booked"
    })
    .eq("id", scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =====================================================================
   DELETE SLOT (TL/Admin)
===================================================================== */
export async function deleteSlot(scheduleId) {
  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) throw error;
  return true;
}

/* =====================================================================
   MARK SLOT AS AVAILABLE AGAIN (remove client)
===================================================================== */
export async function markSlotAvailable(scheduleId) {
  const { data, error } = await supabase
    .from("schedules")
    .update({
      client_id: null,
      status: "available"
    })
    .eq("id", scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =====================================================================
   ROUTE ATTACH
===================================================================== */
export async function attachRoute(scheduleId, routeId) {
  const { data, error } = await supabase
    .from("schedules")
    .update({ route_id: routeId })
    .eq("id", scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* =====================================================================
   REALTIME SUBSCRIPTION
===================================================================== */
export function subscribeSchedules(callback) {
  return supabase
    .channel("schedules_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "schedules" },
      (payload) => callback(payload)
    )
    .subscribe();
}
