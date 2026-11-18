import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import {
  createBazaar,
  getBazaar,
  getOpenBazaar,
  listBazaars,
  closeBazaar,
  listItems,
  summary,
  getBazaarInvoiceData,
  finalizeBazaar,
} from "../models/bazaar.model";

const num = (v: unknown) => {
  const value = Number(v);
  return Number.isSafeInteger(value) && value >= 0 ? value : NaN;
};

const rupiah = (value: number) =>
  `Rp ${Math.round(value).toLocaleString("id-ID")}`;

const dateFormat = (value: string | null) => {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export async function bazaarListPage(req: Request, res: Response) {
  const rows = await listBazaars(req.session!.storeId);

  res.render("bazar", {
    rows,
    current: req.session!.bazaarId || null,
    err: req.query.err ? "Data tidak valid" : null,
  });
}

export async function bazaarCreate(req: Request, res: Response) {
  const name = String(req.body.name || "")
    .trim()
    .slice(0, 60);

  const opening = num(req.body.opening_cash);

  if (!name || !Number.isFinite(opening) || opening > 100000000) {
    return res.redirect("/bazar?err=1");
  }

  const id = await createBazaar(
    req.session!.storeId,
    req.session!.staffId,
    name,
    opening,
  );

  if (!id) return res.redirect("/bazar?err=1");

  req.session!.bazaarId = id;
  res.redirect("/barang");
}

export async function bazaarSelect(req: Request, res: Response) {
  const b = await getOpenBazaar(req.session!.storeId, req.params.id);

  if (!b) return res.redirect("/bazar?err=1");

  req.session!.bazaarId = b.id;
  res.redirect("/");
}

export async function apiBazaarRecap(req: Request, res: Response) {
  const id = req.session!.bazaarId;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Tidak ada bazar aktif",
    });
  }

  const b = await getBazaar(req.session!.storeId, id);

  if (!b || b.status !== "open") {
    return res.status(404).json({
      success: false,
      message: "Bazar tidak ditemukan atau sudah ditutup",
    });
  }

  const [items, sum] = await Promise.all([listItems(id), summary(id)]);

  const totalSales = sum.reduce((total, row) => total + row.total, 0);
  const trx = sum.reduce((total, row) => total + row.trx, 0);
  const brought = items.reduce((total, item) => total + item.brought, 0);
  const sold = items.reduce((total, item) => total + item.sold, 0);
  const remaining = brought - sold;

  res.json({
    success: true,
    bazaar: {
      id: b.id,
      name: b.name,
      status: b.status,
    },
    recap: {
      openingCash: Number(b.opening_cash || 0),
      totalSales,
      trx,
      brought,
      sold,
      remaining,
    },
    items: items.map((item) => ({
      sku: item.sku,
      name: item.name,
      price: item.price,
      brought: item.brought,
      sold: item.sold,
      remaining: Number((item.brought - item.sold).toFixed(3)),
      omzet: Math.round(item.price * item.sold),
      unit: item.unit,
    })),
  });
}

export async function apiBazaarClose(req: Request, res: Response) {
  const id = req.session!.bazaarId;
  const closing = Number(req.body.closing_cash);
  const items = req.body.items;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Tidak ada bazar aktif",
    });
  }

  if (!Number.isSafeInteger(closing) || closing < 0 || closing > 1000000000) {
    return res.status(400).json({
      success: false,
      message: "Nominal uang tunai tidak valid",
    });
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Data barang terjual tidak valid",
    });
  }

  const seen = new Set<string>();

  for (const item of items) {
    if (
      !item ||
      typeof item.sku !== "string" ||
      item.sku.trim().length === 0 ||
      item.sku.length > 32 ||
      typeof item.qty !== "number" ||
      !Number.isFinite(item.qty) ||
      item.qty <= 0 ||
      item.qty > 999
    ) {
      return res.status(400).json({
        success: false,
        message: "Data barang terjual tidak valid",
      });
    }

    if (seen.has(item.sku)) {
      return res.status(400).json({
        success: false,
        message: "Terdapat SKU barang yang duplikat",
      });
    }

    seen.add(item.sku);

    if (
      item.sku === "0000000163096"
        ? Math.round(item.qty * 1000) !== item.qty * 1000
        : !Number.isInteger(item.qty)
    ) {
      return res.status(400).json({
        success: false,
        message:
          item.sku === "0000000163096"
            ? "Berat telur maksimal 3 angka desimal"
            : "Jumlah produk PCS harus bilangan bulat",
      });
    }
  }

  const bazaar = await getBazaar(req.session!.storeId, id);

  if (!bazaar || bazaar.status !== "open") {
    return res.status(404).json({
      success: false,
      message: "Bazar tidak ditemukan atau sudah ditutup",
    });
  }

  const result = await finalizeBazaar(
    id,
    req.session!.storeId,
    req.session!.staffId,
    closing,
    items,
  );

  if (req.session!.bazaarId === id) {
    req.session!.bazaarId = null;
  }

  return res.json({
    success: true,
    message: "Bazar berhasil ditutup",
    bazaar: {
      id: bazaar.id,
      name: bazaar.name,
    },
    recap: {
      totalSales: result.totalSales,
      closingCash: result.closingCash,
      diff: result.diff,
      status: result.diff === 0 ? "pas" : result.diff > 0 ? "lebih" : "kurang",
    },
    invoiceUrl: `/bazar/${id}/invoice.pdf`,
  });
}

