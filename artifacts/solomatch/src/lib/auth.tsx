import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  // True until the initial session has been resolved from storage.
  loading: boolean;
  // `undefined` while loading, then a definite boolean — lets route guards wait
  // for a known answer before redirecting instead of flashing a redirect.
  isSignedIn: boolean | undefined;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    // Clear cached per-user data whenever the signed-in identity changes, so a
    // sign-in / sign-out / account switch never serves another session's
    // listings. The first observation only seeds the ref (no clear).
    function syncUser(next: Session | null) {
      const userId = next?.user.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
      setSession(next);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      syncUser(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      syncUser(next);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [qc]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    isSignedIn: loading ? undefined : session !== null,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
