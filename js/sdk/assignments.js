// /js/sdk/assignments.js
// Clean, unified, role-consistent assignment utilities

import { supabase } from "./supabaseClient.js";

/* -------------------------------------------------------------
   FETCH EVERYTHING (Supervisor/Admin/Manager auto-filtered by RLS)
------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   TL → Instructors Assigned Under Them
------------------------------------------------------------- */
export async function getInstructorsForTL(tlId) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*, instructor:profiles!instructor_id(*)")
    .eq("team_leader_id", tlId)
    .is("client_id", null);

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   TL → All Clients Under Their Instructors
------------------------------------------------------------- */
export async function getClientsForTL(tlId) {
  const { data, error } = await supabase
    .from("assignments")
    .select(`
      *,
      client:profiles!client_id(*)
    `)
    .eq("team_leader_id", tlId)
    .not("client_id", "is", null);

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   Instructor → Assigned Clients
------------------------------------------------------------- */
export async function getClientsForInstructor(instructorId) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*, client:profiles!client_id(*)")
    .eq("instructor_id", instructorId)
    .not("client_id", "is", null);

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   Get Instructor assigned to a specific Client
   (Used by Client Dashboard)
------------------------------------------------------------- */
export async function getMyInstructor(clientId, zone) {
  const { data, error } = await supabase
    .from("assignments")
    .select(`
      *,
      instructor:profiles!instructor_id(*)
    `)
    .eq("client_id", clientId)
    .eq("zone", zone)
    .maybeSingle();

  if (error) throw error;
  return data?.instructor || null;
}

/* -------------------------------------------------------------
   Get Students assigned to an Instructor (Instructor Dashboard)
------------------------------------------------------------- */
export async function getMyStudents(instructorId, zone) {
  const { data, error } = await supabase
    .from("assignments")
    .select(`
      *,
      client:profiles!client_id(*)
    `)
    .eq("instructor_id", instructorId)
    .eq("zone", zone);

  if (error) throw error;
  return data?.map(a => a.client) || [];
}

/* -------------------------------------------------------------
   ADMIN / MANAGER: Get all assignments in their zone
------------------------------------------------------------- */
export async function getAssignmentsForAdmin(zone) {
  const { data, error } = await supabase
    .from("assignments")
    .select(`
      *,
      instructor:profiles!instructor_id(*),
      client:profiles!client_id(*)
    `)
    .eq("zone", zone);

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   Assign instructor → TL (Admin / Manager only)
------------------------------------------------------------- */
export async function assignInstructorToTL(instructorId, tlId, zone) {
  // Check if row exists (client_id is NULL)
  const { data: exists } = await supabase
    .from("assignments")
    .select("id")
    .eq("instructor_id", instructorId)
    .is("client_id", null)
    .maybeSingle();

  if (exists) {
    const { data, error } = await supabase
      .from("assignments")
      .update({
        team_leader_id: tlId,
        zone,
      })
      .eq("id", exists.id)
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
      zone,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   Assign client → instructor
   (TL / Admin / Manager)
------------------------------------------------------------- */
export async function assignClientToInstructor(clientId, instructorId) {
  // Fetch instructor’s zone + TL
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
      .maybeSingle(),
  ]);

  if (!instr) throw new Error("Instructor not found.");

  const zone = instr.zone;
  const tlId = tlRow?.team_leader_id || null;

  // Make RLS valid: set client's zone
  await supabase.from("profiles").update({ zone }).eq("id", clientId);

  // If this client already has an assignment, update it
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
        zone,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Otherwise insert
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      client_id: clientId,
      instructor_id: instructorId,
      team_leader_id: tlId,
      zone,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   Reassign a Client (Admin / TL)
------------------------------------------------------------- */
export async function reassignClient(clientId, newInstructorId) {
  const { data, error } = await supabase.rpc("reassign_client", {
    client_id: clientId,
    new_instructor_id: newInstructorId,
  });

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------
   Remove client assignment
------------------------------------------------------------- */
export async function unassignClient(clientId) {
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("client_id", clientId);

  if (error) throw error;
  return true;
}

/* -------------------------------------------------------------
   Remove instructor → TL assignment
------------------------------------------------------------- */
export async function unassignInstructor(instructorId) {
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("instructor_id", instructorId)
    .is("client_id", null);

  if (error) throw error;
  return true;
}

/* -------------------------------------------------------------
   Realtime subscription (Admin / TL / Manager / Supervisor)
------------------------------------------------------------- */
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
