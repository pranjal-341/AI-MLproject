import { useState } from "react";
import { ResearchAssistant } from "@/features/research-assistant/research-assistant";
import { DashboardProvider, DashboardStatus } from "@/features/dashboard/dashboard-provider";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/features/landing/hero";
import { Tiers } from "@/features/catalog/tiers";
import { Metrics } from "@/features/dashboard/metrics";
import { Algorithms } from "@/features/catalog/algorithms";
import { Researcher } from "@/features/prediction/researcher";
import { Scope } from "@/features/landing/scope";

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
  const [assistantOpen, setAssistantOpen] = useState(false);
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
          <Researcher onOpenAssistant={() => setAssistantOpen(true)} />
          <Scope />
        </main>
        <ResearchAssistant open={assistantOpen} onOpenChange={setAssistantOpen} />
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
