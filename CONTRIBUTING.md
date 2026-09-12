# Contributing to OncoBind-ML

Read the [project guide](docs/PROJECT_GUIDE.md) before changing application structure. Keep changes focused on one behavior or research experiment.

1. Place frontend work in the appropriate `features/` folder and keep route files small.
2. Keep API validation in schemas, request handling in routes, and prediction logic in services.
3. Add meaningful unit or integration tests for changed behavior. Use temporary synthetic artifacts for ordinary tests.
4. Run `python scripts/project.py check` and `python scripts/project.py build` as appropriate.
5. When changing inference, run the real artifact parity check. Preserve the serialized model import path or provide an explicit migration.
6. Document model data/split hashes, preprocessing and evaluation limitations. Do not substitute demonstration values for measured metrics.

Never include account secrets, local environments or generated frontend bundles in a contribution. Follow the [large-asset guide](docs/GITHUB.md) for data/model files. Do not rewrite published Git history; this repository is connected to Lovable.
