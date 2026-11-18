import { db } from "../src/config/supabase";

const COLS = "id, sku, name, category, price, store_stock(qty)";

function shape(row: any) {
  const s = row.store_stock?.[0];
  return {
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: row.price,
    stock: s ? (s.qty as number) : null,
  };
}

export function candidates(code: string) {
  const list = [code];
  if (code.length === 13 && code.startsWith("0")) list.push(code.slice(1));
  if (code.length === 12) list.push("0" + code);
  return list;
}

export async function getByPlu(storeId: string, code: string) {
  const { data: link, error: linkError } = await db
    .from("product_plu")
    .select("product_id")
    .in("plu", candidates(code.trim()))
    .limit(1)
    .maybeSingle();

  if (linkError) {
    console.error("PLU lookup error:", linkError);
    return null;
  }

  if (!link) return null;

  const { data, error } = await db
    .from("products")
    .select(
      `
      id,
      sku,
      name,
      category,
      price,
      store_stock(qty)
    `,
    )
    .eq("id", link.product_id)
    .eq("active", true)
    .eq("store_stock.store_id", storeId)
    .maybeSingle();

  if (error) {
    console.error("Product lookup error:", error);
    return null;
  }

  if (!data) {
    // Ambil produk meskipun belum ada stok di cabang
    const { data: product, error: productError } = await db
      .from("products")
      .select("id, sku, name, category, price")
      .eq("id", link.product_id)
      .eq("active", true)
      .maybeSingle();

    if (productError || !product) return null;

    return {
      sku: product.sku,
      name: product.name,
      category: product.category,
      price: product.price,
      stock: 0,
    };
  }

  return shape(data);
}

function clean(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

export async function search(storeId: string, q: string) {
  const c = clean(q);
  if (!c) return [];
  const { data } = await db
    .from("products")
    .select(COLS)
    .eq("active", true)
    .eq("store_stock.store_id", storeId)
    .ilike("name", `%${c}%`)
    .order("name")
    .limit(30);
  return (data ?? []).map(shape);
}

export async function listAll(storeId: string, page: number, q: string) {
  const size = 30;
  let query = db
    .from("products")
    .select(COLS, { count: "exact" })
    .eq("store_stock.store_id", storeId)
    .order("name")
    .range((page - 1) * size, page * size - 1);
  const c = clean(q);
  if (c) query = query.or(`name.ilike.%${c}%,sku.like.${c}%`);
  const { data, count } = await query;
  return { rows: (data ?? []).map(shape), total: count ?? 0, size };
}

export async function setPrice(sku: string, price: number) {
  const { error } = await db.from("products").update({ price }).eq("sku", sku);
  return !error;
}

export async function setStock(storeId: string, sku: string, qty: number) {
  const { data: p } = await db
    .from("products")
    .select("id")
    .eq("sku", sku)
    .maybeSingle();
  if (!p) return false;
  const { error } = await db
    .from("store_stock")
    .upsert(
      { store_id: storeId, product_id: p.id, qty },
      { onConflict: "store_id,product_id" },
    );
  return !error;
}

export async function getCatalogByPlu(plu: string) {
  const code = plu.trim();

  const { data, error } = await db
    .from("product_plu")
    .select("plu, product_id")
    .eq("plu", code)
    .maybeSingle();

  console.log("PLU INPUT:", JSON.stringify(code));
  console.log("PLU RESULT:", data);
  console.log("PLU ERROR:", error);

  if (error || !data) return null;

  const { data: product, error: productError } = await db
    .from("products")
    .select("id, sku, name, price, active")
    .eq("id", data.product_id)
    .maybeSingle();

  console.log("PRODUCT RESULT:", product);
  console.log("PRODUCT ERROR:", productError);

  if (productError || !product || !product.active) return null;

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
  };
}
