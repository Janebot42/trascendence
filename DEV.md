# Developer Guide

## Purpose

This backend is a modular monolith for a Transcendence-style project. It focuses on users, password authentication, server-side sessions, optional TOTP 2FA, recovery codes and simple role-based authorization.

The project intentionally avoids JWT as the main auth mechanism, OAuth, social login, microservices, CQRS, event sourcing and advanced ACLs. Those are not needed for the current problem.

## Stack

- Node.js + TypeScript.
- Fastify for HTTP.
- PostgreSQL for persistence.
- `pg` for database access.
- `zod` for request validation.
- Node `scrypt` for password hashing.
- `otplib` for TOTP.
- Server-side sessions with secure cookies.

The project can also run in memory when `DATABASE_URL` is not configured or when `NODE_ENV=test`. This keeps tests fast and makes local experimentation easy.

## Module Boundaries

The code is split by backend domain, not by technical layer alone.

```text
src/modules/
  users/
  auth/
  sessions/
  two_factor/
  authorization/
```

### `users`

Owns user identity and profile-like data:

- username
- email
- display name
- role
- status

It does not own passwords, sessions or 2FA.

### `auth`

Owns authentication use cases:

- register
- login
- login challenge for 2FA
- complete 2FA login
- reauthentication
- change password

It orchestrates `users`, `sessions` and `two_factor`, but does not directly implement TOTP internals or session cookie details.

### `sessions`

Owns server-side sessions:

- create session
- read session from opaque token
- revoke session
- revoke other sessions
- mark session as recently reauthenticated

The browser receives only an opaque cookie. The database stores only a hash of that token.

### `two_factor`

Owns TOTP and recovery codes:

- generate TOTP secret
- encrypt TOTP secret
- generate provisioning URI
- verify TOTP code
- generate recovery codes
- hash recovery codes
- consume recovery code once
- disable 2FA

### `authorization`

Owns request guards:

- `requireAuth`
- `requireRole`
- `currentUser` request decoration

Current roles are intentionally simple:

```text
user
admin
```

## Request Flow

### Register

1. Validate username, email and password.
2. Create user.
3. Hash password.
4. Store password credential separately from user.
5. Create final session.
6. Send session cookie.

### Login without 2FA

1. Validate username and password.
2. Check user is active.
3. Verify password hash.
4. If 2FA is disabled, create final session.
5. Send session cookie.

### Login with 2FA

1. Validate username and password.
2. Detect that 2FA is enabled.
3. Create a short-lived `login_challenge`.
4. Return `requires_2fa`.
5. Do not create a session yet.
6. User submits TOTP or recovery code.
7. Verify second factor.
8. Consume challenge.
9. Create final session.
10. Send session cookie.

This is a hard security invariant: no final session exists before 2FA is complete.

### Activate 2FA

1. User must be authenticated.
2. User must recently reauthenticate.
3. Backend generates a TOTP secret.
4. Secret is encrypted before storage.
5. Backend returns provisioning URI and manual secret.
6. User enters the secret in an authenticator app.
7. User confirms with a TOTP code.
8. Backend enables TOTP.
9. Backend generates recovery codes.
10. Recovery codes are shown once and stored hashed.

### Disable 2FA

1. User must be authenticated.
2. User must strongly reauthenticate.
3. If 2FA is enabled, strong reauth means password plus TOTP or recovery code.
4. Backend deletes the TOTP method.
5. Backend invalidates old recovery codes.
6. Backend revokes other sessions.

The current session is kept. Other sessions are revoked because disabling 2FA reduces account security.

## Data Model

The base migration is:

```text
db/migrations/001_auth_base.sql
```

Main tables:

```text
users
password_credentials
sessions
login_challenges
two_factor_totp
recovery_codes
```

The migration is idempotent and runs on startup when PostgreSQL is enabled.

## Environment

Create `.env` from `.env.example`.

Required:

```env
TOTP_ENCRYPTION_KEY_BASE64=...
```

