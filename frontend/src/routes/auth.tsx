import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/features/auth/auth-page";

const title = "Sign in — OncoBind-ML research console";
const description =
  "Sign in or create a research account to run ΔΔG predictions on the OncoBind-ML console.";

export const Route = createFileRoute("/auth")({
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
  component: AuthPage,
});
