import { useEffect, useState } from "react";
import { useDashboard } from "@/features/dashboard/use-dashboard";
import { Reveal } from "@/components/motion/reveal";

export function Hero() {
  const { data } = useDashboard();
  const stats = [
    { value: data?.dataset.rows?.toLocaleString() ?? "--", label: "dataset rows" },
    { value: data?.summary.tiers ?? "--", label: "trained feature tiers" },
    { value: data?.summary.descriptors ?? "--", label: "input descriptors" },
  ];
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setOffset(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="top" className="relative overflow-hidden pb-24 pt-32">
      <div
        className="absolute inset-0 bg-gradient-to-b from-tealsoft/50 via-background to-background"
        aria-hidden
      />
      <div
        className="absolute -top-24 right-[-10%] size-[520px] rounded-full bg-tealsoft/50 blur-3xl"
        aria-hidden
        style={{ transform: `translateY(${offset * 0.12}px)` }}
      />
      <div
        className="absolute left-[-8%] top-40 size-[420px] rounded-full bg-ambersoft/60 blur-3xl"
        aria-hidden
        style={{ transform: `translateY(${offset * -0.08}px)` }}
      />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Reveal className="mb-8 inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 ring-1 ring-ink/5">
            <span className="size-1.5 rounded-full bg-teal" />
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-soft">
              ΔΔG · Binding-affinity regression
            </span>
          </Reveal>

          <Reveal
            as="h1"
            delay={80}
            className="max-w-[19ch] text-balance font-hero text-[clamp(2.35rem,5vw,4.25rem)] font-medium leading-[1.12] tracking-[-0.025em] text-ink"
          >
            When a lock quietly <span className="italic text-teal">reshapes</span>, does the key
            still fit?
          </Reveal>

          <Reveal
            as="p"
            delay={180}
            className="mt-7 max-w-[46ch] text-pretty text-base leading-relaxed text-soft sm:text-lg"
          >
            OncoBind-ML learns how single-amino-acid mutations shift protein–drug binding —
            estimating the change in affinity computationally, one feature tier at a time.
          </Reveal>

          <Reveal delay={280} className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-xl bg-ink py-2.5 pl-4 pr-4 text-sm font-medium text-background ring-1 ring-ink/40 transition-transform duration-300 hover:-translate-y-0.5"
            >
              Explore the model tiers
              <span aria-hidden className="text-background/70">
                →
              </span>
            </a>
            <a
              href="#metrics"
              className="inline-flex items-center rounded-xl bg-background/70 px-4 py-2.5 text-sm font-medium text-ink ring-1 ring-ink/5 transition-transform duration-300 hover:-translate-y-0.5"
            >
              View evaluation
            </a>
          </Reveal>

          <Reveal delay={380} className="mt-12 grid grid-cols-3 gap-4 sm:gap-8">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <div className="font-display text-2xl font-semibold leading-none text-ink sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1.5 text-[12px] text-mute">{s.label}</div>
              </div>
            ))}
          </Reveal>
        </div>

        <Reveal delay={200} className="relative w-full">
          <figure className="relative isolate overflow-hidden rounded-[28px] bg-[#f3faf8] ring-1 ring-ink/5">
            <div className="absolute left-5 top-5 z-10 rounded-full bg-background/85 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-teal backdrop-blur-sm">
              Protein-ligand binding
            </div>
            <img
              src="/images/protein-ligand-structure.png"
              alt="Conceptual 3D illustration of a folded teal protein ribbon surrounding an amber drug molecule, with a coral mutation site near the binding pocket."
              width={1024}
              height={1024}
              fetchPriority="high"
              className="aspect-square w-full object-cover"
            />
            <figcaption className="relative border-t border-teal/10 bg-background/80 px-5 py-4">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-soft">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-teal" aria-hidden="true" />
                  Protein
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber" aria-hidden="true" />
                  Drug ligand
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#d78070]" aria-hidden="true" />
                  Mutation site
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-mute">
                Local structure. Molecular contacts. Binding affinity.
                <span className="mt-1 block text-[10px]">Conceptual illustration</span>
              </p>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
