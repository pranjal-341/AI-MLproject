# GitHub publication and research assets

## Before the first push

The raw dataset is approximately 115 MB. GitHub rejects ordinary Git files larger than 100 MiB; use Git LFS or external research artifact storage. See [GitHub's large-file documentation](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

The root `.gitattributes` assigns model binaries and raw/processed CSVs to LFS. Installing rules does not retroactively convert files that were already staged or committed.

For new files or a first commit, run from the repository root:

```sh
git lfs install
git add .gitattributes
git add --renormalize models data/raw data/processed
git lfs status
git lfs ls-files
git status
```

Review your staged changes before committing. These commands intentionally limit renormalization to research assets; they do not delete your local data. If a path is still untracked, use `git add <path>` after enabling LFS. Check `git show :data/raw/MdrDB_Full_Scraped.csv` only after conversion: it should show a short LFS pointer, not the full CSV.

If the large blob is already in an earlier commit, a later LFS commit does not remove it from the history GitHub receives. Inspect the failed push before deciding how to migrate unpublished history. This repository is connected to Lovable: do not rewrite or force-push published history. No history migration, commit, or push is performed by the configuration changes in this task.

## Keep credentials private

`.gitignore` excludes `.env`, `.env.local`, Python environments, and deployment output. Commit only `.env.example` templates. Review filenames with:

```sh
git ls-files .env frontend/.env frontend/.env.local
git diff --cached --stat
```

The first command should print no files. Do not paste token-bearing diffs, passwords, Supabase secret keys, or Vercel credentials into issues or screenshots. If a secret was already published, remove it from active configuration and rotate it through the provider.

## Prepare a research release

- Keep the README's metrics aligned with the released artifacts and report CSVs.
- Include the dataset version/hash, split hash, training profile, software versions, and evaluation limitations.
- Preserve attribution to MdrDB and verify redistribution terms for the dataset and all third-party assets.
- Select an explicit code license before describing the project as open source; none is assigned by this setup.
- Keep full training searches and large result bundles out of frontend builds. A release/archive or object store can also distribute those assets, subject to its terms and your storage quotas.
- After cloning with LFS, use `git lfs pull` on the backend/training machine to obtain the real files.

## Automated checks

`.github/workflows/checks.yml` runs frontend type checking and a Vercel-target build, plus backend fixture tests. CI deliberately does not download large trained artifacts, run training, publish a deployment, or access production authentication credentials. Real artifact parity is a separate local/release check:

```sh
python -m backend.training.verify
```
