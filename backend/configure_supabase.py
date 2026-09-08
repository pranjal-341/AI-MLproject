"""Copy only the root project's public Supabase settings into frontend/.env.local."""
from pathlib import Path
from dotenv import dotenv_values, set_key


def main():
    root = Path(__file__).resolve().parents[1]
    values = dotenv_values(root / ".env")
    url = values.get("SUPABASE_URL") or values.get("SUPERBASE_URL")
    key = values.get("SUPABASE_PUBLISHABLE_KEY") or values.get("SUPERBASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise SystemExit("Add SUPABASE_PUBLISHABLE_KEY for the root Supabase project to .env, then run this command again.")
    if not url.startswith("https://") or not key.startswith("sb_publishable_"):
        raise SystemExit("Expected an HTTPS Supabase URL and an sb_publishable_ public key. Never use a secret key in the frontend.")
    path = root / "frontend/.env.local"
    path.touch(exist_ok=True)
    for name, value in {"VITE_AUTH_PROXY": "false", "VITE_SUPABASE_URL": url, "VITE_SUPABASE_PUBLISHABLE_KEY": key, "SUPABASE_URL": url, "SUPABASE_PUBLISHABLE_KEY": key, "VITE_API_BASE_URL": "http://127.0.0.1:8000"}.items():
        set_key(path, name, value)
    print("Frontend public Supabase settings synchronized. Restart frontend and backend.")


if __name__ == "__main__":
    main()
