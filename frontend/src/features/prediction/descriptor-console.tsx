import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Reveal } from "@/components/motion/reveal";
import { useDashboard, apiBase, modelLabels as labels } from "@/features/dashboard/use-dashboard";
type Prediction = {
  algorithm: string;
  variant: string;
  prediction: number;
  model_version: string;
  elapsed_ms: number;
};

export function PredictionConsole() {
  const { data, loading, error: connectionError, refresh } = useDashboard();
  const models = data?.models ?? [];
  const requestId = useRef(0);
  const [selected, setSelected] = useState("");
  const [input, setInput] = useState("{}");
  const [mode, setMode] = useState<"form" | "json">("form");
  const [search, setSearch] = useState("");
  let parsed: Record<string, number | null> | null = null;
  try {
    const value: unknown = JSON.parse(input);
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every(
        (item) => item === null || (typeof item === "number" && Number.isFinite(item)),
      )
    )
      parsed = value as Record<string, number | null>;
  } catch {
    /* The JSON editor displays validation errors when submitted. */
  }
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const slot = models.find((model) => `${model.algorithm}/${model.variant}` === selected);

  useEffect(() => {
    requestId.current += 1;
    setResult(null);
    setInput("{}");
    setRunning(false);
    return () => {
      requestId.current += 1;
    };
  }, [selected, slot?.version]);

  async function loadSample() {
    if (!slot || slot.status !== "uploaded" || connectionError) return;
    const id = ++requestId.current;
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch(
        `${apiBase}/api/models/${slot.algorithm}/${slot.variant}/sample`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: AbortSignal.timeout(30000),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(typeof data.detail === "string" ? data.detail : "Could not load a sample.");
      if (id === requestId.current) setInput(JSON.stringify(data.features, null, 2));
    } catch (cause) {
      if (id === requestId.current)
        setError(cause instanceof Error ? cause.message : "Could not load a sample.");
    } finally {
      if (id === requestId.current) setRunning(false);
    }
  }

  async function run() {
    if (!slot || slot.status !== "uploaded" || connectionError) return;
    const id = ++requestId.current;
    setError("");
    setResult(null);
    let features: unknown;
    try {
      features = JSON.parse(input);
      if (!features || typeof features !== "object" || Array.isArray(features))
        throw new Error("Enter a JSON object of feature names and numeric values.");
      if (
        Object.values(features).some(
          (value) => value !== null && (typeof value !== "number" || !Number.isFinite(value)),
        )
      )
        throw new Error("Feature values must be numbers or null for missing measurements.");
      const keys = Object.keys(features);
      const missing = slot.features.filter((name) => !keys.includes(name));
      const extra = keys.filter((name) => !slot.features.includes(name));
      if (missing.length || extra.length)
        throw new Error(
          `Input schema mismatch: ${missing.length} missing and ${extra.length} unexpected features. Load a sample or insert the template.`,
        );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid JSON.");
      return;
    }
    setRunning(true);
    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch(`${apiBase}/api/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          algorithm: slot.algorithm,
          variant: slot.variant,
          features,
          model_version: slot.version,
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Check that all required features have valid values.",
        );
      if (id === requestId.current) setResult(data as Prediction);
    } catch (cause) {
      if (id === requestId.current) {
        setError(cause instanceof Error ? cause.message : "Prediction failed.");
        refresh();
      }
    } finally {
      if (id === requestId.current) setRunning(false);
    }
  }

  return (
    <section id="descriptor-console" className="relative py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal">
            Research console
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
            Predict a change in binding affinity
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-soft">
            Choose a trained model and enter its measured molecular descriptors. The model applies
            the same feature engineering and fitted preprocessing used in its training notebook.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-background p-6 ring-1 ring-ink/10">
            <label htmlFor="prediction-model" className="text-sm font-medium text-ink">
              Model
            </label>
            <select
              id="prediction-model"
              disabled={loading || running}
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setResult(null);
                setInput("{}");
                setError("");
              }}
              className="mt-2 w-full rounded-xl border border-line bg-background p-3 text-sm text-ink"
            >
              <option value="">{loading ? "Loading models..." : "Select an exported model"}</option>
              {models.map((model) => (
                <option
                  key={`${model.algorithm}/${model.variant}`}
                  value={`${model.algorithm}/${model.variant}`}
                  disabled={model.status !== "uploaded"}
                >
                  {labels[model.algorithm] || model.algorithm} /{" "}
                  {model.variant.replace("model_", "Tier ")}{" "}
                  {model.status !== "uploaded" ? "- awaiting training" : ""}
                </option>
              ))}
            </select>
            {!loading &&
              models.length > 0 &&
              !models.some((model) => model.status === "uploaded") && (
                <p className="mt-3 text-sm text-soft">
                  No trained models are available yet. Upload the dataset and run the LR, DT, or RF
                  notebook to enable predictions.
                </p>
              )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <label htmlFor="prediction-features" className="text-sm font-medium text-ink">
                Descriptor values
              </label>
              <button
                type="button"
                disabled={!slot || slot.status !== "uploaded" || running || !!connectionError}
                onClick={() => {
                  setInput(
                    JSON.stringify(
                      Object.fromEntries((slot?.features || []).map((name) => [name, null])),
                      null,
                      2,
                    ),
                  );
                  setResult(null);
                }}
                className="text-xs font-medium text-teal disabled:opacity-40"
              >
                Insert feature template
              </button>
            </div>
            <button
              type="button"
              disabled={!slot || slot.status !== "uploaded" || running || !!connectionError}
              onClick={loadSample}
              className="mt-3 text-xs font-medium text-teal disabled:opacity-40"
            >
              Load a real dataset example
            </button>
            <div className="mt-4 flex gap-3" role="group" aria-label="Input editor">
              <button
                type="button"
                onClick={() => setMode("form")}
                aria-pressed={mode === "form"}
                className="rounded-lg border border-line px-3 py-2 text-xs text-teal"
              >
                Numeric form
              </button>
              <button
                type="button"
                onClick={() => setMode("json")}
                aria-pressed={mode === "json"}
                className="rounded-lg border border-line px-3 py-2 text-xs text-teal"
              >
                JSON editor
              </button>
            </div>
            {mode === "form" ? (
              <div className="mt-3">
                <input
                  aria-label="Search descriptors"
                  placeholder="Search descriptors, e.g. LIG or PLIP"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-xl border border-line bg-background p-3 text-sm"
                />
                {!parsed || !slot?.features.every((name) => Object.hasOwn(parsed!, name)) ? (
                  <p className="mt-3 text-sm text-soft">
                    Load a real example or insert the feature template to populate the form. Invalid
                    JSON can be corrected in the JSON editor.
                  </p>
                ) : (
                  <div className="mt-3 grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">
                    {slot.features
                      .filter((name) => name.toLowerCase().includes(search.toLowerCase()))
                      .map((name) => (
                        <label key={name} className="block text-xs text-soft">
                          <span className="break-all">{name}</span>
                          <input
                            type="number"
                            step="any"
                            disabled={running}
                            value={parsed?.[name] ?? ""}
                            placeholder="Missing (imputed)"
                            onChange={(event) => {
                              const value =
                                event.target.value === "" ? null : Number(event.target.value);
                              if (value !== null && !Number.isFinite(value)) return;
                              setInput(JSON.stringify({ ...parsed, [name]: value }, null, 2));
                              setResult(null);
                            }}
                            className="mt-1 w-full rounded-lg border border-line bg-background p-2 text-ink"
                          />
                        </label>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <textarea
                id="prediction-features"
                spellCheck={false}
                disabled={running}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setResult(null);
                }}
                className="mt-2 min-h-64 w-full rounded-xl border border-line bg-mist/30 p-3 font-mono text-xs text-ink"
                aria-describedby="features-help"
              />
            )}
            <p id="features-help" className="mt-2 text-xs leading-relaxed text-mute">
              Use raw numeric descriptors, not protein or drug names. Replace the template values
              with measurements; use null only for missing values to be imputed.
            </p>
            <button
              type="button"
              onClick={run}
              disabled={!slot || slot.status !== "uploaded" || running || !!connectionError}
              className="mt-5 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? "Predicting..." : "Run prediction"}
            </button>
          </div>
          <div className="rounded-2xl bg-tealsoft/30 p-6 ring-1 ring-teal/10" aria-live="polite">
            <h3 className="font-display text-xl font-semibold text-ink">Prediction result</h3>
            {(error || connectionError) && (
              <p role="alert" className="mt-4 whitespace-pre-wrap break-words text-sm text-red-700">
                {error || connectionError}
              </p>
            )}
            {result ? (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-wider text-soft">Predicted ΔΔG</p>
                <p className="mt-2 font-display text-5xl text-teal">
                  {result.prediction.toFixed(3)}
                </p>
                <p className="mt-4 text-sm text-soft">
                  {labels[result.algorithm]} / {result.variant.replace("model_", "Tier ")}
                </p>
                <p className="mt-3 text-xs text-mute">
                  Model version: {result.model_version} / inference: {result.elapsed_ms.toFixed(1)}{" "}
                  ms
                </p>
                <p className="mt-4 text-xs text-mute">
                  Target: {slot?.metadata.target || "Unrecorded"}. Interpret using the dataset's
                  units and sign convention. This estimate does not include a calibrated uncertainty
                  interval.
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-relaxed text-soft">
                Select a ready model, load an example or enter measurements, and run a prediction.
              </p>
            )}
            {slot && (
              <details className="mt-6 text-xs text-soft">
                <summary className="cursor-pointer font-medium">
                  Required features ({slot.features.length})
                </summary>
                <ul className="mt-3 max-h-64 list-inside list-disc overflow-auto break-all">
                  {slot.features.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
