/* ============================================
   NexusAI — Phone Page Logic
   Twilio Voice SDK integration ready
   ============================================ */

(function () {
  "use strict";

  // ---------- DOM Elements ----------
  var phoneInput     = document.getElementById("phoneNumber");
  var btnConnect     = document.getElementById("btnConnect");
  var connectStatus  = document.getElementById("connectStatus");
  var dialInput      = document.getElementById("dialInput");
  var dialClear      = document.getElementById("dialClear");
  var dialpad        = document.getElementById("dialpad");
  var btnCall        = document.getElementById("btnCall");
  var btnHangup      = document.getElementById("btnHangup");
  var callPanel      = document.getElementById("callPanel");
  var callNumber     = document.getElementById("callNumber");
  var callStatus     = document.getElementById("callStatus");
  var callTimer      = document.getElementById("callTimer");
  var btnMute        = document.getElementById("btnMute");
  var btnHold        = document.getElementById("btnHold");
  var btnHangup2     = document.getElementById("btnHangup2");
  var historyList    = document.getElementById("historyList");
  var incomingCall   = document.getElementById("incomingCall");
  var incomingNumber = document.getElementById("incomingNumber");
  var btnAnswer      = document.getElementById("btnAnswer");
  var btnReject      = document.getElementById("btnReject");
  var hamburger      = document.getElementById("hamburger");
  var navLinks       = document.querySelector(".navbar__links");

  // ---------- State ----------
  var device         = null; // Twilio.Device instance
  var activeCall     = null; // Current Twilio call connection
  var timerInterval  = null;
  var callSeconds    = 0;
  var isMuted        = false;
  var isOnHold       = false;
  var isConnected    = false;
  var callHistory    = [];
  var dialString     = "";

  // ---------- Hamburger menu ----------
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
      });
    });
  }

  // ---------- Dialpad ----------
  dialpad.addEventListener("click", function (e) {
    var key = e.target.closest(".dialpad__key");
    if (!key) return;
    var value = key.dataset.value;
    dialString += value;
    dialInput.value = formatDialString(dialString);
    updateCallButton();
  });

  dialClear.addEventListener("click", function () {
    dialString = dialString.slice(0, -1);
    dialInput.value = formatDialString(dialString);
    updateCallButton();
  });

  function formatDialString(str) {
    if (!str) return "";
    if (str.length <= 3) return str;
    if (str.length <= 6) return str.slice(0, 3) + " " + str.slice(3);
    return str.slice(0, 3) + " " + str.slice(3, 6) + " " + str.slice(6);
  }

  function updateCallButton() {
    btnCall.disabled = !isConnected || dialString.length < 3;
  }

  // ---------- Connect to Twilio ----------
  btnConnect.addEventListener("click", async function () {
    var phoneNum = phoneInput.value.replace(/\s/g, "");
    if (phoneNum.length < 9) {
      alert("Introduce un número de teléfono válido");
      return;
    }

    btnConnect.disabled = true;
    btnConnect.textContent = "Conectando...";

    try {
      var response = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: "+" + phoneNum })
      });

      var data = await response.json();

      if (!data.ok || !data.token) {
        throw new Error(data.error || "No se pudo obtener el token");
      }

      initTwilioDevice(data.token);
    } catch (err) {
      console.error("Error conectando:", err);
      alert("Error al conectar: " + err.message + "\n\nAsegúrate de que las credenciales de Twilio están configuradas en el servidor.");
      btnConnect.disabled = false;
      btnConnect.textContent = "Conectar";
    }
  });

  // ---------- Twilio Device setup ----------
  function initTwilioDevice(token) {
    if (typeof Twilio === "undefined" || !Twilio.Device) {
      console.warn("Twilio SDK not loaded — running in demo mode");
      enableDemoMode();
      return;
    }

    device = new Twilio.Device(token, {
      codecPreferences: ["opus", "pcmu"],
      closeProtection: true
    });

    device.on("ready", function () {
      setConnected(true);
      console.log("Twilio Device ready");
    });

    device.on("error", function (error) {
      console.error("Twilio Device error:", error);
      setConnected(false);
    });

    device.on("incoming", function (conn) {
      activeCall = conn;
      showIncomingCall(conn.parameters.From || "Número desconocido");
    });

    device.on("disconnect", function () {
      onCallEnd("completed");
    });
  }

  // ---------- Demo mode (no Twilio keys) ----------
  function enableDemoMode() {
    console.log("Running in DEMO mode — calls are simulated");
    setConnected(true);
    btnConnect.textContent = "Conectado (Demo)";
  }

  function setConnected(connected) {
    isConnected = connected;
    connectStatus.className = "connect-status" + (connected ? " connected" : "");
    connectStatus.querySelector(".status-text").textContent =
      connected ? "Conectado" : "Desconectado";
    btnConnect.disabled = connected;
    btnConnect.textContent = connected ? "Conectado" : "Conectar";
    updateCallButton();
  }

  // ---------- Make a call ----------
  btnCall.addEventListener("click", function () {
    if (!dialString || dialString.length < 3) return;

    var numberToCall = "+" + dialString;

    if (device && typeof device.connect === "function") {
      activeCall = device.connect({ To: numberToCall });
      activeCall.on("accept", function () {
        onCallStart(numberToCall);
      });
      activeCall.on("disconnect", function () {
        onCallEnd("completed");
      });
      activeCall.on("error", function () {
        onCallEnd("failed");
      });
    } else {
      simulateCall(numberToCall);
    }

    showCallUI(numberToCall, "Llamando...");
  });

  // ---------- Hangup ----------
  function hangup() {
    if (activeCall && typeof activeCall.disconnect === "function") {
      activeCall.disconnect();
    }
    onCallEnd("completed");
  }

  btnHangup.addEventListener("click", hangup);
  btnHangup2.addEventListener("click", hangup);

  // ---------- Mute / Hold ----------
  btnMute.addEventListener("click", function () {
    isMuted = !isMuted;
    btnMute.classList.toggle("active", isMuted);
    if (activeCall && typeof activeCall.mute === "function") {
      activeCall.mute(isMuted);
    }
  });

  btnHold.addEventListener("click", function () {
    isOnHold = !isOnHold;
    btnHold.classList.toggle("active", isOnHold);
    callStatus.textContent = isOnHold ? "En espera" : "En curso";
  });

  // ---------- Incoming calls ----------
  function showIncomingCall(number) {
    incomingNumber.textContent = number;
    incomingCall.classList.remove("hidden");
  }

  btnAnswer.addEventListener("click", function () {
    incomingCall.classList.add("hidden");
    if (activeCall && typeof activeCall.accept === "function") {
      activeCall.accept();
    }
    showCallUI(incomingNumber.textContent, "En curso");
    onCallStart(incomingNumber.textContent);
  });

  btnReject.addEventListener("click", function () {
    incomingCall.classList.add("hidden");
    if (activeCall && typeof activeCall.reject === "function") {
      activeCall.reject();
    }
    addToHistory(incomingNumber.textContent, "missed", 0);
    activeCall = null;
  });

  // ---------- Call UI helpers ----------
  function showCallUI(number, status) {
    callNumber.textContent = number;
    callStatus.textContent = status;
    callTimer.textContent = "00:00";
    callPanel.classList.remove("hidden");
    btnCall.classList.add("hidden");
    btnHangup.classList.remove("hidden");
  }

  function onCallStart(number) {
    callStatus.textContent = "En curso";
    callSeconds = 0;
    timerInterval = setInterval(function () {
      callSeconds++;
      var mins = String(Math.floor(callSeconds / 60)).padStart(2, "0");
      var secs = String(callSeconds % 60).padStart(2, "0");
      callTimer.textContent = mins + ":" + secs;
    }, 1000);
  }

  function onCallEnd(status) {
    clearInterval(timerInterval);

    var number = callNumber.textContent;
    var duration = callSeconds;

    addToHistory(number, dialString ? "outgoing" : "incoming", duration);

    callPanel.classList.add("hidden");
    btnCall.classList.remove("hidden");
    btnHangup.classList.add("hidden");
    isMuted = false;
    isOnHold = false;
    btnMute.classList.remove("active");
    btnHold.classList.remove("active");
    activeCall = null;
    callSeconds = 0;
  }

  // ---------- Simulate call (demo mode) ----------
  function simulateCall(number) {
    showCallUI(number, "Llamando...");

    setTimeout(function () {
      onCallStart(number);
    }, 2000);

    activeCall = {
      disconnect: function () {
        onCallEnd("completed");
      },
      mute: function () {}
    };
  }

  // ---------- Call history ----------
  function addToHistory(number, type, duration) {
    var entry = {
      number: number,
      type: type,
      duration: duration,
      time: new Date()
    };

    callHistory.unshift(entry);
    renderHistory();
  }

  function renderHistory() {
    if (callHistory.length === 0) return;

    var html = callHistory.map(function (entry) {
      var iconClass = "history-item__icon--" + entry.type;
      var icon = entry.type === "outgoing" ? "📤"
               : entry.type === "incoming" ? "📥" : "📵";
      var typeLabel = entry.type === "outgoing" ? "Saliente"
                    : entry.type === "incoming" ? "Entrante" : "Perdida";
      var mins = String(Math.floor(entry.duration / 60)).padStart(2, "0");
      var secs = String(entry.duration % 60).padStart(2, "0");
      var timeStr = entry.time.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit"
      });

      return '<div class="history-item">'
        + '<div class="history-item__icon ' + iconClass + '">' + icon + '</div>'
        + '<div class="history-item__info">'
        + '<div class="history-item__number">' + entry.number + '</div>'
        + '<div class="history-item__meta">' + typeLabel + ' &middot; ' + timeStr + '</div>'
        + '</div>'
        + '<div class="history-item__duration">' + mins + ':' + secs + '</div>'
        + '</div>';
    }).join("");

    historyList.innerHTML = html;
  }

})();