Generate it with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Optional PostgreSQL:

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/transcendence
```

When `DATABASE_URL` is missing, repositories run in memory.

## Running Locally

Install dependencies:

```powershell
npm install
```

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

Compile:

```powershell
node .\node_modules\typescript\bin\tsc -p tsconfig.json
```

Start:

```powershell
npm start
```

Health check:

```powershell
curl.exe http://127.0.0.1:3000/health
```

Manual UI:

```text
http://127.0.0.1:3000/
```

## Testing

Run:

```powershell
node .\node_modules\typescript\bin\tsc -p tsconfig.json
node --test tests\integration\*.test.mjs
```

The tests run with `NODE_ENV=test`, so they use in-memory repositories and do not require PostgreSQL.

Current integration coverage includes:

- register
- login
- authenticated `/me`
- logout
- invalid credentials
- protected route without cookie
- admin route forbidden for normal user
- TOTP setup
- TOTP login
- recovery code login
- recovery code one-use behavior
- password change with reauthentication
- revocation of other sessions
- disabling 2FA with strong reauthentication
- static manual UI routes

## Manual Test UI

The manual UI lives in:

```text
public/
src/ui/
```

It is intentionally framework-free. It calls the same backend endpoints as a real frontend would and uses browser cookies.

Use it to test:

- create account
- login
- logout
- refresh `/me`
- reauthenticate
- activate 2FA
- confirm TOTP with Google Authenticator
- login with TOTP
- login with recovery code
- disable 2FA
- change password

The UI is a testing aid, not a production frontend.

## Security Decisions

### Sessions

Sessions are server-side. The cookie contains an opaque token.

Cookie settings:

```text
HttpOnly
Secure in production
SameSite=Lax
Path=/
```

The database stores only `sha256(token)`, not the raw token.

### Passwords

Passwords are hashed with Node `scrypt`.

Argon2id would also be a good choice, but it requires native build support. `scrypt` avoids that friction while remaining a strong password hashing option for this project stage.

### TOTP Secrets

TOTP secrets are encrypted at rest with AES-256-GCM. The encryption key comes from:

```env
TOTP_ENCRYPTION_KEY_BASE64
```

Never commit `.env`.

### Recovery Codes

Recovery codes are:

- generated only after TOTP confirmation
- shown once
- stored hashed
- consumed immediately on use
- invalidated when 2FA is disabled or regenerated

### Reauthentication

Sensitive actions require recent reauthentication.

Current window:

```text
10 minutes
```

If 2FA is enabled, reauthentication requires:

```text
password + TOTP
```

or:

```text
password + recovery code
```

## PostgreSQL Queries

List users:

```powershell
docker compose exec postgres psql -U postgres -d transcendence -c "select id, username, email, role, status, created_at from users order by created_at desc;"
```

List sessions:

```powershell
docker compose exec postgres psql -U postgres -d transcendence -c "select id, user_id, created_at, expires_at, revoked_at from sessions order by created_at desc;"
```

List TOTP records:

```powershell
docker compose exec postgres psql -U postgres -d transcendence -c "select user_id, enabled_at, confirmed_at, created_at from two_factor_totp order by created_at desc;"
```

List recovery code status:

```powershell
docker compose exec postgres psql -U postgres -d transcendence -c "select user_id, used_at, replaced_at, created_at from recovery_codes order by created_at desc;"
```

## Adding New Features

Follow these rules:

- Keep profile data in `users`.
- Keep login/password/session orchestration in `auth`.
- Keep cookie and session lifecycle in `sessions`.
- Keep TOTP/recovery internals in `two_factor`.
- Keep route access rules in `authorization`.

Do not put password hashes in `users`.
Do not create sessions before 2FA is complete.
Do not return session tokens in JSON.
Do not store recovery codes in plain text.
Do not add JWT unless there is a concrete reason.

## Known Limitations

- No email verification.
- No password reset flow.
- No account lockout policy beyond simple in-memory rate limiting.
- No CSRF token layer yet.
- No production migration runner with migration history table.
- No admin UI.

These are acceptable for the current base. The next most useful backend improvements would be:

1. Add a real migration runner.
2. Add CSRF protection if the frontend is cookie-based and browser-facing.
3. Add password reset.
4. Add email verification.
5. Improve rate limiting with Redis or PostgreSQL-backed counters.

