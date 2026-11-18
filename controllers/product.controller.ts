import { Request, Response } from "express";
import { listAll, setPrice, setStock } from "../models/product.model";

export async function productPage(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const q = String(req.query.q || "");
  const data = await listAll(req.session!.storeId, page, q);
  res.render("products", { ...data, page, q, active: "products" });
}

export async function updateProduct(req: Request, res: Response) {
  const sku = String(req.body.sku || "");
  const price = Number(req.body.price);
  const stockRaw = String(req.body.stock ?? "").trim();
  if (Number.isInteger(price) && price >= 0 && price <= 100000000) await setPrice(sku, price);
  if (stockRaw !== "") {
    const qty = Number(stockRaw);
    if (Number.isInteger(qty) && qty >= 0 && qty <= 100000) await setStock(req.session!.storeId, sku, qty);
  }
  res.redirect("back");
}
