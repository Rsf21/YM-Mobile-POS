import bcrypt from "bcryptjs";
import { db } from "../src/config/supabase";

const [username, newPassword] = process.argv.slice(2);

if (!username || !newPassword) {
  console.error('Pakai: npm run admin:reset -- username "password-baru"');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error("Password minimal 8 karakter");
  process.exit(1);
}

(async () => {
  const { data: staff, error: findError } = await db
    .from("staff")
    .select("id, username, name, role")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (findError) {
    console.error(findError.message);
    process.exit(1);
  }

  if (!staff) {
    console.error("Username tidak ditemukan");
    process.exit(1);
  }

  if (staff.role !== "admin") {
    console.error("Akun tersebut bukan admin. Password tidak diubah.");
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(newPassword, 12);

  const { error: updateError } = await db
    .from("staff")
    .update({ password_hash })
    .eq("id", staff.id);

  if (updateError) {
    console.error(updateError.message);
    process.exit(1);
  }

  console.log("Password admin berhasil direset.");
  console.log("Username:", staff.username);
  console.log("Nama:", staff.name);
})();
