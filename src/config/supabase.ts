import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const db = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: false },
});
