import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("noc-theme")) as
      | "dark"
      | "light"
      | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    }
    if (user?.id) {
      supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.theme === "dark" || data?.theme === "light") {
            setTheme(data.theme);
            applyTheme(data.theme);
            localStorage.setItem("noc-theme", data.theme);
          }
        });
    }
  }, [user?.id]);

  async function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    if (typeof localStorage !== "undefined") localStorage.setItem("noc-theme", next);
    if (user?.id) {
      await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, theme: next, updated_at: new Date().toISOString() });
    }
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/50"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}