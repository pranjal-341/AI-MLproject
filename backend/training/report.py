"""Generate charts and a concise report from completed, matching model exports."""
from pathlib import Path
import os
os.environ.setdefault("MPLBACKEND", "Agg")
import pandas as pd
import matplotlib.pyplot as plt
import joblib


def main():
    root = Path(__file__).resolve().parents[2]
    table = pd.read_csv(root / "results/final/all_models_comparison.csv")
    output = root / "results/plots/comparison"
    output.mkdir(parents=True, exist_ok=True)
    colors = ["#21877b", "#86bcb3", "#d3a45e"]
    for metric, ylabel in [("R2", "Locked-test R squared"), ("RMSE", "Locked-test RMSE (dataset target units)")]:
        pivot = table.pivot(index="Algorithm", columns="Model", values=metric).reindex(["linear_regression", "decision_tree", "random_forest"])
        pivot.index = ["Linear regression", "Decision tree", "Random forest"]
        fig, ax = plt.subplots(figsize=(9, 5))
        pivot.plot.bar(ax=ax, color=colors, rot=0, width=.72)
        ax.set(xlabel="", ylabel=ylabel, title="OncoBind-ML: practical training profile")
        ax.legend(title="Feature tier", frameon=False)
        ax.spines[["top", "right"]].set_visible(False)
        for container in ax.containers: ax.bar_label(container, fmt="%.3f", fontsize=8, padding=3)
        ax.margins(y=.18)
        fig.tight_layout()
        fig.savefig(output / f"all_models_{metric}.png", dpi=170)
        plt.close(fig)
    for letter in "ABC":
        artifact = root / "models/linear_regression" / ("model_" + letter) / "model.joblib"
        model = joblib.load(artifact)
        core = model.model.named_steps["model"] if hasattr(model.model, "named_steps") else model.model
        if len(core.coef_) != len(model.kept_features):
            continue
        coefficients = pd.Series(core.coef_, index=model.kept_features)
        top = coefficients.loc[coefficients.abs().nlargest(20).index].sort_values()
        fig, ax = plt.subplots(figsize=(9, 6))
        top.plot.barh(ax=ax, color=["#21877b" if value < 0 else "#d3a45e" for value in top])
        ax.set(title=f"LR Model {letter}: standardized coefficients", xlabel="Coefficient (practical profile)")
        fig.tight_layout()
        fig.savefig(root / "results/plots/feature_importance" / f"LR_{letter}.png", dpi=150)
        plt.close(fig)
    lines = ["# Completed model evaluation", "", "Profile: practical-v1. Seed: 42. Random split: 80,429 development rows and 20,108 locked-test rows.", "", "| Algorithm | Tier | R2 | RMSE | MAE |", "| --- | --- | ---: | ---: | ---: |"]
    for _, row in table.iterrows():
        lines.append(f"| {row.Algorithm} | {row.Model} | {row.R2:.4f} | {row.RMSE:.4f} | {row.MAE:.4f} |")
    lines += ["", "The test set was not used for candidate selection. Candidates were chosen on an internal development validation split; final estimators were refit on all development rows.", "", "These scores describe random-row holdout performance. They do not establish generalization to unseen proteins or drugs. The original exhaustive notebook searches, grouped validation, calibrated uncertainty, and XGBoost are not included.", "", "Full metrics: results/final/all_models_comparison.csv. Training details: results/training_status.json and model metadata.json files."]
    (root / "results/final/model_evaluation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(table[["Algorithm", "Model", "R2", "RMSE", "MAE"]].to_string(index=False))


if __name__ == "__main__": main()
