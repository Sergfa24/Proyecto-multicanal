/* ============================================
   NexusAI — Navbar Profile (shared across pages)
   Replaces "Acceder" with profile avatar that links to /profile/
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
      buildProfileNav(data.user);
    })
    .catch(function () {
      localStorage.removeItem("token");
    });

  function buildProfileNav(user) {
    var ctaLink = document.querySelector(".navbar__cta");
    if (ctaLink) ctaLink.style.display = "none";

    var navLinks = document.querySelector(".navbar__links");
    if (!navLinks) return;

    var initials = user.name
      ? user.name.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2).toUpperCase()
      : user.email[0].toUpperCase();

    var basePath = findBasePath();
    var profileLi = document.createElement("li");
    profileLi.className = "navbar__profile-wrapper";
    profileLi.innerHTML =
      '<a href="' + basePath + 'profile/profile.html" class="navbar__profile-btn" title="Mi perfil">' +
        '<span class="navbar__profile-avatar">' + initials + '</span>' +
        '<span class="navbar__profile-name">' + escapeHtml(user.name.split(" ")[0]) + '</span>' +
      '</a>';

    navLinks.appendChild(profileLi);
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function findBasePath() {
    var path = window.location.pathname;
    if (path.includes("/phone/") || path.includes("/gmail/") || path.includes("/auth/") || path.includes("/profile/")) return "../";
    return "";
  }
})();
