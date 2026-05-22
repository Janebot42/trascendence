# Transcendence Backend Base

Backend unico modular para usuarios, autenticacion, sesiones, 2FA TOTP y autorizacion por rol.

## Stack elegido

- Fastify para HTTP con poca magia y buen soporte de hooks.
- TypeScript estricto para contratos claros entre modulos.
- Cookies con sesiones de servidor; no JWT como mecanismo principal.
- `scrypt` de Node para passwords. Es un hash fuerte y evita dependencias nativas en Windows.
- TOTP con secretos cifrados y recovery codes hasheados.

## Modulos

- `users`: identidad, perfil minimo, rol y estado.
- `auth`: registro, login, challenges 2FA, reautenticacion y cambio de password.
- `sessions`: sesiones opacas de servidor y cookie segura.
- `two_factor`: TOTP, provisioning URI y recovery codes.
- `authorization`: `requireAuth` y `requireRole`.

## Arranque local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` desde `.env.example`.

3. Generar una clave para cifrar secretos TOTP:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

4. Ejecutar:

```bash
npm run build
npm start
```

## PostgreSQL local

El backend usa repositorios en memoria si `DATABASE_URL` no esta definida o si `NODE_ENV=test`.
Para persistencia real, levanta PostgreSQL:

```bash
docker compose up -d postgres
```

Configura `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/transcendence
```

Al arrancar, el backend ejecuta la migracion base idempotente de `db/migrations/001_auth_base.sql`.

## Estado actual

La app mantiene repositorios en memoria para tests y desarrollo sin base de datos. Con `DATABASE_URL`, usa PostgreSQL para usuarios, credenciales, sesiones, challenges 2FA, TOTP y recovery codes.

## Endpoints iniciales

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/login/2fa`
- `POST /auth/logout`
- `POST /auth/reauthenticate`
- `POST /auth/password/change`
- `POST /2fa/setup`
- `POST /2fa/confirm`
- `POST /2fa/recovery-codes/regenerate`
- `DELETE /2fa`
- `GET /me`
- `GET /admin/users`

## Notas de seguridad

- La sesion final solo se crea despues de completar 2FA.
- Los tokens de sesion y challenges se guardan hasheados.
- Los recovery codes se muestran una vez y se guardan hasheados.
- Desactivar 2FA revoca otras sesiones del usuario.
- Cambiar password revoca otras sesiones del usuario.
- Acciones sensibles requieren reautenticacion reciente.
