import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { label: "Architecture", href: "#architecture" },
  { label: "Models", href: "#models" },
  { label: "Metrics", href: "#metrics" },
  { label: "For researchers", href: "#researchers" },
  { label: "Scope", href: "#scope" },
];

export function SiteHeader() {
  const { session, loading } = useAuth();
  const [signOutError, setSignOutError] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 backdrop-blur-xl transition-colors duration-500",
        scrolled
          ? "bg-background/70 border-b border-line/70"
          : "bg-background/0 border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-[7px] bg-ink">
            <span className="font-display text-[13px] font-semibold leading-none text-background">
              O
            </span>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
            OncoBind-ML
          </span>
          <span className="ml-1 hidden text-[10px] font-medium uppercase tracking-[0.18em] text-mute sm:inline">
            Research
          </span>
        </a>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-soft md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {session ? (
            <button
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) setSignOutError("Sign-out failed. Please try again.");
                else {
                  setSignOutError("");
                  window.location.assign("/");
                }
              }}
              className="rounded-full bg-mist px-4 py-2 text-[13px] font-medium text-ink ring-1 ring-ink/5"
            >
              Sign out
            </button>
          ) : (
            <a
              href="/auth"
              className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-background"
            >
              {loading ? "Loading..." : "Sign in / Sign up"}
            </a>
          )}
          {signOutError && (
            <span role="alert" className="max-w-40 text-xs text-red-700">
              {signOutError}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
