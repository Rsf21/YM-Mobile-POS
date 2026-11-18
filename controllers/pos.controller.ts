import { Request, Response } from "express";
import {
  getBazaarItemByPlu,
  searchBazaarItems,
  listItems,
} from "../models/bazaar.model";

export function posPage(req: Request, res: Response) {
  res.render("pos", {
    active: "pos",
  });
}

export async function apiBazaarItems(req: Request, res: Response) {
  try {
    const items = await listItems(req.session!.bazaarId);

    const catalog = items.map((item: any) => {
      const brought = Number(item.brought) || 0;
      const sold = Number(item.sold) || 0;

      return {
        sku: item.sku,
        name: item.name,
        price: Number(item.price),
        unit: item.unit,
        stock: Math.max(0, Number((brought - sold).toFixed(3))),
      };
    });

    return res.json(catalog);
  } catch (error) {
    console.error("BAZAAR CATALOG ERROR:", error);

    return res.status(500).json({
      error: "Gagal mengambil daftar barang bazar",
    });
  }
}

export async function apiByPlu(req: Request, res: Response) {
  const code = String(req.params.plu || "").trim();

  const result = await getBazaarItemByPlu(req.session!.bazaarId, code);

  if (result.status === "no_catalog") {
    return res.status(404).json({
      error: "PLU tidak ditemukan di katalog",
    });
  }

  if (result.status === "not_in_bazaar") {
    return res.status(404).json({
      error: `${result.name} belum ada di daftar bazar. Tambahkan lewat tab Barang.`,
    });
  }

  return res.json(result.item);
}

export async function apiSearch(req: Request, res: Response) {
  const query = String(req.query.q || "");

  const items = await searchBazaarItems(req.session!.bazaarId, query);

  return res.json(items);
}
