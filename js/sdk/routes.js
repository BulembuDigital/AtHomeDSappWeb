import { supabase } from "./supabaseClient.js";

/**
 * Fetch ALL routes for the logged-in user's zone + role permissions.
 * Supabase RLS will automatically enforce access:
 * - Instructor → sees only assigned routes
 * - Manager/Admin → sees zone routes
 * - Supervisor → sees all
 */
export async function getAllRoutes() {
    const { data, error } = await supabase
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Get a single route by ID
 */
export async function getRouteById(routeId) {
    const { data, error } = await supabase
        .from("routes")
        .select("*")
        .eq("id", routeId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Create a new route (Manager or Admin)
 * routeData must include:
 * - name
 * - zone
 * - focus_area
 * - geometry   (GeoJSON LineString)
 */
export async function createRoute(routeData) {
    const { data, error } = await supabase
        .from("routes")
        .insert(routeData)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update route — restricted to Manager/Admin/Supervisor
 */
export async function updateRoute(routeId, updateData) {
    const { data, error } = await supabase
        .from("routes")
        .update(updateData)
        .eq("id", routeId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a route — for admin/supervisor
 */
export async function deleteRoute(routeId) {
    const { error } = await supabase
        .from("routes")
        .delete()
        .eq("id", routeId);

    if (error) throw error;
    return true;
}

/**
 * Assign a route to an instructor
 * Table: route_assignments
 */
export async function assignRouteToInstructor(routeId, instructorId) {
    const { data, error } = await supabase
        .from("route_assignments")
        .upsert({
            route_id: routeId,
            instructor_id: instructorId
        }, { onConflict: "instructor_id" })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get all routes assigned to a specific instructor
 */
export async function getInstructorRoutes(instructorId) {
    const { data, error } = await supabase
        .from("route_assignments")
        .select(`
            route_id,
            routes (id, name, geometry, zone, focus_area)
        `)
        .eq("instructor_id", instructorId);

    if (error) throw error;
    return data;
}

/**
 * Subscribe to realtime route changes
 * (Supervisor dashboard or auto-refresh for instructors)
 */
export function subscribeToRoutes(callback) {
    return supabase
        .channel("routes_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "routes" },
            payload => callback(payload)
        )
        .subscribe();
}
