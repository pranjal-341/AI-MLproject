# Deployment: Vercel frontend + Python inference API

## Deployment topology

| Component | Runs on | Required resources |
| --- | --- | --- |
| React/TanStack Start SSR frontend | Vercel, Node.js 24.x | `frontend/`, npm lockfile, public environment settings |
| FastAPI inference/auth gateway | HTTPS Python/container service | `backend/`, `models/`, `data/raw/`, Supabase server configuration |
| User accounts | Supabase Auth | Email provider and application redirect URLs |

This repository configures Vercel to deploy **the frontend**. It does not package the Python API into Vercel Functions. The current inference service loads a 115 MB CSV and multiple fitted estimators into memory; provision backend storage and RAM for those resources. Future docking would also need a separate worker environment.

Vercel supports TanStack Start SSR through Nitro. The existing Lovable configuration already installs Nitro, so `frontend/vite.config.ts` sets its `vercel` preset without adding a second plugin. See [Vercel's TanStack Start guide](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel) and [Nitro's Vercel provider](https://nitro.build/deploy/providers/vercel).

## 1. Prepare the Python backend

Obtain real research assets before building. A Git LFS pointer is not a usable CSV or model:

```sh
git lfs install
git lfs pull
```

Build from the **repository root**:

```sh
docker build -f backend/Dockerfile -t oncobind-api .
```

For a local container check, keep the credentials in your existing root `.env`:

```sh
docker run --rm --env-file .env -p 8000:8000 oncobind-api
```

The container listens on `PORT` (default 8000), runs a single Uvicorn process as a non-root user, and exposes `/api/health` for liveness. The image contains inference artifacts and the raw CSV; it excludes frontend dependencies, notebooks, processed datasets, credentials, and training results.

Deploy this image to your Python/container host. Configure its HTTPS endpoint and environment variables:

| Backend variable | Value |
| --- | --- |
| `SUPABASE_URL` | Actual `https://<project>.supabase.co` URL |
| `SUPABASE_PUBLISHABLE_KEY` | Actual Supabase publishable key; preferred when available |
| `SUPABASE_SECRET_KEY` | Server-only alternative if no publishable key is supplied |
| `CORS_ORIGINS` | Comma-separated exact frontend origins, e.g. `https://your-project.vercel.app,https://your-custom-domain.org` |
| `PORT` | Provided by host, or 8000 |
| `MODELS_DIR` | Optional absolute artifact directory if using a volume; default `/app/models` |

Do not append `/api` to the backend origin used by the frontend. Keep the CSV at `/app/data/raw/MdrDB_Full_Scraped.csv` in this image. Preserve the fitted-artifact dependency versions in `backend/requirements-trained.txt`; `requirements-inference.txt` applies these as constraints.

A green liveness check is not model readiness. Check `/api/dashboard` to verify actual model loading and dataset availability. Publish the entire artifact set together: `model.joblib`, `features.json`, `metrics.json`, `metadata.json`, and `sample_input.json`.

## 2. Set up the Vercel project

Import the GitHub repository or update your existing Vercel project with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | `TanStack Start` |
| Node.js Version | `24.x` |
| Install Command | `npm ci` (set in `frontend/vercel.json`) |
| Build Command | `npm run build` (set in `frontend/vercel.json`) |
| Output Directory | Leave the override **disabled**; Nitro emits Vercel Build Output |

Do not use `dist`, a static-Vite preset, or a catch-all rewrite to `index.html`. This application has SSR and `/auth` routing. A local Vercel-target build writes `frontend/.vercel/output/config.json`, static assets, and server functions.

The Python backend and model files are not needed in the frontend build. Leave access to files outside the Vercel root directory disabled unless you deliberately introduce shared frontend source later. Git LFS assets are needed on the backend host, not inside the frontend deployment.

## 3. Configure Vercel environment variables

The supported setup below keeps authentication behind the FastAPI gateway. Substitute your **actual HTTPS backend origin** for `https://api.your-domain.org`.

| Variable | Vercel value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://api.your-domain.org` |
| `VITE_AUTH_PROXY` | `true` |
| `VITE_SUPABASE_URL` | `https://api.your-domain.org` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `oncobind-auth-gateway` |
| `SUPABASE_URL` | `https://api.your-domain.org` (optional SSR fallback) |
| `SUPABASE_PUBLISHABLE_KEY` | `oncobind-auth-gateway` (optional SSR fallback) |

Here `oncobind-auth-gateway` is a public routing marker, **not a Supabase credential**. The FastAPI service uses the real Supabase URL/key. The frontend's `VITE_SUPABASE_URL` intentionally points to FastAPI in gateway mode.

Set these for Production and the Preview environments you intend to use. Variables prefixed `VITE_` are public and embedded at build time: never use a secret/service-role key there. Do not deploy localhost URLs; a visitor's browser would try to contact their own machine. Redeploy after changing frontend environment values.

`frontend/.env.example` is a local-development template, not a production configuration. Do not upload `.env.local` to GitHub. Vercel builds run an environment preflight to catch missing configuration, loopback URLs, and secret keys in the browser configuration.

## 4. Configure Supabase Auth and CORS

In Supabase Authentication URL Configuration:

- Set Site URL to your production frontend origin.
- Allow the exact confirmation redirect produced by the app, currently the frontend origin with `/` (and any explicit routes you choose to support).
- Add your custom domain and specific preview deployments if those need signup/login.
- Keep email confirmation enabled or disabled according to your Supabase project policy; with confirmation enabled, users must follow the email link before login.

Add those same origins to the backend `CORS_ORIGINS`. This controls both API CORS and the gateway's signup redirect validation. A Supabase redirect allowlist alone does not authorize an origin in the backend. The gateway supports email/password authentication; Google OAuth is hidden in this mode.

Never use a broad `*.vercel.app` trust rule. Use a stable preview domain or explicitly list the preview origins that should access the API.

## 5. Validate the deployment

After deploying the API and frontend:

1. Open `<api-origin>/api/health`; expect `{"status":"ok"}`.
2. Open `<api-origin>/api/dashboard`; check the dataset status and nine LR/DT/RF ready slots. XGBoost remains missing until exported.
3. Open the Vercel homepage and `/auth` directly; check page rendering and font loading.
4. Create/sign in to a test account, completing email confirmation if required.
5. Choose **Load dataset example** and **Predict DDG**. Check the predicted value, experimental value, units, and model provenance.
6. Sign out. The prediction console should be locked, and unauthenticated calls to prediction/sample routes should return 401.
7. Refresh the page and confirm session restoration and dashboard refresh.

These are deployment checks; they do not establish scientific accuracy. Local API tests mock successful Supabase user validation. A real production login still needs to be verified against your configured project.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| GitHub rejects a large file | Follow [GitHub / LFS setup](GITHUB.md); the raw CSV exceeds the regular Git file limit |
| Vercel cannot find `package.json` | Root Directory must be `frontend` |
| Build creates Cloudflare output | Verify Nitro `preset: "vercel"`; remove an externally configured `LOVABLE_NITRO_PRESET`/Lovable build mode from your Vercel project |
| `/auth` returns 404 | Use TanStack Start + Nitro SSR; remove static-SPA output overrides |
| Homepage works, metrics/predictions fail | Deploy the Python service, set its HTTPS origin, configure CORS, and redeploy frontend |
| Login/signup fails | Check gateway URLs, backend Supabase credentials, redirect allowlists, and email confirmation |
| `/api/health` works, models are invalid | Check full LFS assets, paths, artifact completeness, and Python/scikit-learn compatibility |
| No biological match | The current app requires an exact dataset record; unseen-combination docking is still pending |
| Model version conflict | Refresh the catalog, select/load the input again, then retry |
| Cold first dashboard request | CSV parsing and model loading happen on first access; measure backend memory/startup time and keep sufficient resources |

## Scope of repository setup

Configuration and local build checks do not create a Vercel project, deploy an API host, set production secrets, or publish a live URL. Complete the provider settings above using your own accounts. The [current Vercel limits](https://vercel.com/docs/functions/limitations) should be checked if you later redesign the Python service for Vercel Functions.
