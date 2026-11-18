import { Request, Response } from "express";
import { z } from "zod";
import { createBazaarSale, getSale, listByBazaar } from "../models/sale.model";

const EGG_SKU = "0000000163096";

const body = z.object({
  method: z.literal("cash"),
  paid: z.number().int().min(0).max(100000000),
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
      error: "Pembayaran hanya menerima tunai atau data transaksi tidak valid",
    });
  }

  const { method, paid, items } = parsed.data;

  const invalidItem = items.find((item) => {
    if (item.sku === EGG_SKU) {
      return Number(item.qty.toFixed(3)) !== item.qty;
    }

    return !Number.isInteger(item.qty);
  });

  if (invalidItem) {
    return res.status(400).json({
      error:
        invalidItem.sku === EGG_SKU
          ? "Berat telur maksimal 3 angka desimal"
          : "Jumlah produk PCS harus bilangan bulat",
    });
  }

  try {
    const id = await createBazaarSale(
      req.session!.bazaarId,
      req.session!.storeId,
      req.session!.staffId,
      method,
      paid,
      items,
    );

    return res.json({ id });
  } catch (e: any) {
    console.error("CHECKOUT ERROR:", e);

    return res.status(400).json({
      error: e.message || "Transaksi gagal disimpan",
    });
  }
}

export async function receiptPage(req: Request, res: Response) {
  const sale = await getSale(req.session!.storeId, req.params.id);

  if (!sale) {
    return res.status(404).render("error", {
      message: "Transaksi tidak ditemukan",
    });
  }

  res.render("receipt", { sale });
}

export async function historyPage(req: Request, res: Response) {
  const rows = await listByBazaar(req.session!.bazaarId);

  const total = rows.reduce(
    (amount: number, row: any) => amount + Number(row.total),
    0,
  );

  res.render("history", {
    rows,
    total,
    active: "history",
  });
}
