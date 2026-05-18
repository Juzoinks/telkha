import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "technician" | "teacher";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  isStaff: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  async function loadRoles(userId: string | undefined) {
    if (!userId) {
      setRoles([]);
      setRolesLoaded(true);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
    setRolesLoaded(true);
  }

  useEffect(() => {
    let active = true;
    // 1) listener FIRST (no awaits inside callback)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!active) return;
      setSession(sess);
      setRolesLoaded(false);
      setLoading(true);
      // defer to avoid deadlock with the supabase client
      setTimeout(() => {
        loadRoles(sess?.user.id).finally(() => {
          if (active) setLoading(false);
        });
      }, 0);
    });
    // 2) then existing session
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadRoles(data.session?.user.id).finally(() => {
        if (active) setLoading(false);
      });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Effective loading: still resolving session, OR have a session but roles not yet fetched
  const effectiveLoading = loading || (!!session && !rolesLoaded);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    roles,
    loading: effectiveLoading,
    isStaff: roles.includes("admin") || roles.includes("technician"),
    hasRole: (r) => roles.includes(r),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRoles: async () => loadRoles(session?.user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
