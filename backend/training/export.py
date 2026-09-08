"""Export a completed notebook namespace without refitting its estimators."""
import hashlib
import json
import platform
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from backend.app.services.notebook_model import NotebookModel

TRACKS = {"linear_regression": "LR", "decision_tree": "DT", "random_forest": "RF"}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def export_track(namespace, algorithm, root):
    if algorithm not in TRACKS:
        raise ValueError("Only uploaded LR, DT and RF tracks are supported")
    root = Path(root)
    ns = namespace
    track = TRACKS[algorithm]
    data_path = Path(ns["DATA_PATH"])
    dataset_hash = hashlib.sha256(data_path.read_bytes()).hexdigest()
    split_hash = hashlib.sha256(np.asarray(ns["test_idx"], dtype=np.int64).tobytes()).hexdigest()
    prepared = []
    for letter in "ABC":
        variant = "model_" + letter
        raw = ns[letter + "_FEATURES"]
        keep = ns[letter + "_KEEP"]
        if algorithm == "linear_regression":
            estimator = ns["A_model" if letter == "A" else letter + "_best_model"]
        elif algorithm == "decision_tree":
            estimator = ns[letter + "_final"]
        else:
            estimator = ns[letter + "_best"]
        standalone_imputer = algorithm == "decision_tree" or (algorithm == "linear_regression" and letter == "A") or (algorithm == "random_forest" and letter == "C")
        model = NotebookModel(
            algorithm, variant, raw, keep, estimator,
            imputer=ns[letter + "_imputer"] if standalone_imputer else None,
            scaler=ns["A_scaler"] if algorithm == "linear_regression" and letter == "A" else None,
            selected_features=ns["C_SELECTED"] if letter == "C" and algorithm != "linear_regression" else None,
        )
        raw_frame = ns["df_clean"][raw].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
        test_frame = raw_frame.iloc[ns["test_idx"]]
        predicted = model.predict(test_frame)
        np.testing.assert_allclose(predicted, ns[letter + "_test_pred"], rtol=1e-7, atol=1e-8,
                                   err_msg=f"{track} {letter}: export differs from notebook prediction")
        metrics = {k: float(v) if np.isfinite(v) else None for k, v in ns[letter + "_result"].items()}
        prepared.append((letter, model, raw_frame, test_frame, predicted, metrics))
    # Verify all three models before replacing any model artifacts.
    rows = []
    for letter, model, raw_frame, test_frame, predicted, metrics in prepared:
        directory = root / "models" / algorithm / ("model_" + letter)
        directory.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, directory / "model.joblib")
        write_json(directory / "features.json", model.raw_features)
        write_json(directory / "metrics.json", metrics)
        write_json(directory / "metadata.json", {
            "algorithm": algorithm, "variant": "model_" + letter, "target": ns["TARGET"],
            "seed": int(ns["SEED"]), "dataset_sha256": dataset_hash, "test_split_sha256": split_hash,
            "python": platform.python_version(), "sklearn": sklearn.__version__,
            "kept_features": model.kept_features, "selected_features": model.selected_features,
            "estimator": type(model.model).__name__, "input": "raw numeric descriptors; null allowed",
        })
        sample = test_frame.iloc[0].to_dict()
        sample = {k: None if pd.isna(v) else float(v) for k, v in sample.items()}
        write_json(directory / "sample_input.json", {"algorithm": algorithm, "variant": "model_" + letter, "features": sample})
        processed = root / "data" / "processed" / ("model_" + letter + "_features.csv")
        processed.parent.mkdir(parents=True, exist_ok=True)
        raw_frame.assign(**{ns["TARGET"]: ns["y"].to_numpy()}).to_csv(processed, index=False)
        predictions = pd.DataFrame({"row_index": ns["test_idx"], "Actual": np.asarray(ns["y_test"]), "Predicted": predicted})
        if "SAMPLE_ID" in ns["df_clean"]:
            predictions["SAMPLE_ID"] = ns["df_clean"].iloc[ns["test_idx"]]["SAMPLE_ID"].values
        predictions["Residual"] = predictions["Actual"] - predictions["Predicted"]
        output = root / "results" / "predictions"
        output.mkdir(parents=True, exist_ok=True)
        predictions.to_csv(output / f"{track}_Model_{letter}_predictions.csv", index=False)
        save_plots(root, track, letter, predictions, model)
        rows.append({"Algorithm": algorithm, "Model": letter, **metrics, "dataset_sha256": dataset_hash, "test_split_sha256": split_hash})
    metrics_dir = root / "results" / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(metrics_dir / f"{track}_results.csv", index=False)
    # Compare only tracks evaluated on identical data and test rows.
    tables = []
    for name in TRACKS.values():
        path = metrics_dir / f"{name}_results.csv"
        if path.exists() and path.stat().st_size:
            table = pd.read_csv(path)
            if {"dataset_sha256", "test_split_sha256"}.issubset(table.columns):
                tables.append(table[(table.dataset_sha256 == dataset_hash) & (table.test_split_sha256 == split_hash)])
    final = root / "results" / "final"
    final.mkdir(parents=True, exist_ok=True)
    comparison = pd.concat(tables, ignore_index=True)
    comparison.to_csv(final / "all_models_comparison.csv", index=False)
    sample_path = root / "data" / "sample" / "demo_input.csv"
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    prepared[-1][3].head(1).to_csv(sample_path, index=False)
    print(f"Exported {track} A/B/C with prediction parity verified. XGBoost remains pending.")
    return comparison


