import { useDashboard, modelLabels } from "@/hooks/use-dashboard";
export function Algorithms() {
  const { data, loading } = useDashboard();
  const algorithms = [...new Set(data?.models.map((model) => model.algorithm) ?? [])];
  return (
    <section id="models" className="py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <p className="text-xs uppercase tracking-wider text-teal">Live model registry</p>
        <h2 className="mt-4 font-display text-4xl font-semibold text-ink">
          Available learning algorithms
        </h2>
        <p className="mt-4 text-soft">
          Availability is checked against the fitted artifacts and their input feature schema.
        </p>
        {!data && (
          <p className="mt-6 text-soft">
            {loading ? "Loading algorithms..." : "Connect the backend to view models."}
          </p>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {algorithms.map((algorithm) => (
            <article key={algorithm} className="rounded-2xl bg-mist/60 p-6 ring-1 ring-ink/10">
              <h3 className="font-display text-xl font-semibold text-ink">
                {modelLabels[algorithm] || algorithm}
              </h3>
              <ul className="mt-5 space-y-4">
                {data?.models
                  .filter((model) => model.algorithm === algorithm)
                  .map((model) => (
                    <li key={model.variant} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span>{model.variant.replace("model_", "Tier ")}</span>
                        <span className={model.status === "uploaded" ? "text-teal" : "text-mute"}>
                          {model.status === "uploaded"
                            ? "Ready"
                            : model.status === "invalid"
                              ? "Invalid artifact"
                              : "Awaiting export"}
                        </span>
                      </div>
                      {model.status === "uploaded" && (
                        <p className="mt-1 text-xs text-mute">
                          {model.features.length} inputs /{" "}
                          {model.metadata.training_profile || "Profile unrecorded"}
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
