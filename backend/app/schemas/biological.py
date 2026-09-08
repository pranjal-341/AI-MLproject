import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class BiologicalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    protein_id: str = Field(min_length=4, max_length=20)
    mutation: str = Field(min_length=3, max_length=120)
    drug_type: Literal["pubchem_cid", "smiles"] = "pubchem_cid"
    drug: str = Field(min_length=1, max_length=5000)
    pdb_id: str | None = Field(default=None, max_length=20)
    chain_id: str | None = Field(default=None, max_length=10)
    sample_id: str | None = Field(default=None, max_length=40)
    algorithm: Literal["linear_regression", "decision_tree", "random_forest", "xgboost"] = "random_forest"
    variant: Literal["model_A", "model_B", "model_C"] = "model_A"
    model_version: str | None = None

    @model_validator(mode="after")
    def validate_identity(self):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", self.protein_id):
            raise ValueError("Use a PDB or UniProt accession, not a protein name")
        if self.drug_type == "pubchem_cid" and (not self.drug.isascii() or not self.drug.isdigit() or not 0 < int(self.drug) < 10**12):
            raise ValueError("Drug must be a positive PubChem CID; select SMILES for a chemical structure string")
        return self
