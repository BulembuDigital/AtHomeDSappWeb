// /js/sdk/messages.js
// Unified messaging system — RLS handles filtering per role/zone.

import { supabase } from "./supabaseClient.js";

/* ============================================================
   REALTIME
============================================================ */

/**
 * Realtime subscription for messages the user is allowed to see.
 * RLS ensures they only receive:
 *   - their own DMs
 *   - broadcasts to their role/zone
 *   - zone broadcasts (matching)
 *   - global broadcasts
 */
export function subscribeMessages(callback) {
  return supabase
    .channel("messages_changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => callback(payload.new || payload)
    )
    .subscribe();
}

/* ============================================================
   FETCH FUNCTIONS
============================================================ */

/**
 * Fetch direct 1:1 conversation (A ↔ B)
 */
export async function getUserThread(myId, otherUserId) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`
      and(scope.eq.user,to_user_id.eq.${otherUserId},sender_id.eq.${myId}),
      and(scope.eq.user,to_user_id.eq.${myId},sender_id.eq.${otherUserId})
    `)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Fetch messages for role broadcast inside a zone
 */
export async function getRoleThread(role, zone) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("scope", "role")
    .eq("to_role", role)
    .eq("to_zone", zone)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Fetch zone-wide broadcast thread
 */
export async function getZoneThread(zone) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("scope", "zone")
    .eq("to_zone", zone)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Fetch global broadcast thread (Supervisor/global announcements)
 */
export async function getAllThread() {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("scope", "all")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/* ============================================================
   SEND FUNCTIONS
============================================================ */

/**
 * Send a direct private message (1:1)
 */
export async function sendUserMessage(myId, toUserId, body) {
  const { error } = await supabase
    .from("messages")
    .insert({
      sender_id: myId,
      scope: "user",
      to_user_id: toUserId,
      to_role: null,
      to_zone: null,
      body,
      read_by: []
    });

  if (error) throw error;
}

/**
 * Send a message to a role (zone-limited)
 */
export async function sendRoleMessage(myId, role, zone, body) {
  const { error } = await supabase
    .from("messages")
    .insert({
      sender_id: myId,
      scope: "role",
      to_role: role,
      to_zone: zone,
      to_user_id: null,
      body,
      read_by: []
    });

  if (error) throw error;
}

/**
 * Zone broadcast (TL, Manager, Admin, Supervisor)
 */
export async function sendZoneMessage(myId, zone, body) {
  const { error } = await supabase
    .from("messages")
    .insert({
      sender_id: myId,
      scope: "zone",
      to_zone: zone,
      to_role: null,
      to_user_id: null,
      body,
      read_by: []
    });

  if (error) throw error;
}

/**
 * Global broadcast (Supervisor only)
 */
export async function sendAllMessage(myId, body) {
  const { error } = await supabase
    .from("messages")
    .insert({
      sender_id: myId,
      scope: "all",
      to_zone: null,
      to_role: null,
      to_user_id: null,
      body,
      read_by: []
    });

  if (error) throw error;
}

/* ============================================================
   READ MARKERS
============================================================ */

/**
 * Mark a single message as read
 */
export async function markMessageAsRead(msgId, userId) {
  const { data, error } = await supabase
    .from("messages")
    .select("read_by")
    .eq("id", msgId)
    .single();

  if (error) throw error;

  const list = data.read_by || [];
  if (list.includes(userId)) return;

  const updated = [...list, userId];

  const { error: updErr } = await supabase
    .from("messages")
    .update({ read_by: updated })
    .eq("id", msgId);

  if (updErr) throw updErr;
}

/**
 * Mark all messages in a thread as read
 */
export async function markThreadAsRead(messages, userId) {
  for (const msg of messages) {
    await markMessageAsRead(msg.id, userId);
  }
}
