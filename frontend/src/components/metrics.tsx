import { useState } from "react";
import { useDashboard, modelLabels } from "@/hooks/use-dashboard";
const columns = ["R2", "RMSE", "MAE", "Pearson", "Spearman"];
export function Metrics() {
  const { data, loading } = useDashboard();
  const [algorithm, setAlgorithm] = useState("all");
  const rows =
    data?.models.filter(
      (row) =>
        row.status === "uploaded" &&
        Object.keys(row.metrics).length &&
        (algorithm === "all" || row.algorithm === algorithm),
    ) ?? [];
  const groups = [
    ...new Set(
      rows.map((row) =>
        row.metadata.dataset_sha256 && row.metadata.test_split_sha256
          ? `${row.metadata.dataset_sha256}/${row.metadata.test_split_sha256}`
          : `unknown/${row.algorithm}/${row.variant}`,
      ),
    ),
  ];
  return (
    <section id="metrics" className="bg-mist/60 py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <p className="text-xs uppercase tracking-wider text-amber">Live model evaluation</p>
        <h2 className="mt-4 font-display text-4xl font-semibold text-ink">Measured performance</h2>
        <p className="mt-5 max-w-2xl text-soft">
          Scores come from each model's exported metrics. Tables are separated by dataset and test
          split, so different evaluation runs are not silently mixed.
        </p>
        <label className="mt-6 block text-sm text-soft">
          Algorithm{" "}
          <select
            value={algorithm}
            onChange={(event) => setAlgorithm(event.target.value)}
            className="ml-3 rounded-lg border border-line bg-card p-2"
          >
            <option value="all">All algorithms</option>
            {[...new Set(data?.models.map((row) => row.algorithm) ?? [])].map((name) => (
              <option key={name} value={name}>
                {modelLabels[name] || name}
              </option>
            ))}
          </select>
        </label>
        {!rows.length && (
          <p className="mt-8 text-soft">
            {loading
              ? "Loading evaluation results..."
              : "No exported metrics available for this selection."}
          </p>
        )}
        {groups.map((group) => {
          const cohort = rows.filter(
            (row) =>
              (row.metadata.dataset_sha256 && row.metadata.test_split_sha256
                ? `${row.metadata.dataset_sha256}/${row.metadata.test_split_sha256}`
                : `unknown/${row.algorithm}/${row.variant}`) === group,
          );
          const metadata = cohort[0]!.metadata;
          return (
            <div
              key={group}
              className="mt-8 overflow-x-auto rounded-2xl bg-card p-6 ring-1 ring-ink/5"
            >
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="mb-4 text-left text-xs text-mute">
                  {group.startsWith("unknown/")
                    ? "Evaluation provenance unavailable; comparability is unverified."
                    : `Dataset ${metadata.dataset_sha256?.slice(0, 12)} / split ${metadata.test_split_sha256?.slice(0, 12)}`}
                  <br />
                  Development rows: {metadata.development_rows?.toLocaleString() ?? "unrecorded"} /
                  test rows: {metadata.test_rows?.toLocaleString() ?? "unrecorded"} / seed:{" "}
                  {metadata.seed ?? "unrecorded"}
                </caption>
                <thead>
                  <tr className="border-b border-line text-mute">
                    <th className="p-3" scope="col">
                      Model / training profile
                    </th>
                    {columns.map((name) => (
                      <th className="p-3" scope="col" key={name}>
                        {name === "R2" ? "R\u00b2" : name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohort.map((row) => (
                    <tr className="border-b border-line/60" key={`${row.algorithm}/${row.variant}`}>
                      <th scope="row" className="p-3 font-medium text-ink">
                        {modelLabels[row.algorithm] || row.algorithm} /{" "}
                        {row.variant.replace("model_", "Tier ")}
                        <span className="mt-1 block text-xs font-normal text-mute">
                          {row.metadata.training_profile || "Unrecorded profile"}
                          {row.dataset_matches === false
                            ? " / trained on a different dataset version"
                            : ""}
                        </span>
                      </th>
                      {columns.map((name) => (
                        <td className="p-3 tabular-nums text-soft" key={name}>
                          {row.metrics[name]?.toFixed(3) ?? "Unavailable"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <p className="mt-5 text-xs text-mute">
          The practical-v1 exports use a random-row holdout. These scores do not establish
          performance on unseen proteins or drugs. No calibrated prediction intervals are available.
        </p>
      </div>
    </section>
  );
}
