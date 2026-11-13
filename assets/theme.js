/* ============================================================================
   SOHRAAZ — THEME SWITCHER (single source of truth)
   ----------------------------------------------------------------------------
   Builds the floating "◐ Themes" control on every page, applies data-theme to
   <html>, persists the choice in localStorage under "sz-theme", keeps tabs in
   sync, and never re-renders or reloads the page. All colours live in
   assets/theme.css — this file only sets the attribute.
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "sz-theme";
  var DEFAULT = "royal";

  var THEMES = [
    { key: "royal",   name: "Royal Gold",      dots: ["#080604", "#d4a24c", "#f3d58a"], fd: "'Cormorant Garamond', Georgia, serif" },
    { key: "rose",    name: "Rose Gold",       dots: ["#120a0d", "#d9a08e", "#f6d3c4"], fd: "'Playfair Display', Georgia, serif" },
    { key: "emerald", name: "Emerald Royale",  dots: ["#04100b", "#d9b45a", "#1b4a30"], fd: "Cinzel, Georgia, serif" },
    { key: "ivory",   name: "Ivory Heritage",  dots: ["#faf4e6", "#9a6f1a", "#c9a24d"], fd: "'DM Serif Display', Georgia, serif" },
    { key: "maroon",  name: "Maroon Maharaja", dots: ["#140507", "#e0b04e", "#5a1a24"], fd: "'Bodoni Moda', Georgia, serif" }
  ];

  var KEYS = THEMES.map(function (t) { return t.key; });

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return KEYS.indexOf(v) !== -1 ? v : DEFAULT;
    } catch (e) {
      return DEFAULT;
    }
  }

  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function current() {
    var v = document.documentElement.getAttribute("data-theme");
    return KEYS.indexOf(v) !== -1 ? v : DEFAULT;
  }

  var btn, panel, options;

  function paint(theme, animate) {
    if (animate && !reduced() && document.documentElement.classList) {
      document.documentElement.classList.add("sz-anim");
      clearTimeout(paint._t);
      paint._t = setTimeout(function () {
        document.documentElement.classList.remove("sz-anim");
      }, 240);
    }
    document.documentElement.setAttribute("data-theme", theme);
    if (options) {
      for (var i = 0; i < options.length; i++) {
        options[i].setAttribute("aria-pressed", options[i].getAttribute("data-theme-option") === theme ? "true" : "false");
      }
    }
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function select(theme, animate) {
    paint(theme, animate);
    write(theme);
  }

  function build() {
    if (document.querySelector(".tsw")) return;

    var wrap = document.createElement("div");
    wrap.className = "tsw";

    panel = document.createElement("div");
    panel.className = "sz-tp";
    panel.id = "szThemePanel";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Choose a colour theme");
    panel.hidden = true;

    var head = document.createElement("span");
    head.className = "sz-h";
    head.textContent = "Colour theme";
    panel.appendChild(head);

    options = THEMES.map(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-theme-option", t.key);
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("title", t.name);

      var dots = document.createElement("span");
      dots.className = "dots";
      dots.setAttribute("aria-hidden", "true");
      t.dots.forEach(function (c) {
        var i = document.createElement("i");
        i.style.background = c;
        dots.appendChild(i);
      });

      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = t.name;

      var aa = document.createElement("em");
      aa.className = "aa";
      aa.style.fontFamily = t.fd;
      aa.setAttribute("aria-hidden", "true");
      aa.textContent = "Aa";

      b.appendChild(dots);
      b.appendChild(nm);
      b.appendChild(aa);
      panel.appendChild(b);
      return b;
    });

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tb";
    btn.id = "szThemeBtn";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "szThemePanel");
    btn.setAttribute("aria-haspopup", "true");
    btn.innerHTML = "<span aria-hidden=\"true\">\u25d0</span> Themes";

    wrap.appendChild(panel);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    btn.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        var active = panel.querySelector('[aria-pressed="true"]') || options[0];
        if (active) active.focus();
      }
    });

    panel.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-theme-option]") : null;
      if (!b) return;
      select(b.getAttribute("data-theme-option"), true);
      /* panel stays open on purpose */
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) {
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        btn.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (panel.hidden) return;
      if (wrap.contains(e.target)) return;
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });

    window.addEventListener("storage", function (e) {
      if (e.key !== KEY) return;
      paint(KEYS.indexOf(e.newValue) !== -1 ? e.newValue : DEFAULT, false);
    });

    /* Full-bleed surfaces (assistant panel, Watch & Buy lightbox) own the
       bottom-left corner while they are open; tuck the switcher away. */
    var chat = document.querySelector(".chat-panel");
    var syncOverlays = function () {
      var busy = (chat && chat.classList.contains("open")) || !!document.getElementById("wbStage");
      wrap.classList.toggle("is-tucked", busy);
      if (busy && !panel.hidden) {
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      }
    };
    if (window.MutationObserver) {
      var mo = new MutationObserver(syncOverlays);
      if (chat) mo.observe(chat, { attributes: true, attributeFilter: ["class"] });
      mo.observe(document.body, { childList: true, subtree: false });
      syncOverlays();
    }

    paint(current(), false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
