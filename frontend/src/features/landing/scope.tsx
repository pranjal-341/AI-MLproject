import { Reveal } from "@/components/motion/reveal";

export function Scope() {
  return (
    <section id="scope" className="pb-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal>
          <div className="overflow-hidden rounded-[28px] bg-ink">
            <div className="grid lg:grid-cols-[1fr_1fr]">
              <div className="p-10 lg:p-14">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-teal">
                  Scope
                </span>
                <h2 className="mt-4 max-w-[16ch] text-balance font-display text-3xl font-semibold tracking-tight text-background sm:text-4xl">
                  A prioritization tool, not a prescription
                </h2>
                <p className="mt-5 max-w-[52ch] text-pretty text-base leading-relaxed text-background/65">
                  OncoBind-ML does not decide which medicine a patient should take. Predicted ΔΔG
                  alone cannot establish clinical success or failure — real drug response depends on
                  many biological and patient-specific factors.
                </p>
                <p className="mt-4 max-w-[52ch] text-pretty text-base leading-relaxed text-background/65">
                  It is a research-oriented prediction and candidate-prioritization framework: rank
                  mutation–drug combinations for costlier simulation and experiment. Every
                  prediction remains a hypothesis.
                </p>
              </div>
              <div className="relative border-t border-background/10 bg-gradient-to-br from-ink to-soft/20 p-10 lg:border-l lg:border-t-0 lg:p-14">
                <div className="relative rounded-[18px] bg-background/5 p-6 ring-1 ring-background/10">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-background/50">
                    Research question
                  </div>
                  <p className="mt-3 font-display text-xl font-medium leading-snug text-background/90">
                    Does explicit 3D structural context add predictive value beyond biochemical,
                    interaction and docking descriptors?
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {["Feature ablation", "Grouped validation", "Explainability"].map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-background/10 px-2.5 py-1 text-[11px] font-medium text-background/70"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
