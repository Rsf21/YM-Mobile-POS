(function () {
  "use strict";

  var EGG_SKU = "0000000163096";
  var cart = new Map();

  var $ = function (id) {
    return document.getElementById(id);
  };

  var rp = function (n) {
    return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
  };

  var formatQty = function (n) {
    return Number(n).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  };

  var input = $("plu");
  var scanner = null;
  var lastCode = "";
  var lastAt = 0;
  var searchTimer = null;
  var currentReceiptId = null;
  var currentTotalSales = 0;
  var currentFinalItems = [];
  var isSubmitting = false;

  function isEgg(p) {
    return (
      String(p.sku) === EGG_SKU || String(p.unit || "").toUpperCase() === "KG"
    );
  }

  function getUnit(p) {
    return isEgg(p) ? "KG" : "PCS";
  }

  function parseQty(value, unit) {
    var raw = String(value).trim().replace(",", ".");

    if (unit === "KG") {
      if (!/^\d+(\.\d{1,3})?$/.test(raw)) {
        return NaN;
      }
    } else {
      if (!/^\d+$/.test(raw)) {
        return NaN;
      }
    }

    return Number(raw);
  }

  function getSold(item) {
    if (!item.valid) return 0;

    return Math.max(
      0,
      Number((item.baselineStock - item.remaining).toFixed(3)),
    );
  }

  function lineTotal(item) {
    return Math.round(item.price * getSold(item));
  }

  function total() {
    var amount = 0;

    cart.forEach(function (item) {
      amount += lineTotal(item);
    });

    return amount;
  }

  function soldCount() {
    var count = 0;

    cart.forEach(function (item) {
      if (getSold(item) > 0) {
        count++;
      }
    });

    return count;
  }

  function allValid() {
    var valid = true;

    cart.forEach(function (item) {
      if (!item.valid) {
        valid = false;
      }
    });

    return valid;
  }

  function flash(text) {
    var el = $("msg");
    if (!el) return;

    el.textContent = text;
    el.hidden = false;

    clearTimeout(flash.timer);

    flash.timer = setTimeout(function () {
      el.hidden = true;
    }, 2800);
  }

  function renderSummary() {
    $("count").textContent = soldCount();
    $("total").textContent = rp(total());

    $("btn-recap").disabled =
      cart.size === 0 || total() <= 0 || !allValid() || isSubmitting;
  }

  function updateItem(item, value, elements) {
    var remaining = parseQty(value, item.unit);
    var error = "";

    if (!Number.isFinite(remaining)) {
      error =
        item.unit === "KG"
          ? "Masukkan berat dengan maksimal 3 angka desimal."
          : "Jumlah PCS harus bilangan bulat.";
    } else if (remaining < 0) {
      error = "Sisa barang tidak boleh kurang dari 0.";
    } else if (remaining > item.baselineStock) {
      error =
        "Sisa maksimal " +
        formatQty(item.baselineStock) +
        " " +
        item.unit +
        ".";
    }

    if (error) {
      item.valid = false;
      elements.error.textContent = error;
      elements.error.hidden = false;
      elements.sold.textContent = "Jumlah terjual: -";
      elements.subtotal.textContent = rp(0);
    } else {
      item.valid = true;
      item.remaining = remaining;

      var sold = getSold(item);

      elements.error.hidden = true;
      elements.sold.textContent =
        "Terjual: " + formatQty(sold) + " " + item.unit;
      elements.subtotal.textContent = rp(lineTotal(item));
    }

    renderSummary();
  }

  function render() {
    var ul = $("cart");
    ul.innerHTML = "";

    cart.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "cart-item";

      var top = document.createElement("div");
      top.className = "row";

      var name = document.createElement("strong");
      name.textContent = item.name;

      var subtotal = document.createElement("strong");
      subtotal.textContent = rp(lineTotal(item));

      top.appendChild(name);
      top.appendChild(subtotal);

      var meta = document.createElement("div");
      meta.className = "muted small";
      meta.textContent =
        rp(item.price) +
        " / " +
        item.unit +
        " · Dibawa " +
        formatQty(item.baselineStock) +
        " " +
        item.unit;

      var bottom = document.createElement("div");
      bottom.className = "row";

      var sold = document.createElement("span");
      sold.className = "muted small";
      sold.textContent =
        "Terjual: " + formatQty(getSold(item)) + " " + item.unit;

      var inputWrap = document.createElement("div");
      inputWrap.className = "qty";

      var label = document.createElement("label");
      label.textContent = "Sisa " + item.unit;

      var remainingInput = document.createElement("input");
      remainingInput.type = "text";
      remainingInput.inputMode = item.unit === "KG" ? "decimal" : "numeric";
      remainingInput.autocomplete = "off";
      remainingInput.value = String(item.remaining).replace(".", ",");
      remainingInput.setAttribute("aria-label", "Sisa " + item.name);
      remainingInput.style.width = "100px";

      var error = document.createElement("div");
      error.className = "muted small";
      error.hidden = true;

      var inputGroup = document.createElement("div");
      inputGroup.appendChild(label);
      inputGroup.appendChild(remainingInput);
      inputGroup.appendChild(error);

      inputWrap.appendChild(inputGroup);

      bottom.appendChild(sold);
      bottom.appendChild(inputWrap);

      li.appendChild(top);
      li.appendChild(meta);
      li.appendChild(bottom);

      ul.appendChild(li);

      remainingInput.addEventListener("input", function () {
        updateItem(item, remainingInput.value, {
          sold: sold,
          subtotal: subtotal,
          error: error,
        });
      });

      li.dataset.sku = item.sku;
    });

    $("empty").hidden = cart.size > 0;

    if (cart.size === 0) {
      $("empty").textContent = "Belum ada barang yang ditambahkan ke bazar.";
    }

    renderSummary();
  }

  function get(url) {
    return fetch(url, {
      credentials: "same-origin",
    }).then(function (response) {
      if (response.status === 401) {
        location.href = "/login";
        throw new Error("auth");
      }

      return response.json().then(function (data) {
        if (!response.ok) {
          throw new Error(data.error || data.message || "Gagal mengambil data");
        }

        return data;
      });
    });
  }

  function loadCatalog() {
    $("catalog-count").textContent = "Memuat...";

    get("/api/products/catalog")
      .then(function (items) {
        cart.clear();

        var products = Array.isArray(items) ? items : [];

        products.forEach(function (p) {
          var stock = Number(p.stock);
          var price = Number(p.price);

          if (
            !p.sku ||
            !Number.isFinite(stock) ||
            stock < 0 ||
            !Number.isFinite(price) ||
            price < 0
          ) {
            return;
          }

          var unit = getUnit(p);

          cart.set(String(p.sku), {
            sku: String(p.sku),
            name: p.name,
            price: price,
            unit: unit,
            baselineStock: Number(stock.toFixed(3)),
            remaining: Number(stock.toFixed(3)),
            valid: true,
          });
        });

        $("catalog-count").textContent = cart.size + " jenis barang";

        render();
      })
      .catch(function (error) {
        if (error.message !== "auth") {
          $("catalog-count").textContent = "Gagal memuat";
          $("empty").textContent = error.message;
          $("empty").hidden = false;
        }
      });
  }

  function showRecap(data, soldItems) {
    $("recap-sheet").hidden = false;

    currentReceiptId = null;
    currentFinalItems = soldItems.map(function (item) {
      return {
        sku: item.sku,
        qty: item.qty,
      };
    });

    $("recap-error").hidden = true;
    $("close-error").hidden = true;
    $("closed-result").hidden = true;
    $("close-bazaar-section").hidden = false;

    $("btn-close-bazaar").disabled = false;
    $("btn-close-bazaar").textContent = "Tutup Bazar";

    $("recap-back").hidden = false;
    $("recap-receipt").hidden = true;
    $("recap-title").textContent = "Rekap Bazar";

    $("recap-bazaar-name").textContent = data.bazaar.name;
    $("recap-opening").textContent = rp(data.recap.openingCash);

    currentTotalSales = total();

    $("recap-total").textContent = rp(currentTotalSales);
    $("closing-total").textContent = rp(currentTotalSales);

    $("closing-cash").value = "";
    $("closing-diff").textContent = "Belum dihitung";

    var tbody = $("recap-items");
    tbody.innerHTML = "";

    soldItems.forEach(function (item) {
      var tr = document.createElement("tr");

      var name = document.createElement("td");
      name.textContent = item.name;

      var sold = document.createElement("td");
      sold.textContent = formatQty(item.qty) + " " + item.unit;

      var remaining = document.createElement("td");
      remaining.textContent = formatQty(item.remaining) + " " + item.unit;

      tr.appendChild(name);
      tr.appendChild(sold);
      tr.appendChild(remaining);

      tbody.appendChild(tr);
    });

    if (soldItems.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="center">Belum ada rincian barang.</td></tr>';
    }
  }

  function updateClosingPreview() {
    var el = $("closing-diff");
    var value = $("closing-cash").value;

    el.classList.remove("text-danger", "text-success");

    if (value === "") {
      el.textContent = "Belum dihitung";
      return;
    }

    var closing = Number(value);

    if (!Number.isSafeInteger(closing) || closing < 0 || closing > 1000000000) {
      el.textContent = "Nominal tidak valid";
      el.classList.add("text-danger");
      return;
    }

    var diff = closing - currentTotalSales;

    if (diff === 0) {
      el.textContent = "Pas";
    } else if (diff > 0) {
      el.textContent = "+ " + rp(diff);
      el.classList.add("text-success");
    } else {
      el.textContent = "- " + rp(Math.abs(diff));
      el.classList.add("text-danger");
    }
  }

  $("closing-cash").addEventListener("input", updateClosingPreview);

  $("btn-close-bazaar").onclick = function () {
    var button = $("btn-close-bazaar");
    var closing = $("closing-cash").value;

    if (closing === "") {
      $("close-error").textContent = "Masukkan jumlah uang tunai aktual.";
      $("close-error").hidden = false;
      return;
    }

    var amount = Number(closing);

    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) {
      $("close-error").textContent = "Nominal uang tunai tidak valid.";
      $("close-error").hidden = false;
      return;
    }

    if (currentFinalItems.length === 0) {
      $("close-error").textContent = "Tidak ada barang terjual untuk disimpan.";
      $("close-error").hidden = false;
      return;
    }

    if (
      !window.confirm(
        "Sudah yakin dengan hasil bazar? Bazar akan ditutup dan transaksi disimpan.",
      )
    ) {
      return;
    }

    button.disabled = true;
    button.textContent = "Memproses...";
    $("close-error").hidden = true;

    fetch("/api/bazaar/close", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        closing_cash: amount,
        items: currentFinalItems,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (response.status === 401) {
            location.href = "/login";
            throw new Error("auth");
          }

          if (!response.ok) {
            throw new Error(data.message || "Gagal menutup bazar.");
          }

          return data;
        });
      })
      .then(function (data) {
        if (!data.success) {
          throw new Error(data.message || "Gagal menutup bazar.");
        }

        currentReceiptId = data.transactionId || null;

        $("close-bazaar-section").hidden = true;
        $("closed-result").hidden = false;

        $("closed-cash").textContent = rp(data.recap.closingCash);
        $("closed-total").textContent = rp(data.recap.totalSales);

        var diff = Number(data.recap.diff) || 0;
        var diffText = "Pas";

        if (diff > 0) {
          diffText = "Lebih " + rp(diff);
        } else if (diff < 0) {
          diffText = "Kurang " + rp(Math.abs(diff));
        }

        $("closed-diff").textContent = diffText;

        $("invoice-link").href = data.invoiceUrl;
        $("invoice-link").hidden = false;

        $("recap-receipt").hidden = !currentReceiptId;
        $("recap-title").textContent = "Bazar Selesai";
        $("recap-back").hidden = true;

        button.textContent = "Bazar Ditutup";
      })
      .catch(function (error) {
        if (error.message === "auth") return;

        $("close-error").textContent = error.message;
        $("close-error").hidden = false;

        button.disabled = false;
        button.textContent = "Tutup Bazar";
      });
  };

  function byPlu(code) {
    return get("/api/products/plu/" + encodeURIComponent(code))
      .then(function (product) {
        locateProduct(product.sku);
      })
      .catch(function (error) {
        if (error.message !== "auth") {
          flash(error.message);
        }
      });
  }

  function showResults(items) {
    var ul = $("results");
    ul.innerHTML = "";

    items.forEach(function (p) {
      var li = document.createElement("li");

      var name = document.createElement("span");
      name.textContent = p.name;

      var info = document.createElement("span");
      info.className = "muted";
      info.textContent =
        rp(p.price) +
        " / " +
        getUnit(p) +
        " · Sisa " +
        formatQty(Number(p.stock) || 0) +
        " " +
        getUnit(p);

      li.appendChild(name);
      li.appendChild(info);

      li.onclick = function () {
        locateProduct(p.sku);
        ul.hidden = true;
        input.value = "";
      };

      ul.appendChild(li);
    });

    ul.hidden = items.length === 0;
  }

  function locateProduct(sku) {
    var item = cart.get(String(sku));

    if (!item) {
      flash("Barang tidak ditemukan dalam daftar bazar.");
      return;
    }

    var element = document.querySelector(
      '.cart-item[data-sku="' + CSS.escape(String(sku)) + '"]',
    );

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      var remainingInput = element.querySelector("input");

      if (remainingInput) {
        remainingInput.focus();
        remainingInput.select();
      }
    } else {
      flash("Barang tidak tersedia.");
    }
  }

  input.addEventListener("input", function () {
    clearTimeout(searchTimer);

    var value = input.value.trim();

    if (!value || /^\d+$/.test(value)) {
      $("results").hidden = true;
      return;
    }

    searchTimer = setTimeout(function () {
      get("/api/products/search?q=" + encodeURIComponent(value))
        .then(showResults)
        .catch(function () {});
    }, 250);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    var value = input.value.trim();

    if (!value) return;

    if (/^\d+$/.test(value)) {
      byPlu(value);
      input.value = "";
      $("results").hidden = true;
    }
  });

  $("btn-scan").onclick = function () {
    var box = $("reader");

    if (scanner) {
      scanner
        .stop()
        .then(function () {
          scanner.clear();
          scanner = null;
          box.hidden = true;
        })
        .catch(function () {
          scanner = null;
          box.hidden = true;
        });

      return;
    }

    if (typeof Html5Qrcode === "undefined") {
      flash("Fitur kamera belum tersedia.");
      return;
    }

    box.hidden = false;

    scanner = new Html5Qrcode("reader", {
      useBarCodeDetectorIfSupported: true,
    });

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 120,
          },
        },
        function (code) {
          var now = Date.now();

          if (code === lastCode && now - lastAt < 1500) {
            return;
          }

          lastCode = code;
          lastAt = now;

          if (navigator.vibrate) {
            navigator.vibrate(60);
          }

          byPlu(code);
        },
      )
      .catch(function () {
        box.hidden = true;
        scanner = null;

        flash(
          "Kamera tidak bisa dibuka. Pakai HTTPS dan izinkan akses kamera.",
        );
      });
  };

  function submitBazaarRecap() {
    var button = $("btn-recap");

    if (isSubmitting) return;

    if (!allValid()) {
      flash("Periksa kembali jumlah sisa barang yang belum valid.");
      return;
    }

    var amount = total();

    if (amount <= 0) {
      flash("Belum ada barang yang terjual.");
      return;
    }

    var soldItems = [];

    cart.forEach(function (item) {
      var sold = getSold(item);

      if (sold > 0) {
        soldItems.push({
          sku: item.sku,
          qty: sold,
          name: item.name,
          remaining: item.remaining,
          unit: item.unit,
        });
      }
    });

    if (soldItems.length === 0) {
      flash("Belum ada barang yang terjual.");
      return;
    }

    isSubmitting = true;
    button.disabled = true;
    button.textContent = "Memuat Rekap...";

    get("/api/bazaar/recap")
      .then(function (data) {
        if (!data.success) {
          throw new Error(data.message || "Gagal memuat rekap bazar.");
        }

        showRecap(data, soldItems);
      })
      .catch(function (error) {
        if (error.message !== "auth") {
          flash(error.message);
        }
      })
      .finally(function () {
        isSubmitting = false;
        renderSummary();
        button.textContent = "Lanjut ke Rekap";
      });
  }

  $("btn-recap").onclick = submitBazaarRecap;

  $("recap-back").onclick = function () {
    $("recap-sheet").hidden = true;

    currentReceiptId = null;
    currentFinalItems = [];

    input.focus();
  };

  $("recap-receipt").onclick = function () {
    if (!currentReceiptId) return;

    location.href = "/struk/" + encodeURIComponent(currentReceiptId);
  };

  render();
  loadCatalog();
  input.focus();
})();
