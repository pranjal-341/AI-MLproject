# Data ownership

- `raw/`: source MdrDB CSV. Preserve the original data and its hash; do not edit it to improve a prediction.
- `processed/`: generated numeric feature tiers and target for training.
- `sample/`: small numeric input examples for demonstration.

Large raw/processed CSVs use Git LFS. The biological console retrieves exact-record descriptors from the raw CSV. User accounts belong to Supabase Auth, not these files. See the [methodology](../research/methodology.md) and [asset guide](../docs/GITHUB.md).
