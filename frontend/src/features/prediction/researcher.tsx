import { BiologicalConsole } from "./biological-console";
import { PredictionConsole } from "./descriptor-console";
import { useAuth } from "@/features/auth/use-auth";

export function Researcher({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  const { session, loading, error } = useAuth();
  if (loading || !session || session.user.is_anonymous) {
    return (
      <section id="researchers" className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="rounded-2xl bg-tealsoft/30 p-8 ring-1 ring-teal/10">
            <h2 className="font-display text-3xl font-semibold text-ink">
              Sign in to predict binding affinity
            </h2>
            <p className="mt-4 text-sm text-soft">
              Create an account or sign in to access the DDG prediction console.
            </p>
            {loading ? (
              <p className="mt-4 text-sm text-mute">Checking your session...</p>
            ) : (
              <a
                href="/auth"
                className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-sm text-background"
              >
                Sign in / Sign up
              </a>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }
  return (
    <div key={session.user.id}>
      <BiologicalConsole />
      <details className="mx-auto max-w-[1200px] px-6 pb-12">
        <summary className="cursor-pointer text-sm text-teal">
          Advanced: measured descriptor input (manual DDG prediction)
        </summary>
        <PredictionConsole />
      </details>
      <div className="mx-auto max-w-[1200px] px-6 pb-12">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-teal/15 bg-tealsoft/20 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Have a descriptor file or a research question?
            </h3>
            <p className="mt-2 text-sm text-soft">
              Upload, review, and predict in your research assistant.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAssistant}
            className="shrink-0 rounded-xl bg-teal px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
          >
            Open research assistant
          </button>
        </div>
      </div>
    </div>
  );
}
