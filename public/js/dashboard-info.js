(function () {
  "use strict";

  var DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  var MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function init() {
    var dateElement = document.getElementById("dashboard-date");
    var timeElement = document.getElementById("dashboard-time");

    if (!dateElement || !timeElement) {
      return;
    }

    function updateClock() {
      var now = new Date();

      dateElement.textContent =
        DAYS[now.getDay()] +
        ", " +
        now.getDate() +
        " " +
        MONTHS[now.getMonth()] +
        " " +
        now.getFullYear();

      timeElement.textContent =
        pad(now.getHours()) +
        ":" +
        pad(now.getMinutes()) +
        ":" +
        pad(now.getSeconds());
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
