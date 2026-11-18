import "dotenv/config";

function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env ${key} belum diisi`);
  return v;
}

export const env = {
  port: Number(process.env.PORT || 3000),
  prod: process.env.NODE_ENV === "production",
  sessionSecret: need("SESSION_SECRET"),
  supabaseUrl: need("SUPABASE_URL"),
  supabaseKey: need("SUPABASE_SERVICE_ROLE_KEY"),
};
