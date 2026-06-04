import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = {
  session: Session | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthState>({
  session: null,
  userId: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const { data, error: getErr } = await supabase.auth.getSession();
      if (getErr) {
        if (mounted) {
          setError(getErr.message);
          setLoading(false);
        }
        return;
      }

      if (data.session) {
        if (mounted) {
          setSession(data.session);
          setLoading(false);
        }
        return;
      }

      const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
      if (!mounted) return;

      if (anonErr) {
        const friendly =
          anonErr.message?.toLowerCase().includes("anonymous") ||
          anonErr.message?.toLowerCase().includes("disabled")
            ? "Anonim girişler kapalı. Supabase Dashboard → Authentication → Sign In / Up → Anonymous Sign-Ins'i aç."
            : anonErr.message;
        setError(friendly);
        setLoading(false);
        return;
      }

      setSession(anon.session ?? null);
      setLoading(false);
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
        userId: session?.user.id ?? null,
        loading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