export async function recapPage(req: Request, res: Response) {
  const id = req.params.id;
  const b = await getBazaar(req.session!.storeId, id);

  if (!b) {
    return res.status(404).render("error", {
      message: "Bazar tidak ditemukan",
    });
  }

  const isOpen = b.status === "open";

  if (isOpen && req.session!.bazaarId === id) {
    res.locals.bazaar = b;
  }

  const [items, sum] = await Promise.all([listItems(id), summary(id)]);

  const cash = sum.find((r) => r.method === "cash")?.total ?? 0;
  const totalSales = sum.reduce((total, row) => total + row.total, 0);
  const trx = sum.reduce((total, row) => total + row.trx, 0);

  const diff = b.closing_cash === null ? null : b.closing_cash - totalSales;

  const brought = items.reduce((total, item) => total + item.brought, 0);
  const sold = items.reduce((total, item) => total + item.sold, 0);

  res.render("rekap", {
    b,
    items,
    cash,
    qris: 0,
    debit: 0,
    trx,
    expected: totalSales,
    totalSales,
    diff,
    brought,
    sold,
    isOpen,
    active: "recap",
  });
}

export async function bazaarClose(req: Request, res: Response) {
  const id = req.params.id;
  const closing = num(req.body.closing_cash);

  if (!Number.isFinite(closing) || closing > 1000000000) {
    return res.redirect(`/bazar/${id}/rekap`);
  }

  const ok = await closeBazaar(req.session!.storeId, id, closing);

  if (ok && req.session!.bazaarId === id) {
    req.session!.bazaarId = null;
  }

  res.redirect(`/bazar/${id}/rekap`);
}

