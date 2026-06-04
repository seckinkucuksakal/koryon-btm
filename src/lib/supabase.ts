import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY tanımlı değil. " +
      ".env.local dosyasını .env.example'a göre doldur.",
  );
}

export const supabase = createClient<Database>(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const STORAGE_BUCKET = "room-assets";

export type PanelType =
  | "mcc"
  | "dagitim"
  | "motor"
  | "vfd"
  | "soft_starter"
  | "ups"
  | "diger";

export const PANEL_TYPE_LABELS: Record<PanelType, string> = {
  mcc: "MCC",
  dagitim: "Dağıtım Panosu",
  motor: "Motor Panosu",
  vfd: "VFD",
  soft_starter: "Soft Starter",
  ups: "UPS",
  diger: "Diğer",
};

export const PANEL_TYPES: PanelType[] = [
  "mcc",
  "dagitim",
  "motor",
  "vfd",
  "soft_starter",
  "ups",
  "diger",
];
