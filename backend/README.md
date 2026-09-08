# OncoBind-ML backend and notebook workflow

## Current state

The uploaded dataset contains 100,537 rows and 168 columns. LR, DT and RF tiers A/B/C are trained and exported with the reproducible `practical-v1` profile; see `results/training_status.json` for the run details. XGBoost is pending its notebook. Full original notebook tuning remains available separately.

## Login and signup

Supabase Auth stores accounts and passwords in its managed authentication system. No separate password table or MdrDB upload to Supabase is needed. The MdrDB dataset stays local for training.

The root `.env` already contains your project URL and secret key, using the original `SUPERBASE_URL` and `SUPERBASE_SECRET_KEY` names. These aliases are supported; the standard `SUPABASE_` spellings are also supported. Never put the secret key in frontend variables.

The frontend is configured in ignored `frontend/.env.local` to use the restricted backend Auth gateway at `http://127.0.0.1:8000/auth/v1`. The browser's `oncobind-auth-gateway` value is just a placeholder, not a Supabase credential. The backend attaches the real credential server-side and forwards only email signup, password login, refresh, user lookup, and logout. No admin or arbitrary proxy routes are exposed. Google OAuth is hidden in gateway mode.

Start the backend, then start the frontend (commands below). Choose **Sign in / Sign up**. New users must confirm their email before signing in; this requirement is enabled in your Supabase project. Once signed in, choose a model, click **Load a real dataset example**, and click **Run prediction**. Signing out removes the console and its results.

`POST /api/predict` and model sample routes require a Supabase user access token in `Authorization: Bearer <token>`. The backend checks it with the configured Supabase Auth server on every request and rejects missing, invalid and anonymous sessions. Merely hiding a button does not provide this protection. Auth and prediction responses use `Cache-Control: no-store`.

The backend `.env` loads automatically. Restart both servers after configuration changes. The gateway eliminates the need for a matching browser publishable key. If you later want direct Supabase client access instead, put `SUPABASE_PUBLISHABLE_KEY=sb_publishable_...` in the root `.env` and run `python -m backend.configure_supabase`, then restart the frontend.

If email confirmation redirects to an unexpected address, set the Supabase Auth Site URL and allowed redirect URLs to your actual frontend origin. Running the frontend on localhost:3000 is convenient for the default local setup. Signup confirmation mail is handled by Supabase; no account or email was created during automated checks.

