import { useDashboard } from "@/features/dashboard/use-dashboard";
export function Tiers() {
  const { data, loading } = useDashboard();
  const ready = data?.models.filter((model) => model.status === "uploaded") ?? [];
  const variants = [...new Set(ready.map((model) => model.variant))];
  return (
    <section id="architecture" className="bg-mist/40 py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <p className="text-xs uppercase tracking-wider text-teal">Feature architecture</p>
        <h2 className="mt-4 font-display text-4xl font-semibold text-ink">
          Molecular inputs, by trained tier
        </h2>
        <p className="mt-4 max-w-2xl text-soft">
          Explore the raw descriptor families accepted by the exported models. Fitted preprocessing
          and feature engineering are applied by the backend.
        </p>
        {!variants.length && (
          <p className="mt-6 text-soft">
            {loading ? "Loading feature schemas..." : "No trained feature tiers available."}
          </p>
        )}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {variants.map((variant) => {
            const models = ready.filter((model) => model.variant === variant);
            const features = [...new Set(models.flatMap((model) => model.features))];
            const families: Record<string, number> = {};
            features.forEach((name) => {
              const family = name.startsWith("vina") ? "VINA" : name.split(".")[0]!;
              families[family] = (families[family] ?? 0) + 1;
            });
            return (
              <article key={variant} className="rounded-2xl bg-card p-7 ring-1 ring-ink/10">
                <h3 className="font-display text-3xl font-semibold text-teal">
                  {variant.replace("model_", "Tier ")}
                </h3>
                <p className="mt-3 text-sm text-soft">
                  {features.length} distinct raw inputs across {models.length} ready models
                </p>
                <dl className="mt-6 space-y-3">
                  {Object.entries(families).map(([family, count]) => (
                    <div
                      key={family}
                      className="flex justify-between border-b border-line pb-2 text-sm"
                    >
                      <dt>{family}</dt>
                      <dd>{count}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
