(function () {
  "use strict";

  console.log("BARANG.JS AKTIF");

  const $ = (id) => document.getElementById(id);
  const EGG_SKU = "0000000163096";

  const input = $("plu");
  const form = $("add-form");
  const skuInput = $("f-sku");
  const qtyInput = $("f-qty");

  let scanner = null;
  let searchTimer = null;
  let lastSearched = "";
  let searchController = null;

  function isEgg(sku) {
    return String(sku || "").trim() === EGG_SKU;
  }

  function flash(message) {
    const el = $("msg");
    el.textContent = message;
    el.hidden = false;
  }

  function configureUnit(egg) {
    $("qty-label").textContent = egg
      ? "Tambah jumlah yang dibawa (KG)"
      : "Tambah jumlah yang dibawa (PCS)";

    $("price-label").textContent = egg
      ? "Harga jual per KG (Rp)"
      : "Harga jual per PCS (Rp)";

    qtyInput.type = "number";
    qtyInput.min = egg ? "0.001" : "1";
    qtyInput.step = egg ? "0.001" : "1";
    qtyInput.inputMode = egg ? "decimal" : "numeric";
    qtyInput.value = "1";
  }

  function parseQuantity(value) {
    const normalized = String(value || "")
      .trim()
      .replace(",", ".");

    if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
      return NaN;
    }

    return Number(normalized);
  }

  async function lookup(code) {
    code = String(code || "").trim();

    if (!code) return;

    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }

    if (code === lastSearched) return;

    lastSearched = code;

    if (searchController) {
      searchController.abort();
    }

    searchController = new AbortController();

    console.log("MENCARI PLU:", code);

    try {
      const response = await fetch(
        "/api/catalog/plu/" + encodeURIComponent(code),
        {
          credentials: "same-origin",
          signal: searchController.signal,
        },
      );

      const data = await response.json();

      console.log("HASIL API:", data);

      if (!response.ok) {
        throw new Error(data.error || "Produk tidak ditemukan");
      }

      if (!data.sku) {
        throw new Error("SKU produk kosong dari API");
      }

      const sku = String(data.sku).trim();
      const egg = isEgg(sku);

      skuInput.value = sku;

      $("f-name").textContent = data.name || "";

      $("f-price").value = Number(data.price) > 0 ? data.price : "";

      configureUnit(egg);

      form.hidden = false;
      $("msg").hidden = true;

      if (Number(data.price) > 0) {
        qtyInput.focus();
      } else {
        $("f-price").focus();
      }
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("LOOKUP ERROR:", error);

      form.hidden = true;
      skuInput.value = "";

      flash(error.message);
    }
  }

  input.addEventListener("input", function () {
    const code = input.value.trim();

    clearTimeout(searchTimer);

    if (!code) {
      lastSearched = "";
      form.hidden = true;
      skuInput.value = "";
      return;
    }

    searchTimer = setTimeout(function () {
      lookup(code);
    }, 600);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const code = input.value.trim();

    if (code) {
      lookup(code);
    }
  });

  $("btn-scan").addEventListener("click", async function () {
    const reader = $("reader");

    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (error) {
        console.error("STOP CAMERA ERROR:", error);
      }

      scanner = null;
      reader.hidden = true;
      return;
    }

    reader.hidden = false;

    scanner = new Html5Qrcode("reader");

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 120,
          },
        },
        function (code) {
          console.log("BARCODE TERDETEKSI:", code);

          if (navigator.vibrate) {
            navigator.vibrate(60);
          }

          input.value = code;
          lookup(code);
        },
      );
    } catch (error) {
      console.error("CAMERA ERROR:", error);

      scanner = null;
      reader.hidden = true;

      flash("Kamera tidak bisa dibuka. Periksa izin kamera.");
    }
  });

  form.addEventListener("submit", function (event) {
    const sku = skuInput.value.trim();
    const price = Number($("f-price").value);
    const qty = parseQuantity(qtyInput.value);
    const egg = isEgg(sku);

    console.log("SUBMIT DATA:", {
      sku,
      price,
      qty,
      unit: egg ? "KG" : "PCS",
    });

    if (!sku) {
      event.preventDefault();
      flash("SKU kosong. Scan atau input PLU terlebih dahulu.");
      return;
    }

    if (!Number.isFinite(price) || price < 1) {
      event.preventDefault();
      flash("Harga harus lebih dari 0.");
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) {
      event.preventDefault();
      flash("Jumlah tidak valid.");
      return;
    }

    if (!egg && !Number.isInteger(qty)) {
      event.preventDefault();
      flash("Jumlah produk PCS harus berupa bilangan bulat.");
      return;
    }

    qtyInput.value = String(qty);
  });

  input.focus();
})();
