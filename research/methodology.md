# Methodology and current limitations

## Implemented notebook protocol

The uploaded LR, DT and RF tracks regress `DDG.EXP`. They use numeric LIG.*, MUT.*, ENV.* features for A; add PLIP.* for B; and add vina/vinaN and P2.*, P2dl.*, P2dp.* for C. B/C feature summaries reproduce each uploaded notebook, including the PLIP-per-molecular-weight feature used by DT/RF B. Missing measurements are imputed using fitted training medians. LR transformations remain inside the exported predictor or its fitted pipeline.

Each notebook uses seed 42 and a random 80/20 development/test split after removing nonnumeric targets. Exports verify inference against every notebook test prediction and record dataset/test-row hashes. Only tracks with matching hashes enter the combined comparison. XGBoost is pending.

## Research interpretation

The current notebook selection/pruning/search procedure is retained. Some imputation, constant filtering, and supervised feature selection occur before development cross-validation. Consequently those CV values may be optimistic; they are not equivalent to nested cross-validation with all preprocessing fitted inside every fold. DT pruning and RF C feature selection deserve particular review before making comparative claims.

Random row splitting also does not establish generalization to unseen proteins, drugs, or mutation groups. Consider grouped splits for that question. Do not use locked-test diagnostics to iteratively select model settings. The notebooks display test diagnostics for multiple candidates; making choices from those diagnostics would compromise the final holdout.

The original target sign convention and units must be verified from dataset documentation before interpreting biological direction. The API returns regression values without a calibrated uncertainty interval. No clinical or experimental conclusions are established by this software scaffold.

## Current practical training run

The uploaded dataset has 100,537 rows, 168 columns and 146 tier-C input descriptors (LIG 18, MUT 12, ENV 21, PLIP 6, VINA 59, P2/P2dl/P2dp 30). The `practical-v1` runner uses 80,429 development rows and 20,108 locked test rows, with candidate selection on a 15,000-row development-only subset. Final estimators fit all development rows. Preprocessing and supervised feature selection are inside each candidate pipeline, then refitted on development data for the final estimator.

This is a bounded alternative to the original notebook searches. It uses standardized OLS/Ridge for LR, bounded depth/leaf tuning for DT and 120-tree final RF models. Full notebook Yeo-Johnson transformations, broad regularization searches, pruning and RF refinement were not run in this profile. Metadata explicitly records the profile and parameters.

See results/training_status.json and results/final/all_models_comparison.csv for completed runs and measured results. Software tests use separate temporary synthetic fixtures; those results never enter research metrics. The random row holdout does not demonstrate generalization to unseen proteins/drugs. XGBoost, grouped validation and calibrated uncertainty remain pending.
