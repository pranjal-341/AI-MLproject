import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function safePath(value: string | null): string {
  const fallback = "/#researchers";
  if (!value || !value.startsWith("/")) return fallback;
  try {
    const base = "https://oncobind.local";
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}

export function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState("/#researchers");

  useEffect(() => {
    setRedirectTo(safePath(new URLSearchParams(window.location.search).get("redirect")));
  }, []);

  useEffect(() => {
    let active = true;
    try {
      supabase.auth
        .getSession()
        .then(({ data, error: cause }) => {
          if (!active) return;
          if (cause) setError("Could not restore your session. Sign in again.");
          else if (data.session) window.location.assign(redirectTo);
        })
        .catch(() => {
          if (active) setError("Could not restore your session.");
        });
    } catch {
      setError("Sign-in is not configured yet. Contact the project owner.");
    }
    return () => {
      active = false;
    };
  }, [redirectTo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        window.location.assign(redirectTo);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
        });
        if (err) throw err;
        if (data.session) window.location.assign(redirectTo);
        else setNotice("Check your inbox to confirm your address, then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: cause } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${redirectTo}` },
      });
      if (cause) throw cause;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-20">
      <div
        className="floaty pointer-events-none absolute -left-24 top-10 size-[420px] rounded-full bg-tealsoft/60 blur-[130px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 size-[380px] rounded-full bg-ambersoft/60 blur-[140px]"
        aria-hidden
      />

      <div className="relative w-full max-w-[420px] animate-fade-in">
        <Link to="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-[7px] bg-ink">
            <span className="font-display text-[13px] font-semibold leading-none text-background">
              O
            </span>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
            OncoBind-ML
          </span>
        </Link>

        <div className="rounded-[26px] bg-card p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] ring-1 ring-ink/5">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal">
            Research access
          </div>
          <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">
            {mode === "signin" ? "Sign in to predict ΔΔG" : "Create your research account"}
          </h1>
          <p className="mt-2.5 text-[13px] leading-relaxed text-soft">
            Sign in with your email to access model predictions. New accounts require email
            confirmation.
          </p>

          <div className="relative mt-7 grid grid-cols-2 rounded-full bg-mist p-1 ring-1 ring-ink/5">
            <div
              className={cn(
                "absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-ink transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
                mode === "signin" ? "translate-x-1" : "translate-x-[calc(100%+0.25rem)]",
              )}
              aria-hidden
            />
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={cn(
                  "relative z-10 rounded-full py-2 text-[13px] font-medium transition-colors duration-300",
                  mode === m ? "text-background" : "text-soft hover:text-ink",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {import.meta.env["VITE_AUTH_PROXY"] !== "true" && (
            <>
              <button
                type="button"
                onClick={google}
                disabled={busy}
                className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full bg-mist px-6 py-3 text-[13.5px] font-medium text-ink ring-1 ring-ink/5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-tealsoft disabled:translate-y-0 disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1l-3.3 2.6A10 10 0 0 0 12 22"
                  />
                  <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9L3.1 7.5a10 10 0 0 0 0 9z" />
                  <path
                    fill="#4285F4"
                    d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6A5.9 5.9 0 0 1 12 5.9"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-mute">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-[12px] font-medium text-mute">Work email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@lab.edu"
                className="mt-1.5 w-full rounded-xl bg-mist px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-ink/5 transition-all duration-300 placeholder:text-mute/70 focus:bg-card focus:ring-2 focus:ring-teal/40"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-mute">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1.5 w-full rounded-xl bg-mist px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-ink/5 transition-all duration-300 placeholder:text-mute/70 focus:bg-card focus:ring-2 focus:ring-teal/40"
              />
            </label>

            {error && (
              <p className="animate-fade-in rounded-xl bg-destructive/10 px-4 py-3 text-[12.5px] leading-relaxed text-destructive">
                {error}
              </p>
            )}
            {notice && (
              <p className="animate-fade-in rounded-xl bg-tealsoft px-4 py-3 text-[12.5px] leading-relaxed text-ink">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-background transition-all duration-300 hover:-translate-y-0.5 hover:bg-teal disabled:translate-y-0 disabled:opacity-60"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-mute">
          Predictions are research hypotheses, not clinical guidance.{" "}
          <Link to="/" className="story-link text-teal">
            Back to overview
          </Link>
        </p>
      </div>
    </div>
  );
}
