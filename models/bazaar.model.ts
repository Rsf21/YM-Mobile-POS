import { db } from "../src/config/supabase";
import { getCatalogByPlu } from "./product.model";

const EGG_SKU = "0000000163096";

const getUnit = (sku: string) => (sku === EGG_SKU ? "KG" : "PCS");

const normalizeQty = (value: unknown) => Number(Number(value ?? 0).toFixed(3));

export async function createBazaar(
  storeId: string,
  staffId: string,
  name: string,
  openingCash: number,
) {
  const { data, error } = await db
    .from("bazaars")
    .insert({
      store_id: storeId,
      opened_by: staffId,
      name,
      opening_cash: openingCash,
    })
    .select("id")
    .single();

  return error || !data ? null : (data.id as string);
}

export async function listBazaars(storeId: string) {
  const { data } = await db
    .from("bazaars")
    .select("id, name, status, opening_cash, opened_at")
    .eq("store_id", storeId)
    .order("opened_at", { ascending: false })
    .limit(30);

  return data ?? [];
}

export async function getBazaar(storeId: string, id: string) {
  const { data } = await db
    .from("bazaars")
    .select("*")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();

  return data as any;
}

export async function getOpenBazaar(storeId: string, id: string) {
  const { data } = await db
    .from("bazaars")
    .select("*")
    .eq("id", id)
    .eq("store_id", storeId)
    .eq("status", "open")
    .maybeSingle();

  return data as any;
}

