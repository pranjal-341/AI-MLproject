import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { apiBase, DashboardContext, useDashboard, type Dashboard } from "@/hooks/use-dashboard";

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(
      () => controller.abort(new Error("Backend request timed out.")),
      60000,
    );
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/dashboard`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}.`);
      const snapshot = (await response.json()) as Dashboard;
      if (!Array.isArray(snapshot.models) || !snapshot.summary || !snapshot.dataset)
        throw new Error("Invalid dashboard response.");
      if (active.current === controller) {
        setData(snapshot);
        setError("");
      }
    } catch (cause) {
      if (active.current === controller)
        setError(
          cause instanceof Error
            ? cause.message + " Check the backend connection."
            : "Backend unavailable.",
        );
    } finally {
      clearTimeout(timer);
      if (active.current === controller) {
        setLoading(false);
        active.current = null;
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => {
      if (document.visibilityState === "visible" && !active.current) void refresh();
    };
    const interval = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
      const pending = active.current;
      active.current = null;
      pending?.abort();
    };
  }, [refresh]);
  return (
    <DashboardContext.Provider value={{ data, error, loading, refresh }}>
      {children}
    </DashboardContext.Provider>
  );
}
export function DashboardStatus() {
  const { data, error, loading, refresh } = useDashboard();
  return (
    <div
      className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm"
      aria-live="polite"
    >
      <p className={error ? "text-red-700" : "text-soft"}>
        {error
          ? `${error}${data ? " Showing the last successful update." : ""}`
          : loading
            ? "Loading live model data..."
            : data
              ? `${data.summary.ready_models} models ready. Updated ${new Date(data.updated_at).toLocaleTimeString()}. Refreshes every 30 seconds.`
              : "No data available."}
      </p>
      <button
        type="button"
        onClick={() => refresh()}
        disabled={loading}
        className="rounded-lg border border-line px-4 py-2 text-teal disabled:opacity-40"
      >
        {loading ? "Refreshing..." : "Refresh data"}
      </button>
    </div>
  );
}
