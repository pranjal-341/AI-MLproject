# Experiment outputs

| Directory | Contents |
| --- | --- |
| `metrics/` | Per-algorithm exported scores |
| `predictions/` | Reference held-out predictions and residuals |
| `plots/` | Comparisons, residuals, feature importance and tree diagrams |
| `data_analysis/` | Data quality summaries and target distribution |
| `final/` | Consolidated comparison, evaluation report and API verification |
| `executed_notebooks/` (generated) | Executed full notebook runs |

`training_status.json` records the practical training run. The live application reads artifact-side `models/.../metrics.json`, so editing these reports alone does not update the dashboard. For presentation, use [model_evaluation.md](final/model_evaluation.md) and [comparison plots](plots/comparison/). Preserve dataset/test-split hashes with all comparisons.
