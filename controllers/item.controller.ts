import { Request, Response } from "express";
import { addItem, listItems, setItem } from "../models/bazaar.model";
import { getCatalogByPlu } from "../models/product.model";

const EGG_SKU = "0000000163096";

const parsePrice = (value: unknown) => {
  const raw = String(value ?? "").trim();

  if (!/^\d+$/.test(raw)) return NaN;

  return Number(raw);
};

const parseQty = (value: unknown, sku: string) => {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");

  if (sku === EGG_SKU) {
    if (!/^\d+(\.\d{1,3})?$/.test(raw)) return NaN;
    return Number(raw);
  }

  if (!/^\d+$/.test(raw)) return NaN;

  return Number(raw);
};

export async function itemsPage(req: Request, res: Response) {
  const items = await listItems(req.session!.bazaarId);

  const note = req.query.ok
    ? "Tersimpan"
    : req.query.err
      ? "Data tidak valid"
      : null;

  res.render("barang", {
    items,
    note,
    bad: !!req.query.err,
    active: "items",
  });
}

export async function apiCatalog(req: Request, res: Response) {
  const c = await getCatalogByPlu(String(req.params.plu || "").trim());

  if (!c) {
    return res.status(404).json({
      error: "PLU tidak ditemukan di katalog",
    });
  }

  res.json({
    sku: c.sku,
    name: c.name,
    price: c.price,
    unit: c.sku === EGG_SKU ? "KG" : "PCS",
  });
}

export async function itemAdd(req: Request, res: Response) {
  const sku = String(req.body.sku || "").trim();
  const price = parsePrice(req.body.price);
  const qty = parseQty(req.body.qty, sku);

  if (
    !sku ||
    !Number.isSafeInteger(price) ||
    price < 1 ||
    price > 100000000 ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    qty > 100000 ||
    (sku !== EGG_SKU && !Number.isInteger(qty))
  ) {
    return res.redirect("/barang?err=1");
  }

  const ok = await addItem(req.session!.bazaarId, sku, price, qty);

  res.redirect(ok ? "/barang?ok=1" : "/barang?err=1");
}

export async function itemUpdate(req: Request, res: Response) {
  const sku = String(req.body.sku || "").trim();
  const price = parsePrice(req.body.price);
  const qty = parseQty(req.body.qty, sku);

  if (
    !sku ||
    !Number.isSafeInteger(price) ||
    price < 1 ||
    price > 100000000 ||
    !Number.isFinite(qty) ||
    qty < 0 ||
    qty > 100000 ||
    (sku !== EGG_SKU && !Number.isInteger(qty))
  ) {
    return res.redirect("/barang?err=1");
  }

  const ok = await setItem(req.session!.bazaarId, sku, price, qty);

  res.redirect(ok ? "/barang?ok=1" : "/barang?err=1");
}
