// --- Hardcoded Admin Credentials ---
const ADMIN_CREDENTIALS = {
  email: "admin@alphaprofit.com",
  password: "admin123"
};

// --- Login Form Logic ---
document.getElementById("adminLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const email = document.getElementById("adminEmail").value.trim();
  const pass = document.getElementById("adminPassword").value.trim();

  if (email === ADMIN_CREDENTIALS.email && pass === ADMIN_CREDENTIALS.password) {
    localStorage.setItem("AlphaProfit_Admin_Session", email);
    alert("✅ Welcome back, Admin! Redirecting to dashboard...");
    setTimeout(() => window.location.href = "admin.html", 1000);
  } else {
    alert("❌ Invalid credentials. Please try again.");
  }
});

// --- Forgot Password Popup ---
const popup = document.getElementById("popupOverlay");
document.getElementById("forgotPassBtn").onclick = () => popup.style.display = "flex";
document.getElementById("closePopup").onclick = () => popup.style.display = "none";

window.onclick = (e) => {
  if (e.target === popup) popup.style.display = "none";
};

// --- Password Recovery Simulation ---
document.getElementById("recoverSubmit").onclick = () => {
  const email = document.getElementById("recoverEmail").value.trim();
  if (!email) {
    alert("⚠️ Please enter your admin email.");
    return;
  }
  alert(`📧 Password reset link sent to ${email} (simulation).`);
  popup.style.display = "none";
};
