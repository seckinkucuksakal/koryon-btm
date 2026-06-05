import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = {
  session: Session | null;
  /**
   * Veriler tamamen public; userId artık zorunlu değil.
   * Yine de storage path için sabit bir değer dönüyor:
   * Anon oturum başlatılabilirse o user'ın id'si, aksi halde "shared".
   */
  userId: string;
  loading: boolean;
};

const SHARED_ID = "shared";

const AuthContext = createContext<AuthState>({
  session: null,
  userId: SHARED_ID,
  loading: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (mounted) setSession(data.session);
        } else {
          // Anon dene, başarısız olursa sessizce devam et — veriler public.
          try {
            const { data: anon } = await supabase.auth.signInAnonymously();
            if (mounted && anon.session) setSession(anon.session);
          } catch {
            /* noop */
          }
        }
      } catch {
        /* noop */
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        userId: session?.user.id ?? SHARED_ID,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
