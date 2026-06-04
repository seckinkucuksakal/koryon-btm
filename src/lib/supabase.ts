import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Build sırasında hata fırlatmıyoruz; runtime'da .env.local eksikse
  // konsola net bir uyarı düşelim ki Supabase çağrıları sessizce kırılmasın.
  console.warn(
    "[supabase] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY tanımlı değil. " +
      ".env.local dosyasını .env.example'a göre doldur.",
  );
}

export const supabase: SupabaseClient = createClient(url ?? "", anonKey ?? "");
