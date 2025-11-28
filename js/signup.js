import { getSession } from "./sdk/auth.js";
import { updateProfile, getProfileById } from "./sdk/profiles.js";

(async function setup() {
  const { userId } = await getSession();
  if (!userId) location.href = "/html/login.html";

  const profile = await getProfileById(userId);
  if (profile?.status === "approved") {
    return location.href = dashboardPath(profile.role);
  }
})();

document.getElementById("save").addEventListener("click", async () => {
  try {
    const name = document.getElementById("name").value.trim();
    const role = document.getElementById("role").value;
    const phone = document.getElementById("phone").value.trim();
    const zone = document.getElementById("zone")?.value || null;

    if (!name || !role) return alert("Fill all required fields");

    await updateProfile({
      name,
      phone,
      role,
      zone,
      status: "pending"
    });

    alert("Profile submitted. Await approval.");
    location.href = "/html/pending.html";
  } catch (err) {
    alert(err.message);
  }
});
