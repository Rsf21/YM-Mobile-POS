(function () {
  "use strict";

  const root = document.documentElement;

  const menu = document.getElementById("side-menu");
  const backdrop = document.getElementById("menu-backdrop");

  const openButton = document.getElementById("menu-toggle");
  const closeButton = document.getElementById("menu-close");
  const themeButton = document.getElementById("theme-toggle");

  function openMenu() {
    if (!menu || !backdrop) return;

    menu.classList.add("open");
    backdrop.hidden = false;

    document.body.classList.add("menu-open");

    menu.setAttribute("aria-hidden", "false");

    if (openButton) {
      openButton.setAttribute("aria-expanded", "true");
    }
  }

  function closeMenu() {
    if (!menu || !backdrop) return;

    menu.classList.remove("open");
    backdrop.hidden = true;

    document.body.classList.remove("menu-open");

    menu.setAttribute("aria-hidden", "true");

    if (openButton) {
      openButton.setAttribute("aria-expanded", "false");
    }
  }

  if (openButton) {
    openButton.addEventListener("click", openMenu);
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeMenu);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeMenu);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  if (menu) {
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
  }

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

      root.dataset.theme = nextTheme;

      try {
        localStorage.setItem("ym-theme", nextTheme);
      } catch (error) {
        console.warn("Tema tidak dapat disimpan:", error);
      }
    });
  }
})();
