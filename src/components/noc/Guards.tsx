import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type AppRole } from "@/lib/auth/AuthProvider";

/** Renders children only if signed in. Otherwise shows a sign-in prompt. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">Sign in required</h2>
        <p className="mt-2 text-sm text-muted-foreground">Please sign in to continue.</p>
        <Link to="/login" className="mt-4 inline-block text-primary underline">Go to sign in</Link>
      </div>
    );
  }
  return <>{children}</>;
}

/** Renders children only if signed in AND has any of the allowed roles. */
export function RequireRole({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  const { session, roles, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">Sign in required</h2>
        <Link to="/login" className="mt-4 inline-block text-primary underline">Sign in</Link>
      </div>
    );
  }
  if (!allow.some((r) => roles.includes(r))) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">Not authorized</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page requires one of: {allow.join(", ")}. Ask an admin to grant you access.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}