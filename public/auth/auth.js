/* ============================================
   NexusAI — Auth Pages Logic (Login / Register)
   ============================================ */

(function () {
  "use strict";

  var loginForm      = document.getElementById("loginForm");
  var registerForm   = document.getElementById("registerForm");
  var formError      = document.getElementById("formError");
  var btnLoader      = document.getElementById("btnLoader");
  var togglePassword = document.getElementById("togglePassword");

  if (togglePassword) {
    togglePassword.addEventListener("click", function () {
      var input = togglePassword.closest(".password-wrapper").querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
    });
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.classList.remove("hidden");
  }

  function hideError() {
    formError.classList.add("hidden");
  }

  function setLoading(btn, loading) {
    var text = btn.querySelector(".btn-auth__text");
    if (loading) {
      btn.disabled = true;
      text.textContent = "Cargando...";
      btnLoader.classList.remove("hidden");
    } else {
      btn.disabled = false;
      text.textContent = btn === document.getElementById("btnLogin") ? "Iniciar sesión" : "Crear cuenta";
      btnLoader.classList.add("hidden");
    }
  }

  function onAuthSuccess(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = "../index.html";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      hideError();

      var email = document.getElementById("email").value.trim();
      var password = document.getElementById("password").value;
      var btn = document.getElementById("btnLogin");

      if (!email || !password) {
        showError("Rellena todos los campos");
        return;
      }

      setLoading(btn, true);

      try {
        var res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password })
        });

        var data = await res.json();

        if (!data.ok) {
          showError(data.error || "Error al iniciar sesión");
          setLoading(btn, false);
          return;
        }

        onAuthSuccess(data);
      } catch (err) {
        showError("Error de conexión con el servidor");
        setLoading(btn, false);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      hideError();

      var name = document.getElementById("name").value.trim();
      var email = document.getElementById("email").value.trim();
      var password = document.getElementById("password").value;
      var confirmPassword = document.getElementById("confirmPassword").value;
      var btn = document.getElementById("btnRegister");

      if (!name || !email || !password || !confirmPassword) {
        showError("Rellena todos los campos");
        return;
      }

      if (password.length < 6) {
        showError("La contraseña debe tener al menos 6 caracteres");
        return;
      }

      if (password !== confirmPassword) {
        showError("Las contraseñas no coinciden");
        return;
      }

      setLoading(btn, true);

      try {
        var res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, email: email, password: password })
        });

        var data = await res.json();

        if (!data.ok) {
          showError(data.error || "Error al crear la cuenta");
          setLoading(btn, false);
          return;
        }

        onAuthSuccess(data);
      } catch (err) {
        showError("Error de conexión con el servidor");
        setLoading(btn, false);
      }
    });
  }

  var token = localStorage.getItem("token");
  if (token) {
    window.location.href = "../index.html";
  }

})();
