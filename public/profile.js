/* ============================================
   NexusAI — Profile Menu (shared across pages)
   Replaces "Acceder" with profile dropdown when logged in
   ============================================ */

(function () {
  "use strict";

  var token = localStorage.getItem("token");
  if (!token) return;

  fetch("/api/auth/me", {
    headers: { "Authorization": "Bearer " + token }
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data.ok || !data.user) {
        localStorage.removeItem("token");
        return;
      }
      buildProfileMenu(data.user);
    })
    .catch(function () {
      localStorage.removeItem("token");
    });

  function buildProfileMenu(user) {
    // Find and hide "Acceder" link
    var ctaLink = document.querySelector(".navbar__cta");
    if (ctaLink) ctaLink.style.display = "none";

    // Find navbar__links to append profile
    var navLinks = document.querySelector(".navbar__links");
    if (!navLinks) return;

    // Get initials
    var initials = user.name
      ? user.name.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2).toUpperCase()
      : user.email[0].toUpperCase();

    // Build profile HTML
    var profileLi = document.createElement("li");
    profileLi.className = "navbar__profile-wrapper";
    profileLi.innerHTML =
      '<button class="navbar__profile-btn" id="profileBtn">' +
        '<span class="navbar__profile-avatar">' + initials + '</span>' +
      '</button>' +
      '<div class="navbar__profile-dropdown hidden" id="profileDropdown">' +
        '<div class="profile-dropdown__header">' +
          '<div class="profile-dropdown__avatar">' + initials + '</div>' +
          '<div class="profile-dropdown__info">' +
            '<span class="profile-dropdown__name">' + escapeHtml(user.name) + '</span>' +
            '<span class="profile-dropdown__email">' + escapeHtml(user.email) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="profile-dropdown__divider"></div>' +
        '<div class="profile-dropdown__section">' +
          '<div class="profile-dropdown__label">Cuenta</div>' +
          '<div class="profile-dropdown__item">' +
            '<span class="profile-dropdown__icon">🆔</span>' +
            '<span>ID: ' + user.id + '</span>' +
          '</div>' +
          '<div class="profile-dropdown__item">' +
            '<span class="profile-dropdown__icon">📅</span>' +
            '<span>Miembro desde: ' + formatDate(user.created_at) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="profile-dropdown__divider"></div>' +
        '<div class="profile-dropdown__section">' +
          '<div class="profile-dropdown__label">Servicios conectados</div>' +
          '<div class="profile-dropdown__item">' +
            '<span class="profile-dropdown__icon">📧</span>' +
            '<span>Gmail: ' + (user.gmailConnected ? escapeHtml(user.gmailEmail) : '<em>No conectado</em>') + '</span>' +
          '</div>' +
          '<div class="profile-dropdown__item">' +
            '<span class="profile-dropdown__icon">📞</span>' +
            '<span>Teléfono: <em>Próximamente</em></span>' +
          '</div>' +
          '<div class="profile-dropdown__item">' +
            '<span class="profile-dropdown__icon">💬</span>' +
            '<span>WhatsApp: <em>Próximamente</em></span>' +
          '</div>' +
        '</div>' +
        '<div class="profile-dropdown__divider"></div>' +
        '<button class="profile-dropdown__logout" id="profileLogout">' +
          '<span class="profile-dropdown__icon">🚪</span> Cerrar sesión' +
        '</button>' +
      '</div>';

    navLinks.appendChild(profileLi);

    // Toggle dropdown
    var profileBtn = document.getElementById("profileBtn");
    var dropdown = document.getElementById("profileDropdown");

    profileBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", function (e) {
      if (!dropdown.contains(e.target) && e.target !== profileBtn) {
        dropdown.classList.add("hidden");
      }
    });

    // Logout
    document.getElementById("profileLogout").addEventListener("click", function () {
      localStorage.removeItem("token");
      window.location.href = (findBasePath() + "index.html");
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return dateStr || "—"; }
  }

  function findBasePath() {
    var path = window.location.pathname;
    if (path.includes("/phone/") || path.includes("/gmail/") || path.includes("/auth/")) return "../";
    return "";
  }
})();
