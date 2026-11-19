import { Request, Response } from "express";
import { z } from "zod";
import {
  createBazaarSale,
  getSale,
  listAllTransactions,
} from "../models/sale.model";

const EGG_SKU = "0000000163096";

const body = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(32),
        qty: z.number().positive().max(999),
      }),
    )
    .min(1)
    .max(200),
});

export async function apiCheckout(req: Request, res: Response) {
  const parsed = body.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Data transaksi tidak valid",
    });
  }

  for (const item of parsed.data.items) {
    if (
      item.sku === EGG_SKU
        ? Math.round(item.qty * 1000) !== item.qty * 1000
        : !Number.isInteger(item.qty)
    ) {
      return res.status(400).json({
        error:
          item.sku === EGG_SKU
            ? "Berat telur maksimal 3 angka desimal"
            : "Jumlah produk PCS harus bilangan bulat",
      });
    }
  }

  const id = await createBazaarSale(
    req.session!.bazaarId,
    req.session!.storeId,
    req.session!.staffId,
    parsed.data.items,
  );

  return res.json({ id });
}

export async function receiptPage(req: Request, res: Response) {
  const sale = await getSale(req.session!.storeId, req.params.id);

  if (!sale) {
    return res.status(404).render("error", {
      message: "Transaksi tidak ditemukan",
    });
  }

  return res.render("receipt", {
    sale,
  });
}

export async function historyPage(req: Request, res: Response) {
  const rows = await listAllTransactions(req.session!.storeId);

  const total = rows.reduce(
    (sum, transaction) => sum + Number(transaction.total || 0),
    0,
  );

  return res.render("history", {
    rows,
    total,
  });
}