def save_plots(root, track, letter, predictions, model):
    import matplotlib.pyplot as plt
    from sklearn.tree import plot_tree
    for category in ("actual_vs_predicted", "residuals", "feature_importance", "decision_trees"):
        (root / "results" / "plots" / category).mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.scatter(predictions.Actual, predictions.Predicted, s=10, alpha=.35)
    limits = [min(predictions.Actual.min(), predictions.Predicted.min()), max(predictions.Actual.max(), predictions.Predicted.max())]
    ax.plot(limits, limits, "--", color="gray")
    ax.set(xlabel="Actual DDG.EXP", ylabel="Predicted DDG.EXP", title=f"{track} Model {letter}: locked test")
    fig.tight_layout()
    fig.savefig(root / "results" / "plots" / "actual_vs_predicted" / f"{track}_{letter}.png", dpi=150)
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.scatter(predictions.Predicted, predictions.Residual, s=10, alpha=.35)
    ax.axhline(0, linestyle="--", color="gray")
    ax.set(xlabel="Predicted DDG.EXP", ylabel="Actual minus predicted", title=f"{track} Model {letter}: residuals")
    fig.tight_layout()
    fig.savefig(root / "results" / "plots" / "residuals" / f"{track}_{letter}.png", dpi=150)
    plt.close(fig)
    core = model.model.named_steps["model"] if hasattr(model.model, "named_steps") else model.model
    names = model.selected_features or model.kept_features
    if hasattr(core, "feature_importances_") and len(core.feature_importances_) == len(names):
        importance = pd.Series(core.feature_importances_, index=names).nlargest(20).sort_values()
        fig, ax = plt.subplots(figsize=(8, 6))
        importance.plot.barh(ax=ax)
        ax.set(title=f"{track} Model {letter}: impurity importance", xlabel="Importance")
        fig.tight_layout()
        fig.savefig(root / "results" / "plots" / "feature_importance" / f"{track}_{letter}.png", dpi=150)
        plt.close(fig)
    if track == "DT":
        fig, ax = plt.subplots(figsize=(20, 9))
        plot_tree(core, feature_names=names, max_depth=3, filled=True, ax=ax, fontsize=7)
        ax.set_title(f"DT Model {letter}: first three levels")
        fig.savefig(root / "results" / "plots" / "decision_trees" / f"{track}_{letter}.png", dpi=150, bbox_inches="tight")
        plt.close(fig)
