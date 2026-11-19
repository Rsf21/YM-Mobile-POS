"use strict";

(function () {
  try {
    const savedTheme = localStorage.getItem("ym-theme");
    const theme = savedTheme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
