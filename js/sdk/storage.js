import { supabase } from "./supabaseClient.js";

/* -----------------------------------------------------------
   HELPERS
----------------------------------------------------------- */

function extOf(name = "") {
  return name.split(".").pop()?.toLowerCase() || "bin";
}

function safePath(id, file) {
  const e = extOf(file.name);
  return `${id}.${e}`;
}

/* -----------------------------------------------------------
   1. AVATARS (bucket: avatars)
----------------------------------------------------------- */

export async function uploadAvatar(userId, file) {
  if (!file) throw new Error("No file selected");
  if (file.size > 5 * 1024 * 1024) throw new Error("Max 5MB");

  const path = safePath(userId, file);

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type
    });

  if (error) throw error;
  return path;
}

export async function getAvatarUrl(path) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 300);

  if (error) throw error;
  return data?.signedUrl || null;
}

/* -----------------------------------------------------------
   2. MATERIALS (bucket: materials)
----------------------------------------------------------- */

export async function uploadMaterial(file, folder = "uploads") {
  if (!file) throw new Error("No file");

  const ext = extOf(file.name);
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const path = `${folder}/${unique}.${ext}`;

  const { error } = await supabase.storage
    .from("materials")
    .upload(path, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  return path;
}

export async function getMaterialUrl(path) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(path, 600);

  if (error) throw error;
  return data?.signedUrl || null;
}

export async function deleteMaterial(path) {
  if (!path) return;

  const { error } = await supabase.storage
    .from("materials")
    .remove([path]);

  if (error) throw error;
}

/* -----------------------------------------------------------
   3. GEOJSON ROUTES (bucket: routes)
----------------------------------------------------------- */

export async function uploadRouteGeoJSON(jsonObj, filename = "route.geojson") {
  const blob = new Blob([JSON.stringify(jsonObj)], {
    type: "application/geo+json"
  });

  const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const path = `${unique}_${filename}`;

  const { error } = await supabase.storage
    .from("routes")
    .upload(path, blob, {
      contentType: "application/geo+json",
      upsert: false
    });

  if (error) throw error;
  return path;
}

export async function getRouteGeoJSON(path) {
  const { data, error } = await supabase.storage
    .from("routes")
    .download(path);

  if (error) throw error;

  const text = await data.text();
  return JSON.parse(text);
}

/* -----------------------------------------------------------
   4. GENERIC STORAGE HELPERS (any bucket)
----------------------------------------------------------- */

export async function uploadFile(bucket, path, file, opts = {}) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: opts.upsert || false });

  if (error) throw error;
  return path;
}

export async function signedUrl(bucket, path, expires = 300) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expires);

  if (error) throw error;
  return data?.signedUrl || null;
}

export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) throw error;
}

/* -----------------------------------------------------------
   FUTURE-PROOFING: thumbnails, compression, video transcodes
   (these will be plugged into Storage Edge Functions later)
----------------------------------------------------------- */

export function isImage(file) {
  return file.type.startsWith("image/");
}

export function isVideo(file) {
  return file.type.startsWith("video/");
}

export function isGeoJSON(path = "") {
  return path.endsWith(".geojson") || path.endsWith(".json");
}
