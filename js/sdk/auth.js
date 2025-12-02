import { supabase } from "./supabaseClient.js";
import { getProfileById } from "./profiles.js";

/* ---------------------------------------------------------
   SEND MAGIC LINK LOGIN
--------------------------------------------------------- */
export async function signInWithMagicLink(email) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + "/html/verify-otp.html"
      }
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ---------------------------------------------------------
   UNIVERSAL SESSION GETTER
--------------------------------------------------------- */
export async function getSession() {
  try {
    const { data } = await supabase.auth.getSession();
    return {
      userId: data?.session?.user?.id || null
    };
  } catch (err) {
    return { userId: null };
  }
}

/* ---------------------------------------------------------
   ROUTE USER BASED ON ROLE
--------------------------------------------------------- */
export function dashboardPath(role) {
  switch (role) {
    case "Supervisor": return "/html/supervisor.html";
    case "Admin": return "/html/admin.html";
    case "Manager": return "/html/manager.html";
    case "Team Leader": return "/html/team-leader.html";
    case "Instructor": return "/html/instructor.html";
    case "Client": return "/html/client.html";
    default: return "/html/login.html";
  }
}

/* ---------------------------------------------------------
   FETCH PROFILE + AUTO-REDIRECT
--------------------------------------------------------- */
export async function handlePostLoginRedirect() {
  const { userId } = await getSession();
  if (!userId) {
    window.location.href = "/html/login.html";
    return;
  }

  const profile = await getProfileById(userId);

  if (!profile) {
    window.location.href = "/html/signup.html";
    return;
  }

  // pending → waiting screen
  if (profile.status === "pending") {
    window.location.href = "/html/pending.html";
    return;
  }

  // suspended → logout + warning
  if (profile.status === "suspended") {
    alert("Your account has been suspended.");
    await supabase.auth.signOut();
    return;
  }

  // Approved → dashboard
  window.location.href = dashboardPath(profile.role);
}

/* ---------------------------------------------------------
   LOGOUT
--------------------------------------------------------- */
export async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout warning:", err);
  }

  window.location.href = "/html/login.html";
}

/* ---------------------------------------------------------
   DIRECT USER FETCH
--------------------------------------------------------- */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
