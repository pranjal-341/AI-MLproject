"""Portable inference for the uploaded LR, DT and RF notebooks."""
import numpy as np
import pandas as pd


def engineer_features(frame, variant, algorithm):
    x = frame.copy()
    plip = [c for c in x if c.startswith("PLIP.")]
    vina = [c for c in x if c == "vina" or (c.startswith("vina") and c[4:].isdigit())]
    if variant == "model_B":
        x["FE.PLIPTotal"] = x[plip].sum(axis=1, min_count=1)
        x["FE.PLIPMean"] = x[plip].mean(axis=1)
        x["FE.PLIPStd"] = x[plip].std(axis=1)
        x["FE.PLIPActive"] = (x[plip] > 0).sum(axis=1)
        if algorithm != "linear_regression" and "LIG.MolWt" in x:
            x["FE.PLIPPerMolWt"] = x["FE.PLIPTotal"] / x["LIG.MolWt"].replace(0, np.nan)
    elif variant == "model_C":
        x["FE.PLIPTotal"] = x[plip].sum(axis=1, min_count=1)
        for label, method in [("Mean", "mean"), ("Std", "std"), ("Min", "min"), ("Max", "max"), ("Median", "median")]:
            x["FE.Vina" + label] = getattr(x[vina], method)(axis=1)
        x["FE.VinaRange"] = x["FE.VinaMax"] - x["FE.VinaMin"]
        for prefix in ("P2", "P2dl", "P2dp"):
            columns = [c for c in frame if c.startswith(prefix + ".")]
            if columns:
                x["FE." + prefix + "Total"] = x[columns].sum(axis=1, min_count=1)
        if "FE.P2dlTotal" in x and "FE.P2dpTotal" in x:
            x["FE.P2Contrast"] = x["FE.P2dlTotal"] - x["FE.P2dpTotal"]
    return x.replace([np.inf, -np.inf], np.nan)


class NotebookModel:
    """Retain fitted preprocessing, full imputer order, and selected feature order."""
    def __init__(self, algorithm, variant, raw_features, kept_features, model,
                 imputer=None, scaler=None, selected_features=None):
        self.algorithm = algorithm
        self.variant = variant
        self.raw_features = list(raw_features)
        self.kept_features = list(kept_features)
        self.model = model
        self.imputer = imputer
        self.scaler = scaler
        self.selected_features = selected_features

    def predict(self, frame):
        x = engineer_features(frame.loc[:, self.raw_features], self.variant, self.algorithm)
        x = x.loc[:, self.kept_features]
        for transformer in (self.imputer, self.scaler):
            if transformer is not None:
                x = pd.DataFrame(transformer.transform(x), columns=self.kept_features, index=x.index)
        if self.selected_features is not None:
            x = x.loc[:, self.selected_features]
        return self.model.predict(x)
