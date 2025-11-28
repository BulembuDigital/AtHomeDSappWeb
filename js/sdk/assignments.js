import { supabase } from "./supabaseClient.js";

/**
 * Fetch everything visible to the logged-in user.
 * RLS will automatically filter results by:
 * - TL: instructors + clients under them
 * - Instructor: their own clients
 * - Admin/Manager: zone-limited
 * - Supervisor: all
 */
export async function getAllAssignments() {
    const { data, error } = await supabase
        .from("assignments")
        .select(`
            *,
            instructor:profiles!instructor_id(*),
            team_leader:profiles!team_leader_id(*),
            client:profiles!client_id(*)
        `)
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
}

/**
 * Get all instructors assigned to a given TL
 */
export async function getInstructorsForTL(tlId) {
    const { data, error } = await supabase
        .from("assignments")
        .select("*, instructor:profiles!instructor_id(*)")
        .eq("team_leader_id", tlId)
        .is("client_id", null);

    if (error) throw error;
    return data;
}

/**
 * Get all clients assigned to a given instructor
 */
export async function getClientsForInstructor(instructorId) {
    const { data, error } = await supabase
        .from("assignments")
        .select("*, client:profiles!client_id(*)")
        .eq("instructor_id", instructorId)
        .not("client_id", "is", null);

    if (error) throw error;
    return data;
}

/**
 * Assign an instructor → TL
 * - RLS: Only Admin/Manager can do this
 * - If existing row exists (client_id IS NULL), update instead of insert
 */
export async function assignInstructorToTL(instructorId, tlId, zone) {
    // First check if instructor already has a TL row
    const { data: existing } = await supabase
        .from("assignments")
        .select("id")
        .eq("instructor_id", instructorId)
        .is("client_id", null)
        .maybeSingle();

    if (existing) {
        const { data, error } = await supabase
            .from("assignments")
            .update({
                team_leader_id: tlId,
                zone
            })
            .eq("id", existing.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from("assignments")
        .insert({
            instructor_id: instructorId,
            team_leader_id: tlId,
            client_id: null,
            zone
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Assign a client → Instructor
 * - RLS: TL/Admin/Manager depending on zone
 * - Will keep TL automatically
 */
export async function assignClientToInstructor(clientId, instructorId) {
    // Fetch the instructor's TL + zone
    const [{ data: instr }, { data: tlRow }] = await Promise.all([
        supabase
            .from("profiles")
            .select("id, zone")
            .eq("id", instructorId)
            .maybeSingle(),

        supabase
            .from("assignments")
            .select("team_leader_id")
            .eq("instructor_id", instructorId)
            .is("client_id", null)
            .maybeSingle()
    ]);

    if (!instr) throw new Error("Instructor not found.");

    const zone = instr.zone;
    const tlId = tlRow?.team_leader_id || null;

    // Update client zone so RLS becomes correct
    await supabase
        .from("profiles")
        .update({ zone })
        .eq("id", clientId);

    // Now check if client already has a row
    const { data: existing } = await supabase
        .from("assignments")
        .select("id")
        .eq("client_id", clientId)
        .maybeSingle();

    if (existing) {
        const { data, error } = await supabase
            .from("assignments")
            .update({
                instructor_id: instructorId,
                team_leader_id: tlId,
                zone
            })
            .eq("id", existing.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from("assignments")
        .insert({
            client_id: clientId,
            instructor_id: instructorId,
            team_leader_id: tlId,
            zone
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Remove client assignment
 * TL/Admin can do this
 */
export async function unassignClient(clientId) {
    const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("client_id", clientId);

    if (error) throw error;
    return true;
}

/**
 * Remove an instructor's TL assignment
 */
export async function unassignInstructor(instructorId) {
    const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("instructor_id", instructorId)
        .is("client_id", null);

    if (error) throw error;
    return true;
}

/**
 * Subscribe to realtime instructor/client assignments
 */
export function subscribeAssignments(callback) {
    return supabase
        .channel("assignments_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "assignments" },
            payload => callback(payload)
        )
        .subscribe();
}
