"""Authentication configuration lives in backend.app.core.config.

Supabase Auth manages accounts in its auth.users table. Do not create a
separate password table or store the MdrDB training dataset in Auth.
The backend validates user tokens in backend.app.core.auth.require_user.
"""
