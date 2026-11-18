import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { db } from "../src/config/supabase";

type Store = {
  id: string;
  name: string;
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const existingAccounts = [
  { username: "rambay", storeName: "Rambay" },
  { username: "cisaat1", storeName: "Cisaat 1" },
  { username: "cisaat3", storeName: "Cisaat 3" },
  { username: "bojongsampora", storeName: "Bojong Sampora" },
  { username: "lingkarselatan", storeName: "Lingkar Selatan" },
];

const newAccount = {
  username: "cisaat2",
  name: "Kasir Cisaat 2",
  storeName: "Cisaat 2",
};

async function ask(question: string): Promise<string> {
  return rl.question(question);
}

async function getPassword(label: string): Promise<string> {
  while (true) {
    const password = await ask(`${label} - Password baru: `);

    if (password.length < 6) {
      console.log("Password minimal 6 karakter. Coba lagi.\n");
      continue;
    }

    const confirmation = await ask("Ulangi password: ");

    if (password !== confirmation) {
      console.log("Password tidak cocok. Coba lagi.\n");
      continue;
    }

    return password;
  }
}

async function main() {
  console.log("\n======================================");
  console.log("   PENGELOLAAN AKUN YM MOBILE POS");
  console.log("======================================\n");

  const { data: stores, error: storeError } = await db
    .from("stores")
    .select("id, name");

  if (storeError) {
    throw new Error(storeError.message);
  }

  const storeMap = new Map(
    (stores as Store[]).map((store) => [store.name, store]),
  );

  const requiredStores = [
    ...existingAccounts.map((account) => account.storeName),
    newAccount.storeName,
  ];

  for (const name of requiredStores) {
    if (!storeMap.has(name)) {
      throw new Error(`Toko ${name} tidak ditemukan.`);
    }
  }

  const verifiedAccounts: Array<{
    id: string;
    username: string;
    storeName: string;
  }> = [];

  console.log("Memeriksa lima akun kasir yang sudah ada...\n");

  for (const account of existingAccounts) {
    const store = storeMap.get(account.storeName)!;

    const { data, error } = await db
      .from("staff")
      .select("id, username, role, store_id")
      .eq("username", account.username)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error(`Akun ${account.username} tidak ditemukan.`);
    }

    if (data.role !== "kasir" || data.store_id !== store.id) {
      throw new Error(
        `Pemetaan akun ${account.username} tidak sesuai dengan toko ${account.storeName}.`,
      );
    }

    verifiedAccounts.push({
      id: data.id,
      username: data.username,
      storeName: account.storeName,
    });

    console.log(`OK: ${account.storeName} (${account.username})`);
  }

  const cisaat2Store = storeMap.get(newAccount.storeName)!;

  const { data: existingCisaat2, error: checkError } = await db
    .from("staff")
    .select("id")
    .eq("username", newAccount.username)
    .maybeSingle();

  if (checkError) {
    throw new Error(checkError.message);
  }

  if (existingCisaat2) {
    throw new Error("Username cisaat2 sudah digunakan.");
  }

  const { data: cisaat2Staff, error: staffError } = await db
    .from("staff")
    .select("id")
    .eq("store_id", cisaat2Store.id);

  if (staffError) {
    throw new Error(staffError.message);
  }

  if (cisaat2Staff && cisaat2Staff.length > 0) {
    throw new Error("Toko Cisaat 2 ternyata sudah memiliki akun.");
  }

  console.log("\nSemua pemetaan akun berhasil diverifikasi.");
  console.log("Akun Cisaat 2 siap dibuat.\n");

  console.log("Masukkan password baru untuk setiap toko.");
  console.log("Password minimal 6 karakter.");
  console.log("Input password akan terlihat di terminal.\n");

  const passwordHashes: Array<{
    id: string;
    username: string;
    storeName: string;
    password_hash: string;
  }> = [];

  for (const account of verifiedAccounts) {
    const password = await getPassword(
      `${account.storeName} (${account.username})`,
    );

    const passwordHash = await bcrypt.hash(password, 12);

    passwordHashes.push({
      ...account,
      password_hash: passwordHash,
    });

    console.log(`Password ${account.username} siap diproses.\n`);
  }

  const cisaat2Password = await getPassword("Cisaat 2 (cisaat2)");
  const cisaat2Hash = await bcrypt.hash(cisaat2Password, 12);

  console.log("\n======================================");
  console.log("RINGKASAN PERUBAHAN");
  console.log("======================================");

  for (const account of verifiedAccounts) {
    console.log(`Update password: ${account.username}`);
  }

  console.log("Buat akun baru: cisaat2");
  console.log("Admin reza: Tidak diubah");

  const confirmation = await ask(
    "\nKetik LANJUTKAN untuk menyimpan perubahan: ",
  );

  if (confirmation !== "LANJUTKAN") {
    console.log("\nProses dibatalkan. Database tidak diubah.");
    return;
  }

  console.log("\nMemperbarui password akun...\n");

  for (const account of passwordHashes) {
    const { data, error } = await db
      .from("staff")
      .update({
        password_hash: account.password_hash,
      })
      .eq("id", account.id)
      .select("id");

    if (error) {
      throw new Error(
        `Gagal memperbarui ${account.username}: ${error.message}`,
      );
    }

    if (!data || data.length === 0) {
      throw new Error(
        `Tidak ada akun yang diperbarui untuk ${account.username}.`,
      );
    }

    console.log(`Berhasil: ${account.username}`);
  }

  console.log("\nMembuat akun Cisaat 2...\n");

  const { data: inserted, error: insertError } = await db
    .from("staff")
    .insert({
      store_id: cisaat2Store.id,
      username: newAccount.username,
      name: newAccount.name,
      password_hash: cisaat2Hash,
      role: "kasir",
      active: true,
    })
    .select("id");

  if (insertError) {
    throw new Error(
      `Lima password sudah diperbarui, tetapi akun Cisaat 2 gagal dibuat: ${insertError.message}`,
    );
  }

  if (!inserted || inserted.length === 0) {
    throw new Error("Akun Cisaat 2 tidak berhasil dibuat.");
  }

  console.log("\n======================================");
  console.log("SEMUA PROSES BERHASIL");
  console.log("======================================");
  console.log("5 akun kasir berhasil diperbarui.");
  console.log("Akun Cisaat 2 berhasil dibuat.");
  console.log("Akun admin reza tetap tidak berubah.");
  console.log("======================================\n");
}

main()
  .catch((error) => {
    console.error("\nPROSES GAGAL:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
