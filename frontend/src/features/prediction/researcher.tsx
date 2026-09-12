import { BiologicalConsole } from "./biological-console";
import { PredictionConsole } from "./descriptor-console";
import { useAuth } from "@/features/auth/use-auth";

export function Researcher() {
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
          Advanced: measured descriptor input
        </summary>
        <PredictionConsole />
      </details>
    </div>
  );
}
