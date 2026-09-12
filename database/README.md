# Authentication and database ownership

Supabase Auth owns account records in its managed `auth.users` storage. The app does not implement a separate password database.

- Server configuration and token validation: [`backend/app/core/`](../backend/app/core/).
- Restricted authentication gateway: [`backend/app/api/auth.py`](../backend/app/api/auth.py).
- Browser Supabase adapter: [`frontend/src/integrations/supabase/`](../frontend/src/integrations/supabase/).
- Login/session UI: [`frontend/src/features/auth/`](../frontend/src/features/auth/).

`db.py` is an existing documentation-only compatibility note; it is not an active connection layer. Do not put the MdrDB CSV or model artifacts in the authentication database. Production variables and redirect configuration are described in the [deployment guide](../docs/DEPLOYMENT.md).
