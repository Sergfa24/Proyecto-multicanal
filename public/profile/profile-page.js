/* ============================================
   NexusAI — Profile Page Logic
   ============================================ */

(function () {
  "use strict";

  var token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "../auth/login.html";
    return;
  }

  function authHeaders() {
    return { "Authorization": "Bearer " + token, "Content-Type": "application/json" };
  }

  // === DOM refs ===
  var profileAvatar    = document.getElementById("profileAvatar");
  var profileName      = document.getElementById("profileName");
  var profileEmail     = document.getElementById("profileEmail");
  var profileSince     = document.getElementById("profileSince");
  var inputName        = document.getElementById("inputName");
  var inputEmail       = document.getElementById("inputEmail");
  var btnSaveName      = document.getElementById("btnSaveName");
  var nameFeedback     = document.getElementById("nameFeedback");
  var gmailStatus      = document.getElementById("gmailStatus");
  var btnDisconnectGmail = document.getElementById("btnDisconnectGmail");
  var btnConnectGmail  = document.getElementById("btnConnectGmail");
  var btnLogout        = document.getElementById("btnLogout");
  var btnDeleteAccount = document.getElementById("btnDeleteAccount");
  var deleteModal      = document.getElementById("deleteModal");
  var btnCancelDelete  = document.getElementById("btnCancelDelete");
  var btnConfirmDelete = document.getElementById("btnConfirmDelete");
  var deleteConfirmPass = document.getElementById("deleteConfirmPass");
  var deleteFeedback   = document.getElementById("deleteFeedback");
  var hamburger        = document.getElementById("hamburger");
  var navLinks         = document.querySelector(".navbar__links");

  // === Navbar mobile ===
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () { navLinks.classList.toggle("open"); });
  }

  // === Load profile ===
  async function loadProfile() {
    try {
      var res = await fetch("/api/auth/me", { headers: authHeaders() });
      var data = await res.json();
      if (!data.ok) {
        localStorage.removeItem("token");
        window.location.href = "../auth/login.html";
        return;
      }

      var user = data.user;
      var initials = user.name
        ? user.name.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2).toUpperCase()
        : user.email[0].toUpperCase();

      profileAvatar.textContent = initials;
      profileName.textContent = user.name;
      profileEmail.textContent = user.email;
      profileSince.textContent = formatDate(user.created_at);
      inputName.value = user.name;
      inputEmail.value = user.email;

      // Gmail status
      if (user.gmailConnected) {
        gmailStatus.textContent = user.gmailEmail;
        gmailStatus.classList.remove("status--off");
        btnDisconnectGmail.style.display = "block";
        btnConnectGmail.style.display = "none";
      } else {
        gmailStatus.textContent = "No conectado";
        gmailStatus.classList.add("status--off");
        btnDisconnectGmail.style.display = "none";
        btnConnectGmail.style.display = "block";
      }
    } catch (err) {
      console.error("Error cargando perfil:", err);
    }
  }

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return dateStr || "—"; }
  }

  function showFeedback(el, msg, type) {
    el.textContent = msg;
    el.className = "profile-field__feedback " + type;
    setTimeout(function () { el.className = "profile-field__feedback hidden"; }, 4000);
  }

  // === Save name ===
  btnSaveName.addEventListener("click", async function () {
    var name = inputName.value.trim();
    if (!name) {
      showFeedback(nameFeedback, "El nombre no puede estar vacío", "error");
      return;
    }
    try {
      var res = await fetch("/api/auth/profile", {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ name: name }),
      });
      var data = await res.json();
      if (data.ok) {
        showFeedback(nameFeedback, "Nombre actualizado correctamente", "success");
        profileName.textContent = name;
        var initials = name.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2).toUpperCase();
        profileAvatar.textContent = initials;
      } else {
        showFeedback(nameFeedback, data.error, "error");
      }
    } catch (err) {
      showFeedback(nameFeedback, "Error de conexión", "error");
    }
  });

  // === Gmail connect/disconnect ===
  btnConnectGmail.addEventListener("click", async function () {
    try {
      var res = await fetch("/api/gmail/auth", { headers: authHeaders() });
      var data = await res.json();
      if (data.ok && data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Error conectando Gmail:", err);
    }
  });

  btnDisconnectGmail.addEventListener("click", async function () {
    try {
      await fetch("/api/gmail/disconnect", { method: "DELETE", headers: authHeaders() });
      gmailStatus.textContent = "No conectado";
      gmailStatus.classList.add("status--off");
      btnDisconnectGmail.style.display = "none";
      btnConnectGmail.style.display = "block";
    } catch (err) {
      console.error("Error desconectando Gmail:", err);
    }
  });

  // === Logout ===
  btnLogout.addEventListener("click", function () {
    localStorage.removeItem("token");
    window.location.href = "../index.html";
  });

  // === Delete account ===
  btnDeleteAccount.addEventListener("click", function () {
    deleteModal.classList.remove("hidden");
    deleteConfirmPass.value = "";
    deleteFeedback.className = "profile-field__feedback hidden";
  });

  btnCancelDelete.addEventListener("click", function () {
    deleteModal.classList.add("hidden");
  });

  deleteModal.addEventListener("click", function (e) {
    if (e.target === deleteModal) deleteModal.classList.add("hidden");
  });

  btnConfirmDelete.addEventListener("click", async function () {
    var pass = deleteConfirmPass.value;
    if (!pass) {
      showFeedback(deleteFeedback, "Introduce tu contraseña", "error");
      return;
    }

    btnConfirmDelete.disabled = true;
    btnConfirmDelete.textContent = "Eliminando...";

    try {
      var res = await fetch("/api/auth/delete", {
        method: "DELETE", headers: authHeaders(),
        body: JSON.stringify({ password: pass }),
      });
      var data = await res.json();
      if (data.ok) {
        localStorage.removeItem("token");
        window.location.href = "../index.html";
      } else {
        showFeedback(deleteFeedback, data.error, "error");
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.textContent = "Eliminar definitivamente";
      }
    } catch (err) {
      showFeedback(deleteFeedback, "Error de conexión", "error");
      btnConfirmDelete.disabled = false;
      btnConfirmDelete.textContent = "Eliminar definitivamente";
    }
  });

  // === Init ===
  loadProfile();
})();
