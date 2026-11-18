import fs from "fs";
import path from "path";
import { db } from "../src/config/supabase";

const file = process.argv[2] || path.join(process.cwd(), "data", "barang.json");

async function chunked<T>(rows: T[], size: number, fn: (part: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

(async () => {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const list: any[] = Array.isArray(parsed) ? parsed : parsed.data;

  const nameBySku = new Map<string, string>();
  const skuByPlu = new Map<string, string>();
  let skipped = 0;

  for (const r of list) {
    const sku = String(r.sku ?? "").trim();
    const plu = String(r.plu ?? "").trim();
    const name = String(r.skudesc ?? "").trim();
    if (!sku || !plu || !name) {
      skipped++;
      continue;
    }
    if (!nameBySku.has(sku)) nameBySku.set(sku, name);
    skuByPlu.set(plu, sku);
  }
  console.log(`Baris ${list.length}, produk unik ${nameBySku.size}, PLU ${skuByPlu.size}, dilewati ${skipped}`);

  const products = [...nameBySku].map(([sku, name]) => ({ sku, name }));
  await chunked(products, 500, async (part) => {
    const { error } = await db.from("products").upsert(part, { onConflict: "sku" });
    if (error) throw new Error(error.message);
  });
  console.log("Produk tersimpan");

  const idBySku = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("products").select("id, sku").order("sku").range(from, from + 999);
    if (error) throw new Error(error.message);
    (data ?? []).forEach((p) => idBySku.set(p.sku, p.id));
    if (!data || data.length < 1000) break;
  }

  const links = [...skuByPlu]
    .filter(([, sku]) => idBySku.has(sku))
    .map(([plu, sku]) => ({ plu, product_id: idBySku.get(sku)! }));
  await chunked(links, 500, async (part) => {
    const { error } = await db.from("product_plu").upsert(part, { onConflict: "plu" });
    if (error) throw new Error(error.message);
  });
  console.log(`PLU tersimpan: ${links.length}`);
})();
