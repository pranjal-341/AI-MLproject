# Completed model evaluation

Profile: practical-v1. Seed: 42. Random split: 80,429 development rows and 20,108 locked-test rows.

| Algorithm | Tier | R2 | RMSE | MAE |
| --- | --- | ---: | ---: | ---: |
| linear_regression | A | 0.1167 | 1.0315 | 0.7483 |
| linear_regression | B | 0.1161 | 1.0319 | 0.7480 |
| linear_regression | C | 0.1184 | 1.0305 | 0.7470 |
| decision_tree | A | 0.8012 | 0.4893 | 0.2240 |
| decision_tree | B | 0.7983 | 0.4929 | 0.2249 |
| decision_tree | C | 0.8365 | 0.4437 | 0.1750 |
| random_forest | A | 0.8979 | 0.3507 | 0.1842 |
| random_forest | B | 0.8964 | 0.3533 | 0.1864 |
| random_forest | C | 0.8930 | 0.3590 | 0.1774 |

The test set was not used for candidate selection. Candidates were chosen on an internal development validation split; final estimators were refit on all development rows.

These scores describe random-row holdout performance. They do not establish generalization to unseen proteins or drugs. The original exhaustive notebook searches, grouped validation, calibrated uncertainty, and XGBoost are not included.

Full metrics: results/final/all_models_comparison.csv. Training details: results/training_status.json and model metadata.json files.
