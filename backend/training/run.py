"""Run an uploaded notebook using the current Python environment."""
import argparse
import os
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("track", choices=["LR", "DT", "RF", "all"])
    parser.add_argument("--data", type=Path)
    parser.add_argument("--jobs", type=int, default=1)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    data = (args.data or root / "data/raw/MdrDB_Full_Scraped.csv").resolve()
    if not data.is_file() or data.stat().st_size == 0:
        parser.error(f"Dataset is missing or empty: {data}. Upload the real dataset before training.")
    if args.jobs < 1:
        parser.error("--jobs must be positive")
    import nbformat
    from nbclient import NotebookClient
    from jupyter_client import KernelManager
    tracks = {"LR": "02_linear_regression", "DT": "03_decision_tree", "RF": "04_random_forest"}
    os.environ["ONCOBIND_DATA_PATH"] = str(data)
    os.environ["ONCOBIND_N_JOBS"] = str(args.jobs)
    os.environ["MPLBACKEND"] = "Agg"
    for track, folder in tracks.items():
        if args.track not in (track, "all"):
            continue
        source = next((root / "notebooks" / folder).glob("*.ipynb"))
        notebook = nbformat.read(source, as_version=4)
        output = root / "results" / "executed_notebooks" / source.name
        output.parent.mkdir(parents=True, exist_ok=True)
        # Use this venv's Python even if the machine's default kernel differs.
        manager = KernelManager(kernel_name="python3")
        manager.kernel_spec.argv = [sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"]
        client = NotebookClient(notebook, km=manager, timeout=None, resources={"metadata": {"path": str(output.parent)}})
        print(f"Running {track}; full notebook tuning may take hours. Output: {output}", flush=True)
        try:
            client.execute()
        finally:
            nbformat.write(notebook, output)


if __name__ == "__main__":
    main()
