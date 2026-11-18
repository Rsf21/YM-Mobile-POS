import { db } from "../config/supabase";

export async function getAdminStats() {
  const [total, open, closed, transactions] = await Promise.all([
    db.from("bazaars").select("id", { count: "exact", head: true }),

    db
      .from("bazaars")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),

    db
      .from("bazaars")
      .select("id", { count: "exact", head: true })
      .eq("status", "closed"),

    db.from("transactions").select("id", { count: "exact", head: true }),
  ]);

  const error = total.error || open.error || closed.error || transactions.error;

  if (error) {
    throw new Error(error.message);
  }

  return {
    total: total.count ?? 0,
    open: open.count ?? 0,
    closed: closed.count ?? 0,
    transactions: transactions.count ?? 0,
  };
}

export async function listAdminBazaars() {
  const { data, error } = await db
    .from("bazaars")
    .select(
      `
      id,
      name,
      status,
      opening_cash,
      closing_cash,
      opened_at,
      closed_at,
      store_id,
      stores(name),
      staff:opened_by(name)
    `,
    )
    .order("opened_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    openingCash: Number(row.opening_cash || 0),
    closingCash: row.closing_cash === null ? null : Number(row.closing_cash),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    storeId: row.store_id,
    storeName: row.stores?.name ?? "-",
    staffName: row.staff?.name ?? "-",
  }));
}

export async function deleteClosedBazaar(id: string) {
  const { data, error } = await db.rpc("admin_delete_closed_bazaar", {
    p_bazaar: id,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data === true;
}
