if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/service-worker.js");
      console.log("YM Mobile POS: Service Worker berhasil didaftarkan");
    } catch (error) {
      console.error("YM Mobile POS: Gagal mendaftarkan Service Worker", error);
    }
  });
}
