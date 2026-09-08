import { DashboardProvider, DashboardStatus } from "@/components/dashboard-provider";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { Tiers } from "@/components/tiers";
import { Metrics } from "@/components/metrics";
import { Algorithms } from "@/components/algorithms";
import { Researcher } from "@/components/researcher";
import { Scope } from "@/components/scope";

const title = "OncoBind-ML — Predicting mutation-induced protein–drug binding changes";
const description =
  "A research ML framework estimating ΔΔG: how single amino-acid mutations shift protein–drug binding, across a progressive A→B→C feature architecture.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main>
          <Hero />
          <DashboardStatus />
          <Tiers />
          <Metrics />
          <Algorithms />
          <Researcher />
          <Scope />
        </main>
        <footer className="border-t border-line py-10">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
              OncoBind-ML
            </span>
            <span className="text-[12px] text-mute">
              Bioinformatics · protein–ligand interaction analysis · structural machine learning
            </span>
          </div>
        </footer>
      </div>
    </DashboardProvider>
  );
}
