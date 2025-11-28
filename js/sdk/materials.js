import { supabase } from "./supabaseClient.js";

/**
 * Fetch materials visible to the logged-in user.
 * RLS handles:
 * - role_scope
 * - zone_scope (single zone_type string)
 * - approval visibility
 */
export async function getVisibleMaterials() {
    const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Fetch only materials pending admin approval
 */
export async function getPendingMaterials() {
    const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("reviewed_by_admin", false)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Upload a file to storage and return the storage path
 */
export async function uploadMaterialFile(materialId, file) {
    const ext = file.name.split(".").pop();
    const path = `${materialId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
        .from("materials")
        .upload(path, file, {
            upsert: true,
            cacheControl: "3600",
            contentType: file.type
        });

    if (upErr) throw upErr;

    return path;
}

/**
 * Create a new material (file OR link)
 */
export async function createMaterial({
    title,
    type,       // "file" or "link"
    file,
    url,
    roleScope,  // array of roles
    zoneScope   // string (CUT or UFS)
}) {
    // Insert row first to get an ID
    const { data: row, error } = await supabase
        .from("materials")
        .insert({
            title,
            type,
            visibility_role_scope: roleScope,
            zone_type: zoneScope,
            reviewed_by_admin: false
        })
        .select()
        .single();

    if (error) throw error;

    let storage_path = null;

    if (type === "file") {
        storage_path = await uploadMaterialFile(row.id, file);
    } else if (type === "link") {
        storage_path = url;
    }

    // Update with final path
    const { data: updated, error: updErr } = await supabase
        .from("materials")
        .update({ storage_path })
        .eq("id", row.id)
        .select()
        .single();

    if (updErr) throw updErr;
    return updated;
}

/**
 * Update title or scopes
 */
export async function updateMaterial(id, { title, roleScope, zoneScope }) {
    const { data, error } = await supabase
        .from("materials")
        .update({
            title,
            visibility_role_scope: roleScope,
            zone_type: zoneScope
        })
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Approve or unapprove
 */
export async function toggleApproval(id, newState) {
    const { data, error } = await supabase
        .from("materials")
        .update({
            reviewed_by_admin: newState
        })
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a material (file + DB)
 * RLS: Only admin/supervisor according to zone
 */
export async function deleteMaterial(id, storagePath) {
    // Delete file only if it's a storage path
    if (storagePath && !storagePath.startsWith("http")) {
        await supabase.storage
            .from("materials")
            .remove([storagePath]);
    }

    const { error } = await supabase
        .from("materials")
        .delete()
        .eq("id", id);

    if (error) throw error;
    return true;
}

/**
 * Generate a signed URL to view material file
 */
export async function getSignedMaterialURL(storagePath) {
    if (!storagePath || storagePath.startsWith("http")) {
        return storagePath;
    }

    const { data } = await supabase.storage
        .from("materials")
        .createSignedUrl(storagePath, 3600);

    return data?.signedUrl || null;
}

/**
 * Subscribe to realtime updates
 */
export function subscribeMaterials(callback) {
    return supabase
        .channel("materials_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "materials" },
            payload => callback(payload)
        )
        .subscribe();
}
