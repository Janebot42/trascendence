# Transcendence Backend Base

Backend unico modular para usuarios, autenticacion, sesiones, login OAuth 42, 2FA TOTP y autorizacion por rol.

## Stack elegido

- Fastify para HTTP con poca magia y buen soporte de hooks.
- TypeScript estricto para contratos claros entre modulos.
- Prisma ORM para persistencia tipada.
- SQLite como base de datos local por defecto.
- Cookies con sesiones de servidor; no JWT como mecanismo principal.
- `scrypt` de Node para passwords.
- TOTP con secretos cifrados y recovery codes hasheados.

## Modulos

- `users`: identidad, perfil minimo, rol y estado.
- `auth`: registro, login, challenges 2FA, reautenticacion y cambio de password.
- `sessions`: sesiones opacas de servidor y cookie segura.
- `two_factor`: TOTP, provisioning URI y recovery codes.
- `oauth`: inicio de login OAuth 42, validacion de state, callback y gestion explicita de link/unlink de cuenta 42.
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

4. Preparar Prisma/SQLite:

```bash
npx prisma generate
npx prisma migrate dev
```

5. Ejecutar:

```bash
npm run build
npm start
```

## Base de datos

El backend usa **Prisma ORM con SQLite**.

Variable recomendada en `.env`:

```env
DATABASE_URL="file:./dev.db"
```

Con `NODE_ENV=test`, la app usa repositorios en memoria para que los tests sean rapidos y aislados.

## OAuth 42

Configura estas variables en `.env` para habilitar login con 42:

```env
OAUTH_42_CLIENT_ID=...
OAUTH_42_CLIENT_SECRET=...
OAUTH_42_REDIRECT_URI=http://127.0.0.1:3000/auth/oauth/42/callback
OAUTH_42_AUTHORIZE_URL=https://api.intra.42.fr/oauth/authorize
OAUTH_42_TOKEN_URL=https://api.intra.42.fr/oauth/token
OAUTH_42_ME_URL=https://api.intra.42.fr/v2/me
```

Flujo resumido:

1. `GET /auth/oauth/42` redirige a 42 con `state`.
2. `GET /auth/oauth/42/callback` valida `state` y la cookie temporal del navegador, intercambia `code`, obtiene perfil y resuelve usuario local.
3. Si el usuario local tiene 2FA activo, responde `requires_2fa`.
4. Si el email ya pertenece a una cuenta local no enlazada, falla con conflicto en vez de enlazar automaticamente.
5. Si no, crea sesion local con cookie.

Flujo de linking/unlinking:

1. `POST /auth/oauth/42/link/start` solo funciona con sesion autenticada y reautenticacion fuerte reciente.
2. `GET /auth/oauth/42/link/callback` usa un `state` distinto (`purpose=link`) y enlaza la identidad 42 a la cuenta autenticada actual.
3. Si esa identidad 42 ya pertenece a otro usuario, falla con `OAUTH_ALREADY_LINKED_TO_OTHER_USER`.
4. `DELETE /auth/oauth/42/link` solo permite unlink si la cuenta conserva al menos un metodo de acceso viable.

## Estado actual

La app ya cubre usuarios, credenciales, sesiones, challenges 2FA, TOTP, recovery codes, estados OAuth, cuentas OAuth enlazadas, historial basico de partidas y mensajes de chat de lobby. La persistencia real vive en Prisma/SQLite; los tests siguen usando repositorios en memoria.

## Endpoints iniciales

- `GET /`
- `GET /ui/app.css`
- `GET /ui/app.js`
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/login/2fa`
- `GET /auth/oauth/42`
- `GET /auth/oauth/42/callback`
- `POST /auth/oauth/42/link/start`
- `GET /auth/oauth/42/link/callback`
- `DELETE /auth/oauth/42/link`
- `POST /auth/logout`
- `POST /auth/reauthenticate`
- `POST /auth/password/change`
- `POST /2fa/setup`
- `POST /2fa/confirm`
- `POST /2fa/recovery-codes/regenerate`
- `DELETE /2fa`
- `GET /me`
- `GET /admin/users`
- `POST /matches`
- `GET /users/:userId/matches`
- `POST /chat/messages`
- `GET /chat/messages`

## UI manual de pruebas

Con el backend arrancado, abre:

```text
http://127.0.0.1:3000/
```

La pantalla permite probar registro, login, logout, `/me`, reautenticacion, cambio de password, setup TOTP, confirmacion 2FA, login con segundo factor y recovery codes.

## Notas de seguridad

- Los tokens de sesion son opacos y se guardan hasheados.
- Las cookies usan `httpOnly` y pueden configurarse como `secure`.
- Los recovery codes se guardan hasheados.
- Los secretos TOTP se cifran con una clave local.
- OAuth 42 separa login de linking para evitar enlaces implicitos por email.
