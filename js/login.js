// ======================================================================
// LOGIN PAGE (Magic Link OTP) — FINAL VERSION
// ======================================================================

import { supabase } from "/js/supabaseClient.js";

// Button handler
document.getElementById("loginBtn").addEventListener("click", sendLoginLink);

async function sendLoginLink() {
  const email = document.getElementById("email").value.trim();
  if (!email) return alert("Enter your email address.");

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/html/verify-otp.html`
      }
    });

    if (error) {
      console.warn(error);
      return alert(error.message || "Unable to send login link.");
    }

    alert("Check your email — the login link has been sent.");
  } catch (err) {
    console.error(err);
    alert("Network error sending login link.");
  }
}
