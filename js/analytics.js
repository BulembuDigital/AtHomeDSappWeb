import { supabase } from "./supabaseClient.js";

/* -----------------------------------------------------------
   DATE UTILITIES
----------------------------------------------------------- */

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtDay(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function dayKeysRange(startDate) {
  const ks = [];
  for (let i = 0; i < 7; i++) ks.push(fmtDay(addDays(startDate, i)));
  return ks;
}

/* -----------------------------------------------------------
   1. COUNT PENDING APPROVALS (TL, INSTRUCTORS, CLIENTS)
----------------------------------------------------------- */

export async function countPendingByRole(role, zone = null) {
  let q = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", role)
    .eq("status", "pending");

  if (zone) q = q.eq("zone", zone);

  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

export async function loadPendingApprovals(zone) {
  const [tl, ins, cli] = await Promise.all([
    countPendingByRole("team_leader", zone),
    countPendingByRole("instructor", zone),
    countPendingByRole("client", zone),
  ]);

  return {
    total: tl + ins + cli,
    tl,
    ins,
    cli
  };
}

/* -----------------------------------------------------------
   2. BOOKINGS (SCHEDULES)
----------------------------------------------------------- */

export async function loadWeeklyBookings(zone, days = 7) {
  const end = startOfDay(new Date());
  const start = addDays(end, -6);

  const startIso = start.toISOString();
  const endIso = addDays(end, 1).toISOString();

  let instrIds = null;

  if (zone) {
    const { data: ins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "instructor")
      .eq("status", "approved")
      .eq("zone", zone);

    instrIds = (ins || []).map(x => x.id);
    if (!instrIds.length) {
      return {
        dayKeys: dayKeysRange(start),
        bookingsPerDay: dayKeysRange(start).map(() => 0),
        totalBookings: 0,
        raw: []
      };
    }
  }

  let q = supabase
    .from("schedules")
    .select("id, slot_start, instructor_id")
    .eq("status", "booked")
    .gte("slot_start", startIso)
    .lt("slot_start", endIso);

  if (instrIds) q = q.in("instructor_id", instrIds);

  const { data, error } = await q;
  if (error) throw error;

  const dayKeys = dayKeysRange(start);
  const map = Object.fromEntries(dayKeys.map(k => [k, 0]));

  (data || []).forEach(ev => {
    const d = fmtDay(new Date(ev.slot_start));
    if (map[d] !== undefined) map[d]++;
  });

  return {
    dayKeys,
    bookingsPerDay: dayKeys.map(k => map[k]),
    totalBookings: data.length,
    raw: data
  };
}

/* -----------------------------------------------------------
   3. ON-TIME PERCENTAGE (client_showed_up)
----------------------------------------------------------- */

export async function loadOnTimePercent(zone, schedules) {
  if (!schedules.length) {
    return {
      dayKeys: [],
      percentages: [],
      overallPct: 0
    };
  }

  const tolMs = 10 * 60 * 1000; // 10 minutes

  const start = startOfDay(new Date(schedules[0].slot_start));
  const dayKeys = dayKeysRange(start);

  const startIso = start.toISOString();
  const endIso = addDays(start, 7).toISOString();

  let q = supabase
    .from("clock_events")
    .select("user_id, ts, type")
    .eq("type", "client_showed_up")
    .gte("ts", startIso)
    .lt("ts", endIso);

  const { data: shows } = await q;

  const showsByClient = new Map();
  (shows || []).forEach(ev => {
    const list = showsByClient.get(ev.user_id) || [];
    list.push(new Date(ev.ts).getTime());
    showsByClient.set(ev.user_id, list);
  });

  const map = Object.fromEntries(
    dayKeys.map(k => [k, { ok: 0, total: 0 }])
  );

  schedules.forEach(sch => {
    const d = fmtDay(new Date(sch.slot_start));
    if (!map[d]) return;

    map[d].total++;

    const clientId = sch.client_id;
    if (!clientId) return;

    const slotMs = new Date(sch.slot_start).getTime();
    const lst = showsByClient.get(clientId) || [];

    if (lst.some(t => Math.abs(t - slotMs) <= tolMs)) {
      map[d].ok++;
    }
  });

  const percentages = dayKeys.map(k => {
    const { ok, total } = map[k];
    return total ? Math.round((ok / total) * 100) : 0;
  });

  const tot = Object.values(map).reduce(
    (a, d) => ({ ok: a.ok + d.ok, total: a.total + d.total }),
    { ok: 0, total: 0 }
  );

  const overallPct = tot.total ? Math.round((tot.ok / tot.total) * 100) : 0;

  return {
    dayKeys,
    percentages,
    overallPct
  };
}

/* -----------------------------------------------------------
   4. ACTIVE MATERIALS (per zone)
----------------------------------------------------------- */

export async function countActiveMaterials(zone) {
  if (!zone) return 0;

  const { count, error } = await supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("reviewed_by_admin", true)
    .eq("zone_type", zone);

  if (error) throw error;
  return count || 0;
}
