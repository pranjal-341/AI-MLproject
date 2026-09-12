import ast
import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from backend.app.main import app
from backend.app.core import config
from backend.app.services.notebook_model import engineer_features
from backend.training import export

ROOT = Path(__file__).resolve().parents[2]
ALGORITHMS = {"linear_regression": "02_linear_regression", "decision_tree": "03_decision_tree", "random_forest": "04_random_forest"}


def frame():
    rng = np.random.default_rng(42)
    x = pd.DataFrame(rng.uniform(1, 8, (20, 11)), columns=["LIG.MolWt", "MUT.a", "ENV.a", "PLIP.a", "PLIP.b", "vina", "vina1", "vina2", "P2.a", "P2dl.a", "P2dp.a"])
    x.loc[1, "PLIP.a"] = np.nan
    x.loc[2, "LIG.MolWt"] = 0
    return x


@pytest.mark.parametrize("algorithm", ALGORITHMS)
@pytest.mark.parametrize("letter", ["B", "C"])
def test_engineering_matches_uploaded_notebook(algorithm, letter):
    notebook = json.loads(next((ROOT / "notebooks" / ALGORITHMS[algorithm]).glob("*.ipynb")).read_text(encoding="utf-8"))
    code = next("".join(c["source"]) for c in notebook["cells"] if "def add_" + letter + "_features" in "".join(c["source"]))
    x = frame()
    ns = {"np": np, "PLIP": [c for c in x if c.startswith("PLIP.")], "VINA": ["vina", "vina1", "vina2"], "P2": ["P2.a", "P2dl.a", "P2dp.a"]}
    exec(compile(ast.parse(code), "notebook_feature_function", "exec"), ns)
    expected = ns["add_" + letter + "_features"](x).replace([np.inf, -np.inf], np.nan)
    actual = engineer_features(x, "model_" + letter, algorithm)
    pd.testing.assert_frame_equal(actual[expected.columns], expected)


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_export_preserves_preprocessing_and_api_predictions(authenticated_user, tmp_path, monkeypatch, algorithm):
    x = frame()
    y = pd.Series(np.arange(len(x), dtype=float))
    source = tmp_path / "dataset.csv"
    x.assign(**{"DDG.EXP": y}).to_csv(source, index=False)
    ns = {"df_clean": x, "y": y, "y_test": y.iloc[15:], "test_idx": np.arange(15,20), "TARGET": "DDG.EXP", "SEED": 42, "DATA_PATH": source}
    for letter in "ABC":
        raw = [c for c in x if letter == "C" or (not c.startswith(("vina", "P2")) and (letter == "B" or not c.startswith("PLIP.")))]
        engineered = engineer_features(x[raw], "model_" + letter, algorithm)
        keep = list(engineered.columns)
        ns[letter + "_FEATURES"] = raw
        ns[letter + "_KEEP"] = keep
        standalone = algorithm == "decision_tree" or (algorithm == "linear_regression" and letter == "A") or (algorithm == "random_forest" and letter == "C")
        estimator = LinearRegression() if algorithm == "linear_regression" else DecisionTreeRegressor(max_depth=3, random_state=42) if algorithm == "decision_tree" else RandomForestRegressor(n_estimators=3, random_state=42)
        if standalone:
            imputer = SimpleImputer(strategy="median").fit(engineered.iloc[:15])
            ns[letter + "_imputer"] = imputer
            values = pd.DataFrame(imputer.transform(engineered), columns=keep)
            if algorithm == "linear_regression":
                scaler = StandardScaler().fit(values.iloc[:15])
                ns["A_scaler"] = scaler
                values = pd.DataFrame(scaler.transform(values), columns=keep)
            if letter == "C":
                # Force selected features to differ from imputer inputs and ordering.
                ns["C_SELECTED"] = keep[::-2]
                values = values[ns["C_SELECTED"]]
            estimator.fit(values.iloc[:15], y.iloc[:15])
            predicted = estimator.predict(values.iloc[15:])
        else:
            estimator = Pipeline([("imputer", SimpleImputer()), ("model", estimator)]).fit(engineered.iloc[:15], y.iloc[:15])
            predicted = estimator.predict(engineered.iloc[15:])
        key = ("A_model" if letter == "A" else letter + "_best_model") if algorithm == "linear_regression" else letter + ("_final" if algorithm == "decision_tree" else "_best")
        ns[key] = estimator
        ns[letter + "_test_pred"] = predicted
        ns[letter + "_result"] = {"R2": -.5, "RMSE": 2., "Pearson": np.nan}
    monkeypatch.setattr(export, "save_plots", lambda *args: None)
    export.export_track(ns, algorithm, tmp_path)
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path / "models")
    client = TestClient(app)
    for letter in "ABC":
        directory = tmp_path / "models" / algorithm / ("model_" + letter)
        request = json.loads((directory / "sample_input.json").read_text())
        response = client.post("/api/predict", json=request)
        assert response.status_code == 200, response.text
        assert response.json()["prediction"] == pytest.approx(ns[letter + "_test_pred"][0])
        request["features"][next(iter(request["features"]))] = None
        assert client.post("/api/predict", json=request).status_code == 200
        assert json.loads((directory / "metrics.json").read_text())["Pearson"] is None
    comparison = pd.read_csv(tmp_path / "results/final/all_models_comparison.csv")
    assert len(comparison) == 3
    assert not (tmp_path / "models/xgboost").exists()


def test_notebooks_compile():
    for folder in ALGORITHMS.values():
        notebook = json.loads(next((ROOT / "notebooks" / folder).glob("*.ipynb")).read_text(encoding="utf-8"))
        for cell in notebook["cells"]:
            if cell["cell_type"] == "code":
                compile("".join(cell["source"]), folder, "exec")
