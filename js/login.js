import { signInWithOtp, getSession } from "./sdk/auth.js";
import { getProfileById } from "./sdk/profiles.js";
import { dashboardPath } from "./sdk/supabaseClient.js";

const emailInput = document.getElementById("email");
const sendBtn = document.getElementById("sendOtp");
const verifyBtn = document.getElementById("verifyOtp");
const otpInput = document.getElementById("otp");

// STEP 1 — Send OTP
sendBtn.addEventListener("click", async () => {
  try {
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return alert("Enter your email");

    await signInWithOtp(email);
    alert("OTP sent. Check inbox.");
  } catch (err) {
    alert(err.message);
  }
});

// STEP 2 — Verify OTP
verifyBtn.addEventListener("click", async () => {
  try {
    const code = otpInput.value.trim();
    if (!code) return alert("Enter OTP");

    const { session, userId } = await getSession();

    if (!userId) return alert("Invalid OTP");

    const profile = await getProfileById(userId);
    if (!profile) {
      return location.href = "/html/signup-finish.html";
    }

    location.href = dashboardPath(profile.role);
  } catch (err) {
    alert(err.message);
  }
});