export async function bazaarInvoicePdf(req: Request, res: Response) {
  const id = req.params.id;

  const data = await getBazaarInvoiceData(req.session!.storeId, id);

  if (!data) {
    return res.status(404).render("error", {
      message: "Invoice tidak ditemukan atau bazar belum ditutup",
    });
  }

  const filename = `invoice-bazar-${id}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 45,
      bottom: 45,
      left: 45,
      right: 45,
    },
    bufferPages: true,
  });

  doc.pipe(res);

  const left = 45;
  const right = 550;
  const width = right - left;

  const line = (y: number) => {
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .lineWidth(0.7)
      .strokeColor("#d9dde3")
      .stroke();
  };

  const section = (title: string, y: number) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#202833")
      .text(title, left, y);
  };

  doc
    .font("Helvetica-Bold")
    .fontSize(21)
    .fillColor("#172b4d")
    .text("YOMART", left, 45);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#687386")
    .text("BAZAAR SALES INVOICE", left, 72);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#202833")
    .text("INVOICE", 420, 49, {
      width: 130,
      align: "right",
    });

  doc.font("Helvetica").fontSize(8).fillColor("#687386").text(id, 350, 66, {
    width: 200,
    align: "right",
  });

  line(94);

  section("INFORMASI BAZAAR", 111);

  const infoY = 132;

  doc.font("Helvetica").fontSize(9).fillColor("#687386");
  doc.text("Nama bazar", left, infoY);
  doc.text("Cabang", left, infoY + 21);
  doc.text("Kasir", left, infoY + 42);
  doc.text("Waktu buka", 310, infoY);
  doc.text("Waktu tutup", 310, infoY + 21);
  doc.text("Status", 310, infoY + 42);

  doc.font("Helvetica-Bold").fillColor("#202833");
  doc.text(String(data.bazaar.name), 125, infoY, { width: 165 });
  doc.text(String(data.store.name), 125, infoY + 21, { width: 165 });
  doc.text(String(data.cashier.name), 125, infoY + 42, { width: 165 });
  doc.text(dateFormat(data.bazaar.openedAt), 390, infoY, { width: 160 });
  doc.text(dateFormat(data.bazaar.closedAt), 390, infoY + 21, { width: 160 });
  doc.text("DITUTUP", 390, infoY + 42, { width: 160 });

  line(205);

  section("RINCIAN BARANG BAZAAR", 222);

  const columns = {
    no: 48,
    name: 75,
    brought: 275,
    sold: 330,
    remaining: 385,
    price: 440,
    subtotal: 490,
  };

  const drawTableHeader = (headerY: number) => {
    doc.rect(left, headerY, width, 28).fill("#f0f3f7");

    doc.font("Helvetica-Bold").fontSize(7).fillColor("#344054");
    doc.text("NO", columns.no, headerY + 9);
    doc.text("NAMA BARANG", columns.name, headerY + 9);
    doc.text("DIBAWA", columns.brought, headerY + 9, {
      width: 48,
      align: "right",
    });
    doc.text("TERJUAL", columns.sold, headerY + 9, {
      width: 48,
      align: "right",
    });
    doc.text("SISA", columns.remaining, headerY + 9, {
      width: 45,
      align: "right",
    });
    doc.text("HARGA", columns.price, headerY + 9, {
      width: 55,
      align: "right",
    });
    doc.text("SUBTOTAL", columns.subtotal, headerY + 9, {
      width: 60,
      align: "right",
    });
  };

  let y = 247;
  drawTableHeader(y);
  y += 28;

  for (const [index, item] of data.items.entries()) {
    if (y > 690) {
      doc.addPage();
      y = 55;
      drawTableHeader(y);
      y += 28;
    }

    const rowHeight = 32;

    doc.font("Helvetica").fontSize(7).fillColor("#202833");
    doc.text(String(index + 1), columns.no, y + 10);

    doc.font("Helvetica-Bold").fontSize(7).fillColor("#202833");
    doc.text(item.name, columns.name, y + 5, {
      width: 195,
      ellipsis: true,
    });

    doc.font("Helvetica").fontSize(6).fillColor("#000000");
    doc.text(`${item.sku}`, columns.name, y + 17, {
      width: 195,
      ellipsis: true,
    });

    doc.font("Helvetica").fontSize(7).fillColor("#202833");

    doc.text(`${item.brought} ${item.unit}`, columns.brought, y + 10, {
      width: 48,
      align: "right",
    });

    doc.text(`${item.quantity} ${item.unit}`, columns.sold, y + 10, {
      width: 48,
      align: "right",
    });

    doc.text(`${item.remaining} ${item.unit}`, columns.remaining, y + 10, {
      width: 45,
      align: "right",
    });

    doc.text(rupiah(item.price), columns.price, y + 10, {
      width: 55,
      align: "right",
    });

    doc.text(rupiah(item.subtotal), columns.subtotal, y + 10, {
      width: 60,
      align: "right",
    });

    line(y + rowHeight);
    y += rowHeight;
  }

  if (y > 650) {
    doc.addPage();
    y = 55;
  }

  y += 18;
  section("RINGKASAN PENJUALAN", y);

  y += 22;

  const summaryRows = [
    ["Total penjualan", rupiah(data.totalSales)],
    ["Uang pembukaan", rupiah(data.openingCash)],
    ["Uang penutupan", rupiah(data.closingCash)],
  ];

  doc.font("Helvetica").fontSize(9).fillColor("#687386");

  for (const [label, value] of summaryRows) {
    doc.text(label, left, y);
    doc.font("Helvetica-Bold").fillColor("#202833").text(value, 390, y, {
      width: 160,
      align: "right",
    });

    doc.font("Helvetica").fillColor("#687386");
    y += 20;
  }

  line(y + 2);
  y += 15;

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#172b4d")
    .text("SELISIH KAS", left, y);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(
      data.difference === 0
        ? "#16803c"
        : data.difference > 0
          ? "#16803c"
          : "#c0392b",
    )
    .text(rupiah(data.difference), 390, y, {
      width: 160,
      align: "right",
    });

  y += 23;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#202833")
    .text(`${data.differenceStatus.toUpperCase()}`, left, y);

  const pages = doc.bufferedPageRange();

  for (let page = 0; page < pages.count; page++) {
    doc.switchToPage(pages.start + page);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#98a2b3")
      .text("Yomart Mobile POS | Dokumen invoice bazaar", left, 780, {
        width,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#98a2b3")
      .text(`Halaman ${page + 1} dari ${pages.count}`, left, 794, {
        width,
        align: "center",
      });
  }

  doc.end();
}
