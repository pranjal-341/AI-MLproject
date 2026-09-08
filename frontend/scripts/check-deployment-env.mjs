import { loadEnv } from "vite";
import { pathToFileURL } from "node:url";

export function validateDeploymentConfig(env) {
  if (env["VERCEL"] !== "1") return;
  const required = [
    "VITE_API_BASE_URL",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_AUTH_PROXY",
  ];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length)
    throw new Error(`Missing Vercel configuration: ${missing.join(", ")}. See docs/DEPLOYMENT.md.`);
  for (const name of ["VITE_API_BASE_URL", "VITE_SUPABASE_URL"]) {
    let url;
    try {
      url = new URL(env[name]);
    } catch {
      throw new Error(`${name} must be an absolute HTTPS origin.`);
    }
    if (
      url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      throw new Error(
        `${name} must be a public HTTPS origin without credentials, query parameters, or a path.`,
      );
    }
  }
  const key = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  let role;
  try {
    role = JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString()).role;
  } catch {
    /* New publishable keys and gateway markers are opaque. */
  }
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw new Error("A server-only Supabase key cannot be used in VITE_SUPABASE_PUBLISHABLE_KEY.");
  if (!["true", "false"].includes(env["VITE_AUTH_PROXY"]))
    throw new Error("VITE_AUTH_PROXY must be true or false.");
  if (
    env["VITE_AUTH_PROXY"] === "true" &&
    new URL(env["VITE_API_BASE_URL"]).origin !== new URL(env["VITE_SUPABASE_URL"]).origin
  )
    throw new Error("Gateway mode requires VITE_SUPABASE_URL to match the API origin.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateDeploymentConfig({ ...loadEnv("production", process.cwd(), ""), ...process.env });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
