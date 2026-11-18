import bcrypt from "bcryptjs";
import { db } from "../src/config/supabase";

const [storeName, username, name, password, role = "kasir"] = process.argv.slice(2);

if (!storeName || !username || !name || !password) {
  console.error('Pakai: npm run staff:create -- "Rambay" budi "Budi Santoso" passwordnya kasir|admin');
  process.exit(1);
}

(async () => {
  const { data: store } = await db.from("stores").select("id").eq("name", storeName).maybeSingle();
  if (!store) {
    console.error("Toko tidak ditemukan");
    process.exit(1);
  }
  const password_hash = await bcrypt.hash(password, 12);
  const { error } = await db
    .from("staff")
    .insert({ store_id: store.id, username: username.toLowerCase(), name, password_hash, role });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log("Akun dibuat:", username);
})();
