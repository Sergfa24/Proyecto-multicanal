/* ============================================
   NexusAI — Landing Page Scripts
   Carousel auto-rotation + hamburger menu
   ============================================ */

(function () {
  "use strict";

  // ---------- Carousel ----------
  const slides = document.querySelectorAll(".carousel__slide");
  const indicators = document.querySelectorAll(".indicator");
  let current = 0;
  let intervalId = null;

  function goToSlide(index) {
    slides[current].classList.remove("active");
    indicators[current].classList.remove("active");

    current = index;

    slides[current].classList.add("active");
    indicators[current].classList.add("active");
  }

  function nextSlide() {
    goToSlide((current + 1) % slides.length);
  }

  function startAutoplay() {
    intervalId = setInterval(nextSlide, 3000);
  }

  function resetAutoplay() {
    clearInterval(intervalId);
    startAutoplay();
  }

  indicators.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var idx = parseInt(btn.dataset.index, 10);
      if (idx !== current) {
        goToSlide(idx);
        resetAutoplay();
      }
    });
  });

  startAutoplay();

  // ---------- Hamburger menu ----------
  var hamburger = document.getElementById("hamburger");
  var navLinks = document.querySelector(".navbar__links");

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
})();
