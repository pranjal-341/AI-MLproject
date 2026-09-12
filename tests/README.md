# Tests

- `unit/`: isolated preprocessing rules with small inputs.
- `integration/`: API/authentication contracts, biological identity resolution, catalog updates, and notebook export compatibility using temporary artifacts.
- `conftest.py`: shared fixtures; auth overrides are scoped to individual tests.

Run `python scripts/project.py test` from the repository root, or `python -m pytest tests -q` in the project environment. Root `pytest.ini` supplies a consistent repository import path.

The separate `python -m backend.training.verify` command checks real saved model predictions; it requires the artifacts and reference prediction files and mocks successful Supabase validation. Neither fixture tests nor this command establish independent scientific accuracy or verify a live user's login.