export async function closeBazaar(
  storeId: string,
  id: string,
  closingCash: number,
) {
  const { data } = await db
    .from("bazaars")
    .update({
      status: "closed",
      closing_cash: closingCash,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("store_id", storeId)
    .eq("status", "open")
    .select("id");

  return (data ?? []).length > 0;
}

export async function listItems(bazaarId: string) {
  const { data, error } = await db
    .from("bazaar_items")
    .select("price, qty_brought, qty_sold, products(sku, name)")
    .eq("bazaar_id", bazaarId)
    .limit(1000);

  if (error) {
    console.error("LIST BAZAAR ITEMS ERROR:", error);
    return [];
  }

  return ((data ?? []) as any[])
    .map((r) => {
      const sku = String(r.products.sku);

      return {
        sku,
        name: r.products.name as string,
        price: Number(r.price),
        brought: normalizeQty(r.qty_brought),
        sold: normalizeQty(r.qty_sold),
        unit: getUnit(sku),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function addItem(
  bazaarId: string,
  sku: string,
  price: number,
  qty: number,
) {
  const { data: p, error: productError } = await db
    .from("products")
    .select("id, sku")
    .eq("sku", sku)
    .maybeSingle();

  if (productError) {
    console.error("PRODUCT LOOKUP ERROR:", productError);
    return false;
  }

  if (!p) {
    console.error("PRODUCT NOT FOUND:", sku);
    return false;
  }

  const isEgg = p.sku === EGG_SKU;

  if (!Number.isFinite(qty) || qty <= 0) return false;
  if (!isEgg && !Number.isInteger(qty)) return false;

  const { data: cur, error: currentError } = await db
    .from("bazaar_items")
    .select("qty_brought")
    .eq("bazaar_id", bazaarId)
    .eq("product_id", p.id)
    .maybeSingle();

  if (currentError) {
    console.error("BAZAAR ITEM LOOKUP ERROR:", currentError);
    return false;
  }

  const nextQty = normalizeQty(Number(cur?.qty_brought ?? 0) + qty);

  const { error } = await db.from("bazaar_items").upsert(
    {
      bazaar_id: bazaarId,
      product_id: p.id,
      price,
      qty_brought: nextQty,
    },
    { onConflict: "bazaar_id,product_id" },
  );

  if (error) {
    console.error("BAZAAR UPSERT ERROR:", error);
    return false;
  }

  return true;
}

export async function setItem(
  bazaarId: string,
  sku: string,
  price: number,
  qty: number,
) {
  const { data: p, error: productError } = await db
    .from("products")
    .select("id, sku")
    .eq("sku", sku)
    .maybeSingle();

  if (productError || !p) return false;

  const isEgg = p.sku === EGG_SKU;

  if (!Number.isFinite(qty) || qty < 0) return false;
  if (!isEgg && !Number.isInteger(qty)) return false;

  const { data: cur, error: currentError } = await db
    .from("bazaar_items")
    .select("qty_sold")
    .eq("bazaar_id", bazaarId)
    .eq("product_id", p.id)
    .maybeSingle();

  if (currentError || !cur) return false;

  const nextQty = normalizeQty(Math.max(qty, Number(cur.qty_sold)));

  const { error } = await db
    .from("bazaar_items")
    .update({
      price,
      qty_brought: nextQty,
    })
    .eq("bazaar_id", bazaarId)
    .eq("product_id", p.id);

  if (error) {
    console.error("UPDATE BAZAAR ITEM ERROR:", error);
    return false;
  }

  return true;
}

export async function getBazaarItemByPlu(bazaarId: string, code: string) {
  const cat = await getCatalogByPlu(code);

  if (!cat) {
    return { status: "no_catalog" as const };
  }

  const { data, error } = await db
    .from("bazaar_items")
    .select("price, qty_brought, qty_sold")
    .eq("bazaar_id", bazaarId)
    .eq("product_id", cat.id)
    .maybeSingle();

  if (error) {
    console.error("BAZAAR ITEM LOOKUP ERROR:", error);
    return { status: "no_catalog" as const };
  }

  if (!data) {
    return {
      status: "not_in_bazaar" as const,
      name: cat.name,
    };
  }

  return {
    status: "ok" as const,
    item: {
      sku: cat.sku,
      name: cat.name,
      price: Number(data.price),
      stock: normalizeQty(Number(data.qty_brought) - Number(data.qty_sold)),
      unit: getUnit(cat.sku),
    },
  };
}

export async function searchBazaarItems(bazaarId: string, q: string) {
  const c = q.replace(/[,()%*\\]/g, " ").trim();

  if (!c) return [];

  const { data, error } = await db
    .from("bazaar_items")
    .select("price, qty_brought, qty_sold, products!inner(sku, name)")
    .eq("bazaar_id", bazaarId)
    .ilike("products.name", `%${c}%`)
    .limit(30);

  if (error) {
    console.error("SEARCH BAZAAR ITEMS ERROR:", error);
    return [];
  }

  return ((data ?? []) as any[]).map((r) => {
    const sku = String(r.products.sku);

    return {
      sku,
      name: r.products.name,
      price: Number(r.price),
      stock: normalizeQty(Number(r.qty_brought) - Number(r.qty_sold)),
      unit: getUnit(sku),
    };
  });
}

export async function summary(bazaarId: string) {
  const { data } = await db.rpc("bazaar_summary", {
    p_bazaar: bazaarId,
  });

  return (
    (data ?? []) as {
      method: string;
      trx: number;
      total: number;
    }[]
  ).map((r) => ({
    method: r.method,
    trx: Number(r.trx),
    total: Number(r.total),
  }));
}

export async function getBazaarInvoiceData(storeId: string, bazaarId: string) {
  const bazaar = await getBazaar(storeId, bazaarId);

  if (!bazaar || bazaar.status !== "closed" || bazaar.closing_cash === null) {
    return null;
  }

  const [storeResult, staffResult, items, payments] = await Promise.all([
    db.from("stores").select("name").eq("id", storeId).maybeSingle(),

    db
      .from("staff")
      .select("name")
      .eq("id", bazaar.opened_by)
      .eq("store_id", storeId)
      .maybeSingle(),

    listItems(bazaarId),
    summary(bazaarId),
  ]);

  if (storeResult.error) {
    console.error("INVOICE STORE ERROR:", storeResult.error);
  }

  if (staffResult.error) {
    console.error("INVOICE STAFF ERROR:", staffResult.error);
  }

  const totalSales = payments.reduce((total, row) => total + row.total, 0);

  const closingCash = Number(bazaar.closing_cash);
  const openingCash = Number(bazaar.opening_cash || 0);
  const difference = closingCash - totalSales;

  return {
    bazaar: {
      id: bazaar.id,
      name: bazaar.name,
      status: bazaar.status,
      openedAt: bazaar.opened_at,
      closedAt: bazaar.closed_at,
    },
    store: {
      name: storeResult.data?.name || "Yomart",
    },
    cashier: {
      name: staffResult.data?.name || "Kasir",
    },
    openingCash,
    closingCash,
    totalSales,
    difference,
    differenceStatus:
      difference === 0 ? "pas" : difference > 0 ? "lebih" : "kurang",
    transactionCount: payments.reduce((total, row) => total + row.trx, 0),
    items: items.map((item) => ({
      sku: item.sku,
      name: item.name,
      price: item.price,
      brought: item.brought,
      quantity: item.sold,
      remaining: Number((item.brought - item.sold).toFixed(3)),
      unit: item.unit,
      subtotal: Math.round(item.price * item.sold),
    })),
  };
}
