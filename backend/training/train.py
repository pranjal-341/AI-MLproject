"""Practical full-data training using a bounded development-only tuning search.

This is a reproducible practical profile, not a claim to have run the original
notebooks' exhaustive searches. Run backend.training.run for those searches.
"""
import argparse
import json
import os
from pathlib import Path
import time
import numpy as np
import pandas as pd
from scipy.stats import pearsonr, spearmanr
from sklearn.base import clone
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import SelectFromModel
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from backend.app.services.notebook_model import engineer_features
from backend.training.export import export_track, write_json

ROOT = Path(__file__).resolve().parents[2]
SEED = 42
TARGET = "DDG.EXP"


def metrics(y, prediction):
    return {"R2": r2_score(y, prediction), "RMSE": float(np.sqrt(mean_squared_error(y, prediction))),
            "MAE": mean_absolute_error(y, prediction), "Pearson": pearsonr(y, prediction).statistic,
            "Spearman": spearmanr(y, prediction).statistic}


def pipeline_for(algorithm, letter, jobs):
    steps = [("imputer", SimpleImputer(strategy="median", keep_empty_features=True))]
    if algorithm == "linear_regression":
        steps.append(("scaler", StandardScaler()))
        core = LinearRegression() if letter == "A" else Ridge()
    else:
        if letter == "C":
            probe = DecisionTreeRegressor(max_depth=10, min_samples_leaf=10, random_state=SEED) if algorithm == "decision_tree" else RandomForestRegressor(n_estimators=32, max_depth=12, min_samples_leaf=5, n_jobs=jobs, random_state=SEED)
            steps.append(("select", SelectFromModel(probe, threshold="median")))
        core = DecisionTreeRegressor(random_state=SEED) if algorithm == "decision_tree" else RandomForestRegressor(n_estimators=48, max_features=.7, min_samples_leaf=3, n_jobs=jobs, random_state=SEED)
    return Pipeline(steps + [("model", core)])


