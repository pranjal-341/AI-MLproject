import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let version = 0;
    let unsubscribe = () => {};
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, next) => {
        version += 1;
        if (active) {
          setSession(next);
          setLoading(false);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
      const initialVersion = version;
      supabase.auth
        .getSession()
        .then(({ data, error: cause }) => {
          if (!active || version !== initialVersion) return;
          if (cause) setError("Could not restore your session. Please sign in again.");
          setSession(data.session);
          setLoading(false);
        })
        .catch(() => {
          if (active) {
            setError("Could not restore your session.");
            setLoading(false);
          }
        });
    } catch {
      setError("Sign-in is not configured yet. Contact the project owner.");
      setLoading(false);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return { session, loading, error };
}
