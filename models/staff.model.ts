import { db } from "../src/config/supabase";

export async function findStaffByUsername(username: string) {
  const { data } = await db
    .from("staff")
    .select("id, name, role, store_id, password_hash, stores(name)")
    .eq("username", username)
    .eq("active", true)
    .maybeSingle();
  return data as any;
}
