(function () {
  "use strict";

  try {
    const savedTheme = localStorage.getItem("ym-theme");

    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    const theme = savedTheme || (systemDark ? "dark" : "light");

    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
