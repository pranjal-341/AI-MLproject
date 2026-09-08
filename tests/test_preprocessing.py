import pytest
from backend.app.services.preprocessing import prepare_features

def test_orders_features():
    frame = prepare_features({"b": 2, "a": 1}, ["a", "b"])
    assert list(frame.columns) == ["a", "b"]
    assert frame.values.tolist() == [[1, 2]]

@pytest.mark.parametrize("values", [{"a": 1}, {"a": 1, "b": 2, "c": 3}, {"a": float("nan"), "b": 2}])
def test_rejects_invalid_features(values):
    with pytest.raises(ValueError):
        prepare_features(values, ["a", "b"])
