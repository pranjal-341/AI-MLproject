import { useEffect, useRef, useState } from "react";
import { useDashboard, apiBase, modelLabels } from "@/features/dashboard/use-dashboard";
import { supabase } from "@/integrations/supabase/client";
type Identity = {
  protein_id: string;
  mutation: string;
  drug_type: "pubchem_cid" | "smiles";
  drug: string;
  pdb_id: string;
  chain_id: string;
  sample_id: string;
};
type RecordInfo = {
  sample_id: string;
  pdb_id: string;
  chain_id: string;
  mutation: string;
  cid: string;
};
type Result = {
  prediction: number;
  units: string;
  experimental_ddg: number | null;
  algorithm: string;
  variant: string;
  model_version: string;
  descriptor_count: number;
  imputed_count: number;
  input_source: string;
  record: RecordInfo;
  evaluation_note: string;
};
const empty: Identity = {
  protein_id: "",
  mutation: "",
  drug_type: "pubchem_cid",
  drug: "",
  pdb_id: "",
  chain_id: "",
  sample_id: "",
};
export function BiologicalConsole() {
  const { data, error: connectionError, refresh } = useDashboard();
  const ready = data?.models.filter((model) => model.status === "uploaded") ?? [];
  const [selected, setSelected] = useState("random_forest/model_A");
  const slot = ready.find((model) => `${model.algorithm}/${model.variant}` === selected);
  const [identity, setIdentity] = useState<Identity>(empty);
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<RecordInfo[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => {
    setResult(null);
    current.current?.abort();
    current.current = null;
    setBusy(false);
  }, [identity, selected, slot?.version]);
  useEffect(
    () => () => {
      current.current?.abort();
      current.current = null;
    },
    [],
  );
  function change(key: keyof Identity, value: string) {
    setIdentity((old) => ({ ...old, [key]: value, sample_id: "" }));
    setChoices([]);
    setError("");
  }
  async function request(example = false) {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (authError || !auth.session) throw new Error("Please sign in again.");
      const response = await fetch(
        `${apiBase}/api/${example ? "biological/example" : "predict/biological"}`,
        {
          method: example ? "GET" : "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.session.access_token}`,
          },
          ...(example
            ? {}
            : {
                body: JSON.stringify({
                  ...identity,
                  algorithm: slot?.algorithm,
                  variant: slot?.variant,
                  model_version: slot?.version,
                }),
              }),
        },
      );
      const payload = await response.json();
      if (current.current !== controller) return;
      if (!response.ok) {
        const detail = payload.detail;
        if (detail?.code === "AMBIGUOUS_RECORD") setChoices(detail.candidates);
        else if (response.status === 409) refresh();
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail?.message ||
                (Array.isArray(detail)
                  ? detail.map((item: { msg: string }) => item.msg).join("; ")
                  : "Prediction request failed."),
        );
      }
      if (example) {
        setIdentity(payload as Identity);
        setChoices([]);
      } else setResult(payload as Result);
    } catch (cause) {
      if (current.current === controller)
        setError(
          controller.signal.aborted
            ? "Request timed out. Please retry."
            : cause instanceof Error
              ? cause.message
              : "Backend unavailable.",
        );
    } finally {
      clearTimeout(timeout);
      if (current.current === controller) {
        current.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section id="researchers" className="py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <p className="text-xs uppercase tracking-wider text-teal">Biological prediction console</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
          Protein, mutation and drug to predicted DDG
        </h2>
        <p className="mt-4 max-w-3xl text-sm text-soft">
          Enter biological identifiers. For an exact record in your MdrDB dataset, the backend
          retrieves its molecular, mutation, interaction and docking descriptors and runs the
          selected model. You do not enter individual descriptor values.
        </p>
        <p className="mt-3 text-sm text-amber">
          New combinations outside this dataset require a structure and descriptor generation
          pipeline, which is not yet installed. This mode retrieves existing descriptors; it does
          not perform new docking.
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void request();
            }}
            className="space-y-4 rounded-2xl bg-card p-6 ring-1 ring-ink/10"
          >
            <label className="block text-sm">
              Model
              <select
                value={selected}
                disabled={busy}
                onChange={(event) => setSelected(event.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-background p-3"
              >
                {!slot && <option value={selected}>Select an available model</option>}
                {ready.map((model) => (
                  <option
                    key={`${model.algorithm}/${model.variant}`}
                    value={`${model.algorithm}/${model.variant}`}
                  >
                    {modelLabels[model.algorithm]} / {model.variant.replace("model_", "Tier ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Protein ID (UniProt or PDB)
              <input
                required
                maxLength={20}
                disabled={busy}
                value={identity.protein_id}
                onChange={(event) => change("protein_id", event.target.value)}
                placeholder="e.g. P03366 or 3TKW"
                className="mt-1 w-full rounded-lg border border-line p-3"
              />
            </label>
            <label className="block text-sm">
              Mutation (dataset residue numbering)
              <input
                required
                maxLength={120}
                disabled={busy}
                value={identity.mutation}
                onChange={(event) => change("mutation", event.target.value)}
                placeholder="e.g. I54V"
                className="mt-1 w-full rounded-lg border border-line p-3"
              />
            </label>
            <label className="block text-sm">
              Drug identifier
              <select
                value={identity.drug_type}
                disabled={busy}
                onChange={(event) => change("drug_type", event.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-background p-3"
              >
                <option value="pubchem_cid">PubChem CID</option>
                <option value="smiles">Exact dataset SMILES</option>
              </select>
            </label>
            <label className="block text-sm">
              {identity.drug_type === "pubchem_cid" ? "PubChem compound ID" : "SMILES"}
              <input
                required
                disabled={busy}
                maxLength={5000}
                value={identity.drug}
                onChange={(event) => change("drug", event.target.value)}
                placeholder={
                  identity.drug_type === "pubchem_cid" ? "e.g. 213039" : "Chemical structure string"
                }
                className="mt-1 w-full rounded-lg border border-line p-3"
              />
            </label>
            <details>
              <summary className="cursor-pointer text-sm text-teal">
                Optional structure selection
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(["pdb_id", "chain_id"] as const).map((key) => (
                  <label key={key} className="text-sm">
                    {key === "pdb_id" ? "PDB ID" : "Chain"}
                    <input
                      disabled={busy}
                      value={identity[key]}
                      onChange={(event) => change(key, event.target.value)}
                      className="mt-1 w-full rounded-lg border border-line p-3"
                    />
                  </label>
                ))}
              </div>
            </details>
            {choices.length > 0 && (
              <label className="block text-sm">
                Matching sample
                <select
                  required
                  value={identity.sample_id}
                  onChange={(event) => {
                    setIdentity((old) => ({ ...old, sample_id: event.target.value }));
                    setError("");
                  }}
                  className="mt-1 w-full rounded-lg border border-line p-3"
                >
                  <option value="">Select a complex</option>
                  {choices.map((record) => (
                    <option key={record.sample_id} value={record.sample_id}>
                      {record.sample_id} / {record.pdb_id} / chain {record.chain_id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy || !slot || !!connectionError}
                className="rounded-xl bg-ink px-5 py-3 text-sm text-background disabled:opacity-40"
              >
                {busy ? "Processing..." : "Predict DDG"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void request(true)}
                className="rounded-xl border border-line px-4 py-3 text-sm text-teal disabled:opacity-40"
              >
                Load dataset example
              </button>
            </div>
          </form>
          <div aria-live="polite" className="rounded-2xl bg-tealsoft/30 p-6 ring-1 ring-teal/10">
            <h3 className="font-display text-xl font-semibold">Prediction result</h3>
            {(error || connectionError) && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error || connectionError}
              </p>
            )}
            {result ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-soft">Model-predicted DDG ({result.units})</p>
                <p className="font-display text-5xl text-teal">{result.prediction.toFixed(3)}</p>
                <p className="text-sm">
                  Recorded experimental DDG: {result.experimental_ddg?.toFixed(3) ?? "Unavailable"}{" "}
                  {result.units}
                </p>
                <p className="text-xs text-soft">
                  The prediction is a model estimate, not a replacement for the experimental value.
                </p>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt>Sample</dt>
                    <dd>
                      {result.record.sample_id} / {result.record.pdb_id} / chain{" "}
                      {result.record.chain_id}
                    </dd>
                  </div>
                  <div>
                    <dt>Inputs</dt>
                    <dd>
                      {result.descriptor_count} descriptors; {result.imputed_count} missing values
                      imputed
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{result.input_source}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>
                      {modelLabels[result.algorithm]} / {result.variant} / {result.model_version}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-soft">{result.evaluation_note}</p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-soft">
                Submit a matching biological combination to run the trained model. No guessed
                descriptors or simulated results are used.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
