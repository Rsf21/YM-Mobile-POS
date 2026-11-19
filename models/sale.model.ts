import { db } from "../src/config/supabase";

export type CartItem = {
  sku: string;
  qty: number;
};

export async function createBazaarSale(
  bazaarId: string,
  storeId: string,
  staffId: string,
  items: CartItem[],
): Promise<string> {
  const { data, error } = await db.rpc("create_bazaar_sale", {
    p_bazaar: bazaarId,
    p_store: storeId,
    p_staff: staffId,
    p_items: items,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("ID transaksi tidak diterima dari database");
  }

  return data as string;
}

export async function getSale(storeId: string, id: string) {
  const { data, error } = await db
    .from("transactions")
    .select(
      `
      *,
      stores(name),
      staff(name),
      transaction_items(
        sku,
        name,
        price,
        qty,
        subtotal
      )
    `,
    )
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as any;
}

export async function listAllTransactions() {
  const { data, error } = await db
    .from("transactions")
    .select(
      `
      id,
      invoice_no,
      total,
      method,
      created_at,
      bazaars(name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