[Supabase server-side user verification](https://supabase.com/docs/reference/javascript/auth-getuser)

## Practical training

```powershell
.\venv\Scripts\python.exe -m backend.training.train --jobs 2
```

The practical profile uses seed 42, an 80/20 random development/test split, and a 15,000-row development-only tuning subset with a 25% internal validation split. Final models fit all 80,429 development rows. The 20,108 locked test rows are used only for evaluation. LR A uses OLS; B/C choose Ridge alpha from 1/10/100. LR uses median imputation and standard scaling. DT tries depths 8/14/20 and minimum leaf sizes 5/20. RF compares depths 12/18 with 48-tree candidates and fits a final 120-tree forest. DT/RF C use median-importance feature selection fitted within candidate pipelines and refitted on development data for the final model.

This bounded profile does not reproduce the notebooks' larger Yeo-Johnson, Lasso/ElasticNet, pruning, and refinement searches. Model metadata records `training_profile`, selected settings, split hashes, and validation scores. Do not describe these practical scores as full notebook tuning results.

## Install and train

Run from the project root in PowerShell:

```powershell
.\venv\Scripts\python.exe -m pip install -r backend/requirements-training.txt
.\venv\Scripts\python.exe -m backend.training.run LR
.\venv\Scripts\python.exe -m backend.training.run DT
.\venv\Scripts\python.exe -m backend.training.run RF
```

The real dataset is already at `data/raw/MdrDB_Full_Scraped.csv`. Use `--data "C:\path\dataset.csv"` for another location. The target column is `DDG.EXP`; notebook diagnostics also expect `SAMPLE_ID`. Full notebook searches can take hours. Work defaults to one CPU job; use `--jobs 2` to increase parallelism. `all` runs the three uploaded tracks sequentially. XGBoost is never trained by this runner.

Alternatively, select the project venv as the VS Code notebook kernel and run an uploaded notebook from top to bottom. The final export cell connects the trained objects to the backend. The runner saves executed notebooks and intermediate legacy exports under `results/executed_notebooks/`, preserving the uploaded notebooks as source.

## Exported artifacts

For each track and tier, the final cell verifies all held-out predictions match the notebook before writing:

- `models/<algorithm>/model_<A|B|C>/model.joblib`: portable predictor containing fitted preprocessing and feature selection.
- `features.json`: ordered raw numeric descriptor names accepted by the API.
- `metrics.json`: measured locked-test scores (undefined correlations become null).
- `metadata.json`: dataset and test-split hashes, dependency information, and retained features.
- `sample_input.json`: a real held-out example ready to send to the API.
- `results/predictions/`: actual values, predictions, residuals and row identifiers.
- `results/metrics/`: per-track scores; `results/final/all_models_comparison.csv` compares only identical datasets/test splits.
- `results/plots/`: actual-vs-predicted, residual, tree importance and DT diagrams.
- `data/processed/`: numeric raw feature tiers plus target; `data/sample/demo_input.csv`: a held-out tier C descriptor row.

Do not copy the original notebook dictionary exports directly into model.joblib. LR A needs its fitted scaler and imputer; DT C needs full pre-selection imputer columns; RF C needs its fitted imputer. The final application export preserves these steps and derives PLIP/Vina/P2 summaries automatically. Feature-engineering inputs include all original family columns even when the fitted model drops some columns.

Only load trusted joblib files, which can execute Python code. Keep the backend dependency versions compatible with the training environment. Do not refit preprocessing during inference.

## Start the API and frontend

```powershell
.\venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

In a second terminal:

```powershell
cd frontend
npm.cmd run dev -- --port 3000
```

The research console now calls the API instead of calculating simulated scores. Choose an exported model and paste the `features` object from its `sample_input.json`. The feature template contains nulls to replace with your measurements. Protein, mutation, and drug names alone are insufficient; molecular descriptor generation is not implemented.

Frontend `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`. Set it in the frontend environment if needed, then restart Vite. Backend `MODELS_DIR` overrides the artifact location; `CORS_ORIGINS` accepts comma-separated origins (localhost ports 3000, 5173, and 8080 by default). The backend loads the project-root .env automatically.

- `GET /api/health`: liveness, independent of model readiness.
- `GET /api/models`: model slots and ordered raw feature names; uploaded means the artifact loads, its estimator is fitted, and its raw input schema matches features.json.
- `POST /api/predict`: `{ "algorithm": "linear_regression", "variant": "model_A", "features": { ... } }`.
- `GET /api/analytics`: per-model metrics with missing/invalid status.

Use numbers or null for missing measurements. Every required key must be present; extra keys are rejected. Null values are imputed using training statistics. Missing/invalid login returns 401; missing artifacts return 503; invalid input returns 422. Predictions use the original DDG.EXP units and sign convention and do not include a calibrated confidence interval. The backend validates Supabase user tokens before prediction and sample access. The local setup should be served over HTTPS when deployed.

## Verification

```powershell
.\venv\Scripts\python.exe -m pytest tests -q --basetemp=.pytest_cache/backend-tests
```

Integration tests use temporary synthetic fixtures to check all nine inference/export paths and match feature functions against the uploaded notebooks. These are software checks, not scientific validation or real evaluation scores. See `research/methodology.md` for research limitations.

## Completed report and artifact checks

Generate comparison charts and a summary with `python -m backend.training.report`. Verify real exported samples through the API with `python -m backend.training.verify`; this check mocks user validation and does not create an account. Package versions for this run are in `backend/requirements-trained.txt`. Results are under `results/final/model_evaluation.md`, `results/final/api_verification.json`, and `results/plots/comparison/`.

## Dynamic frontend integration

The homepage shares `GET /api/dashboard` for dataset counts, ready models, feature tiers, and evaluation scores. It refreshes every 30 seconds while visible, on window focus, and via **Refresh data**. Failed requests show a connection error; previous data is labeled as the last successful update and prediction submission is disabled until connectivity recovers.

The canonical score source is `models/<algorithm>/<variant>/metrics.json`, with provenance from `metadata.json`. The CSV reports in `results/metrics/` are training outputs; editing those CSVs alone does not update artifact scores. Evaluation tables separate different dataset/test-split hashes and flag artifacts trained on a different version of the current dataset.

The console requires login. Select a ready model, load a real dataset example, and edit the searchable numeric form or JSON. All values are raw descriptors; a blank numeric field maps to null and uses fitted imputation. Results show the actual API output, model version, and inference time. Changing inputs, model, or artifact version clears the previous result.

A prediction may include `model_version` from the dashboard. HTTP 409 means the artifact changed: refresh, reload the example or template, and retry. Models are cached by artifact file signatures and reloaded after file changes. Publish complete, trusted exports; do not partially replace artifacts while serving predictions.

XGBoost automatically becomes available after a compatible fitted artifact and feature schema are exported. It currently has no trained artifact. No simulated fallback predictions or scores are used.

## Biological inputs (no manual descriptor entry)

After signing in, the primary console takes a UniProt/PDB ID, mutation, and PubChem CID or exact dataset SMILES. Optional PDB and chain fields disambiguate structures. Use **Load dataset example**, then **Predict DDG** to try the complete local flow.

- `GET /api/biological/example` returns one existing biological identity (authenticated).
- `POST /api/predict/biological` accepts `protein_id`, `mutation`, `drug_type` (`pubchem_cid` or `smiles`), `drug`, and optional `pdb_id`, `chain_id`, `sample_id`, `algorithm`, `variant`, `model_version`.
- The service matches ALL supplied identity fields exactly, retrieves only the selected model's ordered descriptors, and runs its fitted preprocessing/predictor. Experimental DDG is returned separately for comparison and never enters inference.
- Multiple matches return HTTP 409 with candidate sample IDs; choose one explicitly. No match returns HTTP 422 with `DESCRIPTOR_GENERATION_UNAVAILABLE`. Similar records, other drugs, zeros and all-null templates are never used as substitutes.
- All-null descriptor submissions are now rejected with 422. Partial missing measurements retain fitted imputation.

**Current boundary:** this is automatic retrieval of existing MdrDB descriptors, not de novo molecular descriptor generation. Dataset records may have been used in model fitting, so this flow does not establish independent accuracy. Drug names must currently be supplied as PubChem CIDs; alternate SMILES encodings are not automatically canonicalized.

For unseen combinations, the remaining pipeline must resolve a protein structure and residue numbering, construct and prepare wild-type/mutant protein-ligand complexes, identify or dock the ligand pose, and reproduce the training-compatible LIG/MUT/ENV/PLIP/Vina/P2 definitions, units, and differences. RDKit, PLIP, Vina and a validated MdrDB-compatible feature generator are not installed/provided in this project. In particular the 59 Vina columns cannot be replaced with one docking score. This work is still outstanding; the UI reports it instead of emitting a guessed DDG.

Reference: https://github.com/tencent-quantum-lab/MdrDB and https://www.nature.com/articles/s42004-023-00920-7

The biological endpoint reports MdrDB DDG in kcal/mol, as documented in the authors' tutorial: https://mutation-1300241787.cos.ap-shanghai.myqcloud.com/MdrDB_release/Tutorial/MdrDB_Tutorial_v1.0.2022.pdf . No numerical unit conversion is applied to the model output.
