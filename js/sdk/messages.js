import { supabase } from "./supabaseClient.js";

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

export function subscribeMessages(callback) {
    return supabase
        .channel("messages_changes")
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            payload => callback(payload)
        )
        .subscribe();
}

/* -------------------------------------------------------
   FETCH FUNCTIONS
------------------------------------------------------- */

/**
 * Direct 1:1 chat (A ↔ B)
 */
export async function getUserThread(myId, otherUserId) {
    const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`
            and(scope.eq.user,to_user_id.eq.${otherUserId}),
            and(scope.eq.user,to_user_id.eq.${myId},sender_id.eq.${otherUserId})
        `)
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
}

/**
 * Broadcast-to-role thread (restricted to sender zone)
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
 * Broadcast-to-zone thread
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
 * Global broadcast thread
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

/* -------------------------------------------------------
   SEND MESSAGES
------------------------------------------------------- */

/**
 * Send direct message to user
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
 * Send broadcast to role (zone restricted)
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
 * Send broadcast to zone
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
 * Global broadcast
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

/* -------------------------------------------------------
   MARK AS READ
------------------------------------------------------- */

/**
 * Adds the current user to the read_by array.
 */
export async function markMessageAsRead(msgId, userId) {
    const { data, error } = await supabase
        .from("messages")
        .select("read_by")
        .eq("id", msgId)
        .single();

    if (error) throw error;

    const already = data.read_by || [];
    if (already.includes(userId)) return;

    const updated = [...already, userId];

    const { error: updErr } = await supabase
        .from("messages")
        .update({ read_by: updated })
        .eq("id", msgId);

    if (updErr) throw updErr;
}

/**
 * Marks all messages in a thread as read.
 * Accepts a list of rows returned by getUserThread / getRoleThread etc.
 */
export async function markThreadAsRead(messages, userId) {
    for (const m of messages) {
        await markMessageAsRead(m.id, userId);
    }
}
