import test from "node:test";
import assert from "node:assert/strict";
import { validateDeploymentConfig } from "./check-deployment-env.mjs";
const valid = {
  VERCEL: "1",
  VITE_API_BASE_URL: "https://api.example.org",
  VITE_SUPABASE_URL: "https://api.example.org",
  VITE_SUPABASE_PUBLISHABLE_KEY: "oncobind-auth-gateway",
  VITE_AUTH_PROXY: "true",
};
test("accepts gateway configuration and skips local builds", () => {
  assert.doesNotThrow(() => validateDeploymentConfig(valid));
  assert.doesNotThrow(() => validateDeploymentConfig({}));
});
test("rejects absent settings and browser localhost origins", () => {
  assert.throws(() => validateDeploymentConfig({ VERCEL: "1" }), /Missing/);
  assert.throws(
    () => validateDeploymentConfig({ ...valid, VITE_API_BASE_URL: "http://127.0.0.1:8000" }),
    /HTTPS/,
  );
});
test("rejects opaque and legacy service credentials", () => {
  for (const key of [
    "sb_secret_test",
    `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
  ])
    assert.throws(
      () => validateDeploymentConfig({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: key }),
      /server-only/,
    );
});
test("requires matching gateway and API origins", () => {
  assert.throws(
    () => validateDeploymentConfig({ ...valid, VITE_SUPABASE_URL: "https://other.example.org" }),
    /match/,
  );
});
