import { supabase } from "./supabaseClient.js";
import { getMyProfile } from "./profiles.js";

/**
 * Send OTP login or signup magic link
 */
export async function sendOTP(email) {
    const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
            emailRedirectTo: window.location.origin + "/verify-otp.html"
        }
    });

    if (error) throw error;
    return data;
}

/**
 * Verify OTP using the token sent via URL params
 */
export async function verifyOTP(type, token) {
    const { data, error } = await supabase.auth.verifyOtp({
        type,           // "signup" | "magiclink" | "recovery"
        token,
        email: null     // Supabase auto-detects from session
    });

    if (error) throw error;
    return data;
}

/**
 * Post-OTP login: fetch profile and route user accordingly
 */
export async function handlePostLoginRedirect() {
    const profile = await getMyProfile();

    if (!profile) {
        console.warn("Profile missing. Redirecting to signup.");
        window.location.href = "/signup.html";
        return;
    }

    // Status rules
    if (profile.status === "pending") {
        window.location.href = "/pending.html";
        return;
    }

    if (profile.status === "suspended") {
        alert("Your account has been suspended.");
        await supabase.auth.signOut();
        return;
    }

    // Role routing
    switch (profile.role) {
        case "supervisor":
            window.location.href = "/supervisor.html";
            break;

        case "admin":
            window.location.href = "/admin.html";
            break;

        case "manager":
            window.location.href = "/manager.html";
            break;

        case "team_leader":
            window.location.href = "/team-leader.html";
            break;

        case "instructor":
            window.location.href = "/instructor.html";
            break;

        case "client":
            window.location.href = "/client.html";
            break;

        default:
            console.error("Unknown role:", profile.role);
            window.location.href = "/signup.html";
    }
}

/**
 * Logout
 */
export async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
}

/**
 * Get current authenticated user (raw)
 */
export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
}
