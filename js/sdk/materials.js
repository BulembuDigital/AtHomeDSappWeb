// /js/sdk/materials.js
// Clean, RLS-respecting material system
import { supabase } from "./supabaseClient.js";

/* ============================================================
   GET MATERIALS (RLS filters automatically)
============================================================ */

/**
 * Everyone calls this to get only the materials they’re allowed to see.
 * RLS enforces:
 *   - zone_type filter
 *   - visibility_role_scope
 *   - reviewed_by_admin
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
 * Admin-only: pending approval list
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
 * TL / Manager / Instructor / Client / Supervisor friendly:
 * Fetch by zone for dashboards that explicitly supply zone.
 */
export async function getMaterialsForZone(zone) {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("zone_type", zone)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Supervisor sees everything uploaded
 */
export async function getMaterialsGlobal() {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* ============================================================
   STORAGE HANDLING
============================================================ */

/**
 * Upload a file and return path
 */
export async function uploadMaterialFile(materialId, file) {
  const ext = file.name.split(".").pop();
  const path = `${materialId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("materials")
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type
    });

  if (error) throw error;
  return path;
}

/* ============================================================
   CREATE / UPDATE
============================================================ */

/**
 * Create a new material
 *
 * type = "file" | "link"
 * roleScope = ["client","instructor",...]
 * zoneScope = "CUT" | "UFS" | "ALL"
 */
export async function createMaterial({
  title,
  type,
  file,
  url,
  roleScope,
  zone
}) {
  // 1) Insert base row
  const { data: row, error } = await supabase
    .from("materials")
    .insert({
      title,
      type,
      visibility_role_scope: roleScope,
      zone_type: zone,
      reviewed_by_admin: false
    })
    .select()
    .single();

  if (error) throw error;

  let storage_path = null;

  // 2) Upload file or store link
  if (type === "file") {
    storage_path = await uploadMaterialFile(row.id, file);
  } else {
    storage_path = url;
  }

  // 3) Update with URL/path
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
 * Update metadata
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
 * Approve or unapprove (admin only)
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

/* ============================================================
   DELETE
============================================================ */

export async function deleteMaterial(id, storagePath) {
  // Only remove file if it’s a storage path
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

/* ============================================================
   SIGNED URL
============================================================ */

export async function getSignedMaterialURL(storagePath) {
  // If link, return directly
  if (!storagePath || storagePath.startsWith("http")) {
    return storagePath;
  }

  const { data } = await supabase.storage
    .from("materials")
    .createSignedUrl(storagePath, 3600);

  return data?.signedUrl || null;
}

/* ============================================================
   REALTIME
============================================================ */

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