def train(algorithms, jobs=2):
    data_path = ROOT / "data/raw/MdrDB_Full_Scraped.csv"
    df = pd.read_csv(data_path, low_memory=False)
    y = pd.to_numeric(df[TARGET], errors="coerce")
    valid = y.notna() & np.isfinite(y)
    df = df.loc[valid].reset_index(drop=True)
    y = y.loc[valid].reset_index(drop=True)
    dev_idx, test_idx = train_test_split(np.arange(len(df)), test_size=.2, random_state=SEED)
    tune_idx = np.random.default_rng(SEED).choice(dev_idx, size=min(15000, len(dev_idx)), replace=False)
    fit_idx, val_idx = train_test_split(tune_idx, test_size=.25, random_state=SEED)
    family = {p: [c for c in df if c.startswith(p + ".")] for p in ["LIG", "MUT", "ENV", "PLIP", "P2", "P2dl", "P2dp"]}
    vina = [c for c in df if c == "vina" or (c.startswith("vina") and c[4:].isdigit())]
    features = {"A": family["LIG"] + family["MUT"] + family["ENV"]}
    features["B"] = features["A"] + family["PLIP"]
    features["C"] = features["B"] + vina + family["P2"] + family["P2dl"] + family["P2dp"]
    for letter, names in features.items():
        if not names: raise ValueError(f"No features for tier {letter}")
    status_path = ROOT / "results/training_status.json"
    report = {"profile": "practical-v1", "rows": len(df), "development_rows": len(dev_idx), "test_rows": len(test_idx), "tuning_rows": len(tune_idx), "seed": SEED, "tracks": {}}
    write_json(status_path, report)
    for algorithm in algorithms:
        ns = {"DATA_PATH": data_path, "TARGET": TARGET, "SEED": SEED, "df_clean": df,
              "y": y, "y_test": y.iloc[test_idx], "test_idx": test_idx}
        choices = {}
        for letter in "ABC":
            started = time.time()
            print(f"{algorithm} {letter}: preparing {len(features[letter])} raw features", flush=True)
            raw = df[features[letter]].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
            engineered = engineer_features(raw, "model_" + letter, algorithm)
            # Keep all columns here; fit imputation and supervised selection inside each candidate.
            keep = list(engineered.columns)
            candidates = ([{}] if letter == "A" else [{"model__alpha": a} for a in [1., 10., 100.]]) if algorithm == "linear_regression" else ([{"model__max_depth": d, "model__min_samples_leaf": n} for d in [8, 14, 20] for n in [5, 20]] if algorithm == "decision_tree" else [{"model__max_depth": d} for d in [12, 18]])
            scored = []
            for parameters in candidates:
                candidate = pipeline_for(algorithm, letter, jobs).set_params(**parameters)
                candidate.fit(engineered.iloc[fit_idx], y.iloc[fit_idx])
                rmse = float(np.sqrt(mean_squared_error(y.iloc[val_idx], candidate.predict(engineered.iloc[val_idx]))))
                scored.append((rmse, parameters))
            rmse, best_parameters = min(scored, key=lambda item: item[0])
            best = pipeline_for(algorithm, letter, jobs).set_params(**best_parameters)
            if algorithm == "random_forest": best.set_params(model__n_estimators=120)
            print(f"{algorithm} {letter}: fitting all {len(dev_idx)} development rows; validation RMSE {rmse:.4f}", flush=True)
            best.fit(engineered.iloc[dev_idx], y.iloc[dev_idx])
            prediction = best.predict(engineered.iloc[test_idx])
            measured = metrics(y.iloc[test_idx], prediction)
            ns[letter + "_FEATURES"] = features[letter]
            ns[letter + "_KEEP"] = keep
            ns[letter + "_test_pred"] = prediction
            ns[letter + "_result"] = measured
            if algorithm == "linear_regression":
                if letter == "A":
                    ns.update(A_model=best.named_steps["model"], A_imputer=best.named_steps["imputer"], A_scaler=best.named_steps["scaler"])
                else: ns[letter + "_best_model"] = best
            elif algorithm == "decision_tree" or letter == "C":
                ns[letter + "_imputer"] = best.named_steps["imputer"]
                if letter == "C": ns["C_SELECTED"] = np.array(keep)[best.named_steps["select"].get_support()].tolist()
                ns[letter + ("_final" if algorithm == "decision_tree" else "_best")] = best.named_steps["model"]
            else: ns[letter + "_best"] = best
            choices[letter] = {"parameters": best_parameters, "validation_RMSE": rmse, "test_metrics": measured, "elapsed_seconds": round(time.time() - started, 2)}
            report["tracks"][algorithm] = {"state": "training", "tiers": choices}
            write_json(status_path, report)
            print(f"{algorithm} {letter}: test R2 {measured['R2']:.4f}; RMSE {measured['RMSE']:.4f}", flush=True)
        export_track(ns, algorithm, ROOT)
        for letter in "ABC":
            path = ROOT / "models" / algorithm / ("model_" + letter) / "metadata.json"
            metadata = json.loads(path.read_text())
            metadata.update(training_profile="practical-v1", tuning_rows=len(tune_idx), validation_rows=len(val_idx), development_rows=len(dev_idx), test_rows=len(test_idx), tuning=choices[letter], preprocessing="median imputation; StandardScaler for LR; median-importance selection for DT/RF C")
            write_json(path, metadata)
        report["tracks"][algorithm]["state"] = "exported"
        write_json(status_path, report)
    print("Requested training completed. XGBoost remains pending.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--track", choices=["linear_regression", "decision_tree", "random_forest", "all"], default="all")
    parser.add_argument("--jobs", type=int, default=2)
    args = parser.parse_args()
    if args.jobs < 1: parser.error("--jobs must be positive")
    os.environ.setdefault("MPLBACKEND", "Agg")
    train(["linear_regression", "decision_tree", "random_forest"] if args.track == "all" else [args.track], args.jobs)
