(function () {
  "use strict";


  // Twoj adres /exec z Apps Script. Ten sam wpisz w action formularza.
  var SHEET_ENDPOINT = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";


  // Language switch. Anything with data-pl and data-en gets swapped,
  // and the choice sticks in localStorage.
  var LANG_KEY = "szaromaweb-lang";
  var langButtons = document.querySelectorAll(".lang-btn");
  var translatable = document.querySelectorAll("[data-pl][data-en]");

  function setLanguage(lang) {
    translatable.forEach(function (el) {
      var value = el.getAttribute("data-" + lang);
      if (value === null) { return; }
      el.textContent = value;
    });

    document.documentElement.lang = lang;

    langButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
    });

    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private mode */ }
  }

  langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setLanguage(btn.getAttribute("data-lang"));
    });
  });

  var savedLang = "pl";
  try { savedLang = localStorage.getItem(LANG_KEY) || "pl"; } catch (e) { /* ignore */ }
  setLanguage(savedLang);


  // Nav: border on scroll, burger on small screens.
  var nav = document.getElementById("nav");
  var burger = document.querySelector(".burger");
  var navLinks = document.querySelector(".nav-links");

  window.addEventListener("scroll", function () {
    nav.classList.toggle("is-scrolled", window.scrollY > 10);
  }, { passive: true });

  if (burger && navLinks) {
    burger.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }


  // Fade sections in as they scroll into view.
  var revealables = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealables.forEach(function (el, i) {
      el.style.transitionDelay = (i % 3) * 70 + "ms";
      observer.observe(el);
    });
  } else {
    revealables.forEach(function (el) { el.classList.add("is-visible"); });
  }


  // Node network behind the hero. Skipped for reduced motion.
  var canvas = document.querySelector(".hero-canvas");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (canvas && canvas.getContext && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var nodes = [];
    var NODE_COUNT = 46;
    var LINK_DISTANCE = 150;

    function sizeCanvas() {
      var ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function buildNodes() {
      nodes = [];
      for (var i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.6 + 0.9
        });
      }
    }

    function draw() {
      var w = canvas.offsetWidth;
      var h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Links
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x;
          var dy = nodes[i].y - nodes[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DISTANCE) {
            ctx.strokeStyle = "rgba(59, 130, 246, " + (0.26 * (1 - dist / LINK_DISTANCE)) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Nodes
      nodes.forEach(function (n) {
        ctx.fillStyle = "rgba(34, 211, 238, 0.75)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) { n.vx *= -1; }
        if (n.y < 0 || n.y > h) { n.vy *= -1; }
      });

      requestAnimationFrame(draw);
    }

    sizeCanvas();
    buildNodes();
    draw();

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        sizeCanvas();
        buildNodes();
      }, 180);
    });
  }


  // Validate, then post to Apps Script via fetch so the visitor stays put.
  // Server side checks run again in the .gs file, the browser is not trusted.
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");

  var MESSAGES = {
    pl: {
      name:    "Podaj imie",
      email:   "Podaj poprawny adres email",
      message: "Napisz kilka slow o tym, czego potrzebujesz",
      sending: "Wysylanie...",
      ok:      "Dziekuje. Wiadomosc wyslana, odezwe sie wkrotce.",
      bad:     "Cos poszlo nie tak. Napisz bezposrednio na michalszaroma@gmail.com"
    },
    en: {
      name:    "Please enter your name",
      email:   "Please enter a valid email address",
      message: "Tell me briefly what you need",
      sending: "Sending...",
      ok:      "Thank you. Your message is on its way, I will be in touch shortly.",
      bad:     "Something went wrong. Please email michalszaroma@gmail.com directly"
    }
  };

  function currentMessages() {
    return MESSAGES[document.documentElement.lang] || MESSAGES.pl;
  }

  function showError(input, text) {
    var field = input.closest(".field");
    var slot = form.querySelector('[data-error="' + input.name + '"]');
    if (field) { field.classList.add("has-error"); }
    if (slot) { slot.textContent = text; }
  }

  function clearError(input) {
    var field = input.closest(".field");
    var slot = form.querySelector('[data-error="' + input.name + '"]');
    if (field) { field.classList.remove("has-error"); }
    if (slot) { slot.textContent = ""; }
  }

  function validate() {
    var msg = currentMessages();
    var ok = true;

    var name = form.querySelector("#name");
    var email = form.querySelector("#email");
    var message = form.querySelector("#message");

    [name, email, message].forEach(clearError);

    if (!name.value.trim()) { showError(name, msg.name); ok = false; }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
      showError(email, msg.email);
      ok = false;
    }

    if (message.value.trim().length < 10) { showError(message, msg.message); ok = false; }

    return ok;
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var msg = currentMessages();

      if (!validate()) { return; }

      status.textContent = msg.sending;
      status.className = "form-status";

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (response) {
          if (!response.ok) { throw new Error("Request failed"); }
          form.reset();
          status.textContent = msg.ok;
          status.className = "form-status ok";
        })
        .catch(function () {
          status.textContent = msg.bad;
          status.className = "form-status bad";
        });
    });

    form.querySelectorAll("input, textarea").forEach(function (input) {
      input.addEventListener("input", function () { clearError(input); });
    });
  }


  // Footer year.
  var year = document.getElementById("year");
  if (year) { year.textContent = new Date().getFullYear(); }


  // Reviews load from the sheet, so adding one is a spreadsheet edit
  // rather than a deploy.
  var quoteBox = document.getElementById("quotes");

  if (quoteBox && SHEET_ENDPOINT.indexOf("YOUR_DEPLOYMENT_ID") === -1) {
    fetch(SHEET_ENDPOINT)
      .then(function (response) { return response.json(); })
      .then(function (reviews) {
        if (!Array.isArray(reviews) || !reviews.length) { return; }

        reviews.forEach(function (review) {
          var block = document.createElement("blockquote");
          block.className = "quote reveal is-visible";

          var text = document.createElement("p");
          text.textContent = review.text;

          var cite = document.createElement("cite");
          cite.textContent = review.author;

          block.appendChild(text);
          block.appendChild(cite);
          quoteBox.appendChild(block);
        });
      })
      .catch(function () {
        // Sheet unreachable. Leave the section empty rather than
        // showing a broken state.
      });
  }

})();
