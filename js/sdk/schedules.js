import { supabase } from "./supabaseClient.js";

/**
 * Get all schedules visible to the logged-in user.
 * RLS enforces:
 * - Instructor → sees their lessons
 * - TL → sees lessons for instructors they manage
 * - Manager/Admin → sees by zone
 * - Supervisor → sees all
 */
export async function getAllSchedules() {
    const { data, error } = await supabase
        .from("schedules")
        .select(`
            *,
            routes(*),
            instructor:profiles!instructor_id(*),
            client:profiles!client_id(*)
        `)
        .order("slot_start", { ascending: true });

    if (error) throw error;
    return data;
}

/**
 * Get schedules for a specific instructor
 */
export async function getInstructorSchedules(instructorId) {
    const { data, error } = await supabase
        .from("schedules")
        .select(`
            *,
            routes(*),
            client:profiles!client_id(*)
        `)
        .eq("instructor_id", instructorId)
        .order("slot_start");

    if (error) throw error;
    return data;
}

/**
 * Get schedules for a specific client
 */
export async function getClientSchedules(clientId) {
    const { data, error } = await supabase
        .from("schedules")
        .select(`
            *,
            routes(*),
            instructor:profiles!instructor_id(*)
        `)
        .eq("client_id", clientId)
        .order("slot_start");

    if (error) throw error;
    return data;
}

/**
 * Create a time slot (Manager or TL)
 * Typical use:
 * TL adds instructor availability
 */
export async function createSchedule(scheduleData) {
    const { data, error } = await supabase
        .from("schedules")
        .insert(scheduleData)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a schedule — used for:
 * - Marking as booked
 * - Rescheduling
 * - Assigning client
 * - Assigning instructor
 * - Adding route
 */
export async function updateSchedule(scheduleId, updateData) {
    const { data, error } = await supabase
        .from("schedules")
        .update(updateData)
        .eq("id", scheduleId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a schedule — for Admin / Manager / TL
 */
export async function deleteSchedule(scheduleId) {
    const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", scheduleId);

    if (error) throw error;
    return true;
}

/**
 * Assign a route to an existing schedule
 */
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

/**
 * Assign client to schedule (turn "free slot" → "booked lesson")
 */
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

/**
 * Cancel a booking (Client or TL)
 */
export async function cancelSchedule(scheduleId, reason = null) {
    const { data, error } = await supabase
        .from("schedules")
        .update({
            client_id: null,
            status: "cancelled",
            cancel_reason: reason
        })
        .eq("id", scheduleId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Subscribe to live schedule updates
 */
export function subscribeToSchedules(callback) {
    return supabase
        .channel("schedules_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "schedules" },
            payload => callback(payload)
        )
        .subscribe();
}
