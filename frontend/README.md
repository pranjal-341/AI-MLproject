# OncoBind-ML frontend

React 19 and TanStack Start research dashboard with Tailwind CSS, Supabase authentication, live model evaluation, and a biological prediction console.

- [Project overview and local setup](../README.md)
- [Vercel deployment guide](../docs/DEPLOYMENT.md)
- [Backend/API documentation](../backend/README.md)

## Development

Use Node.js 24.x. From this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev -- --port 3000
```

On PowerShell, use `Copy-Item .env.example .env.local` if the file does not already exist. Start the Python backend separately from the repository root. The example environment uses its authentication gateway at `http://127.0.0.1:8000`.

## Checks and build

```sh
npm run typecheck
npm run build
```

The build uses the bundled Nitro plugin with the Vercel preset and emits `.vercel/output/`. Set the Vercel project Root Directory to `frontend`; leave Output Directory overrides disabled. Use the npm lockfile and the install command defined in `vercel.json`.

## Typography

The hero headline uses Lora at a responsive 2.35-4.25 rem size. Manrope is used for other headings, Source Sans 3 for body text and forms, and system monospace for raw descriptors. Fonts are loaded through Google Fonts with `display=swap` and local fallback families.

## Data and authentication

Components share `/api/dashboard` with periodic refresh. Both prediction modes require a Supabase user token verified by FastAPI. The primary mode resolves exact MdrDB records; de novo descriptor generation is not implemented. Public browser environment variables must never contain Supabase secret/service-role keys.

## Source organization

`src/features/` groups application behavior into `auth`, `landing`, `catalog`, `dashboard`, and `prediction`. Route files compose those features. `src/components/` holds shared `layout`, `motion`, and `ui` building blocks; `src/hooks/` holds shared device hooks. Supabase adapters remain in `src/integrations/`.

See the [project guide](../docs/PROJECT_GUIDE.md) for boundaries and the request flow.
