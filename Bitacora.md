# Bitacora del proyecto Transcendence Backend

Este documento explica el proyecto desde cero. La idea es que una persona sin experiencia programando pueda entender que hace la aplicacion, como se comunican sus partes y que papel cumple cada archivo.

## 1. Que es este proyecto

Este proyecto es un backend de autenticacion para una aplicacion tipo Transcendence.

Un backend es la parte del programa que vive en el servidor. No es la pantalla que ve el usuario, sino el sistema que recibe peticiones, decide si son validas, consulta o guarda datos, y responde.

Este backend se encarga principalmente de:

- Crear usuarios.
- Permitir login con username y password.
- Mantener sesiones de usuario con cookies.
- Permitir cerrar sesion.
- Permitir reautenticacion para acciones delicadas.
- Cambiar password.
- Activar y desactivar doble factor de autenticacion.
- Usar codigos TOTP, como los de Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, etc.
- Generar recovery codes para recuperar acceso si se pierde el autenticador.
- Permitir login con OAuth 42.
- Permitir vincular y desvincular una cuenta de 42 a un usuario local.
- Distinguir usuarios normales y administradores.
- Servir una pequena interfaz web de pruebas.

El proyecto esta escrito en TypeScript y corre sobre Node.js. Usa Fastify como servidor HTTP.

## 2. Idea global explicada sin codigo

Imagina que la aplicacion es un edificio.

- El navegador del usuario es una persona que quiere entrar.
- El backend es la recepcion del edificio.
- La base de datos es el archivo donde recepcion guarda informacion.
- La cookie de sesion es una pulsera de visitante.
- El password es una primera prueba de identidad.
- El 2FA es una segunda prueba de identidad.
- OAuth 42 es una identificacion externa emitida por 42.

Cuando alguien quiere entrar, recepcion no le da acceso solo porque diga "soy Pablo". Primero comprueba una prueba:

- Si usa password, comprueba que el password coincida con el hash guardado.
- Si usa OAuth 42, comprueba con 42 que la identidad externa es real.
- Si tiene 2FA activado, pide una segunda prueba antes de dar la pulsera final.

Cuando todo esta correcto, el servidor crea una sesion y manda al navegador una cookie. Esa cookie no contiene el usuario completo ni datos sensibles. Es un token opaco: una cadena aleatoria que solo sirve para que el servidor encuentre la sesion real.

La base de datos nunca guarda el token de sesion original. Guarda un hash del token. Esto significa que, aunque alguien leyera la tabla de sesiones, no podria copiar directamente una cookie valida.

## 3. Las cuatro partes grandes del proyecto

### 3.1 Servidor HTTP

El servidor HTTP es la puerta de entrada. Escucha rutas como:

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `POST /2fa/setup`
- `GET /auth/oauth/42`

Cada ruta representa una accion posible.

### 3.2 Servicios de negocio

Los servicios contienen las reglas importantes. Por ejemplo:

- "No se puede cambiar el password sin reautenticacion reciente".
- "No se crea una sesion final antes de completar 2FA".
- "No se puede desvincular OAuth si eso deja la cuenta sin metodo de acceso".
- "Un recovery code solo puede usarse una vez".

Estos servicios estan en `src/modules/.../*.service.ts`.

### 3.3 Repositorios

Los repositorios son las piezas que guardan y leen datos.

Hay dos versiones de muchos repositorios:

- Una version en memoria, util para tests o desarrollo sin base de datos.
- Una version PostgreSQL, util para guardar datos reales de forma persistente.

Si no hay `DATABASE_URL`, el proyecto usa memoria. Si hay `DATABASE_URL`, usa PostgreSQL.

### 3.4 Interfaz manual de pruebas

El proyecto incluye una pequena pagina web en `public/`. Sirve para probar manualmente:

- Registro.
- Login.
- Logout.
- 2FA.
- Cambio de password.
- OAuth 42.
- Vincular y desvincular cuenta 42.

No es una aplicacion final bonita para usuarios reales. Es una herramienta practica para probar el backend.

## 4. Como arranca el proyecto

Cuando ejecutas el backend, el flujo general es:

1. Node ejecuta `dist/server.js`, que viene de compilar `src/server.ts`.
2. `server.ts` llama a `buildApp()` en `src/app.ts`.
3. `app.ts` crea una aplicacion Fastify.
4. Se carga la configuracion desde variables de entorno.
5. Se registra soporte para cookies.
6. Se instala una proteccion basica contra CSRF por `Origin`.
7. Si existe `DATABASE_URL`, se conecta a PostgreSQL.
8. Si hay PostgreSQL, ejecuta migraciones de base de datos.
9. Crea repositorios, servicios y rutas.
10. Empieza a escuchar en `HOST` y `PORT`.

La aplicacion no nace directamente "con todos los datos". Primero prepara su configuracion, despues decide si usa memoria o base de datos, y al final registra las rutas.

## 5. Variables de entorno

Las variables de entorno son valores que se pasan al programa desde fuera. Se usan para configurar cosas que no deberian estar escritas directamente en el codigo.

Ejemplos:

- Puerto donde escucha el servidor.
- URL de la base de datos.
- Secretos de OAuth.
- Clave para cifrar secretos TOTP.

El archivo `.env.example` ensena que variables hacen falta, pero no contiene secretos reales. El archivo `.env` real no debe subirse a GitHub.

## 6. Base de datos y modo memoria

Este proyecto puede funcionar de dos maneras.

### 6.1 Modo memoria

Si no configuras `DATABASE_URL`, los datos se guardan en memoria.

Esto significa:

- Sirve para pruebas rapidas.
- Sirve para tests automaticos.
- Al reiniciar el servidor, se pierden los usuarios y sesiones.

### 6.2 Modo PostgreSQL

Si configuras `DATABASE_URL`, los datos se guardan en PostgreSQL.

Esto significa:

- Los usuarios quedan guardados.
- Las sesiones quedan guardadas.
- Los secretos 2FA quedan guardados cifrados.
- Los recovery codes quedan guardados hasheados.
- Los enlaces OAuth quedan guardados.

La estructura de tablas se crea con `db/migrations/001_auth_base.sql`.

## 7. Conceptos de seguridad importantes

### 7.1 Hash

Un hash es una transformacion de un dato en una huella.

Si tienes un token:

```text
abc123
```

El servidor puede guardar solo su hash. Luego, cuando recibe `abc123`, calcula otra vez el hash y compara.

Ventaja: si alguien roba la base de datos, no ve directamente los tokens originales.

En este proyecto se hashean:

- Tokens de sesion.
- Login challenges.
- OAuth states.
- Recovery codes.

### 7.2 Password hashing

Los passwords no se guardan como texto. Se guardan usando `scrypt`, una funcion pensada para passwords.

Esto es distinto a un hash rapido normal. Para passwords se quiere algo mas costoso de calcular, porque dificulta ataques masivos.

### 7.3 Cifrado

El secreto TOTP si necesita poder recuperarse para verificar codigos. Por eso no se guarda hasheado, se guarda cifrado.

El cifrado usa AES-256-GCM. La clave viene de `TOTP_ENCRYPTION_KEY_BASE64`.

### 7.4 Cookies

La cookie principal guarda el token de sesion.

Se configura como:

- `httpOnly`: JavaScript del navegador no puede leerla.
- `secure` en produccion: solo via HTTPS.
- `sameSite=lax`: ayuda contra ciertos ataques cross-site.

### 7.5 CSRF

CSRF es un ataque donde otro sitio intenta hacer que tu navegador envie una accion a esta app usando tus cookies.

Este proyecto tiene una proteccion basica: para metodos peligrosos como `POST` y `DELETE`, si viene cabecera `Origin`, debe coincidir con el host del servidor.

### 7.6 Reautenticacion

Estar logueado no siempre basta. Para acciones delicadas, el proyecto exige reautenticacion reciente.

Ejemplos de acciones delicadas:

- Cambiar password.
- Activar 2FA.
- Desactivar 2FA.
- Vincular OAuth 42.
- Desvincular OAuth 42.

La reautenticacion dura un tiempo corto, configurado como accion sensible.

## 8. Flujo global de registro

Cuando un usuario se registra:

1. El navegador envia `username`, `email` y `password` a `POST /auth/register`.
2. El backend valida que el username tenga formato aceptable.
3. El backend valida que el password tenga al menos 12 caracteres.
4. Se crea un usuario.
5. Se crea una credencial de password separada del usuario.
6. El password se hashea antes de guardarse.
7. Si falla la creacion de credencial, se borra el usuario recien creado para no dejar cuentas rotas.
8. Se crea una sesion.
9. Se manda la cookie de sesion al navegador.
10. El usuario queda autenticado.

## 9. Flujo global de login con password sin 2FA

1. El navegador envia username y password a `POST /auth/login`.
2. Se aplica rate limit basico para evitar intentos masivos.
3. Se busca el usuario.
4. Se comprueba que el usuario este activo.
5. Se busca su credencial de password.
6. Se verifica el password.
7. Si el usuario no tiene 2FA activo, se crea sesion.
8. Se envia cookie.
9. El navegador queda logueado.

## 10. Flujo global de login con password y 2FA

1. El usuario envia username y password.
2. El password es correcto.
3. El sistema detecta que 2FA esta activo.
4. En vez de crear sesion final, crea un `login_challenge`.
5. Devuelve una respuesta `requires_2fa`.
6. El navegador muestra el formulario de segundo factor.
7. El usuario envia un codigo TOTP o recovery code a `POST /auth/login/2fa`.
8. El backend comprueba que el challenge exista, no este vencido y no este consumido.
9. Verifica el TOTP o consume el recovery code.
10. Consume atomicamente el challenge.
11. Si otra peticion ya lo consumio, falla.
12. Crea la sesion final.
13. Envia la cookie.

La parte importante es que no hay sesion final antes del segundo factor.

## 11. Flujo global de TOTP 2FA

TOTP significa Time-based One-Time Password. Es un codigo temporal que cambia cada pocos segundos.

### 11.1 Activar 2FA

1. El usuario ya debe estar logueado.
2. Debe reautenticarse recientemente.
3. Llama a `POST /2fa/setup`.
4. El servidor genera un secreto TOTP.
5. El secreto se cifra y se guarda como pendiente.
6. El servidor devuelve una provisioning URI.
7. El usuario escanea o copia el secreto en una app autenticadora.
8. El usuario confirma con un codigo TOTP en `POST /2fa/confirm`.
9. Si el codigo es correcto, 2FA queda activo.
10. El servidor genera recovery codes.
11. Los recovery codes se muestran una vez.
12. En la base de datos solo quedan hashes de esos recovery codes.

### 11.2 Usar recovery code

Un recovery code sirve como segundo factor alternativo.

Cuando se usa:

1. El servidor hashea el codigo recibido.
2. Busca un codigo activo con ese hash.
3. Lo marca como usado en una sola operacion.
4. Si ya estaba usado, no sirve.

### 11.3 Desactivar 2FA

1. El usuario debe estar logueado.
2. Debe reautenticarse recientemente.
3. Si 2FA esta activo, la reautenticacion exige password mas segundo factor.
4. Se borra el TOTP.
5. Se invalidan los recovery codes.
6. Se revocan otras sesiones del usuario.

## 12. Flujo global de OAuth 42

OAuth permite iniciar sesion usando una identidad externa, en este caso 42.

### 12.1 Login con 42

1. El usuario entra en `GET /auth/oauth/42`.
2. El backend crea un `state` aleatorio.
3. Guarda el hash de ese state.
4. Tambien pone el state en una cookie temporal.
5. Redirige al navegador a 42.
6. El usuario autoriza en 42.
7. 42 redirige de vuelta a `/auth/oauth/42/callback` con `code` y `state`.
8. El backend comprueba que el state del callback coincida con la cookie temporal.
9. Consume el state guardado para que no se reutilice.
10. Intercambia el `code` por un access token.
11. Usa el access token para pedir el perfil a 42.
12. Busca si ya existe una cuenta OAuth enlazada con ese ID de 42.
13. Si existe, usa ese usuario local.
14. Si no existe, crea un nuevo usuario local y una cuenta OAuth enlazada.
15. Si el email ya pertenece a una cuenta local sin enlazar, falla y pide linking explicito.
16. Si el usuario local tiene 2FA, pide 2FA.
17. Si no tiene 2FA, crea sesion final.

### 12.2 Vincular cuenta 42 a un usuario existente

1. El usuario ya debe estar logueado.
2. Debe haber reautenticado recientemente.
3. Pulsa el boton de vincular.
4. El navegador hace `POST /auth/oauth/42/link/start`.
5. El backend crea un state con `purpose=link`.
6. Guarda tambien el ID del usuario que inicio el linking.
7. Redirige a 42.
8. En el callback, comprueba state, cookie, proposito y usuario iniciador.
9. Si esa cuenta 42 no esta enlazada, la enlaza al usuario actual.
10. Si ya estaba enlazada al mismo usuario, responde como operacion idempotente.
11. Si estaba enlazada a otro usuario, falla.

### 12.3 Desvincular cuenta 42

1. El usuario debe estar logueado.
2. Debe reautenticarse recientemente.
3. Llama a `DELETE /auth/oauth/42/link`.
4. El backend busca la cuenta OAuth.
5. Comprueba que al quitarla el usuario no se quede sin ningun metodo de acceso.
6. Si el usuario no tiene password y ese era su unico OAuth, no deja desvincular.
7. Si queda otro metodo de acceso viable, elimina el enlace.

## 13. Flujo global de sesiones

Una sesion representa "este navegador ya ha demostrado quien es".

Cuando se crea una sesion:

1. Se genera un token aleatorio.
2. Al navegador se le manda el token en cookie.
3. En la base de datos se guarda solo el hash.
4. La sesion tiene fecha de expiracion.
5. Puede tener `revoked_at` si fue cerrada o invalidada.

Cuando una ruta necesita login:

1. Lee la cookie.
2. Hashea el token de la cookie.
3. Busca la sesion por hash.
4. Comprueba que no este revocada.
5. Comprueba que no este vencida.
6. Busca el usuario.
7. Comprueba que el usuario este activo.
8. Adjunta `currentUser` y `currentSession` a la request.
9. Actualiza `last_seen_at`.

## 14. Flujo global de autorizacion

Autenticacion significa "saber quien eres".

Autorizacion significa "saber si puedes hacer esto".

Este proyecto tiene dos guards:

- `requireAuth`: exige estar logueado.
- `requireRole('admin')`: exige que el usuario sea admin.

Por ejemplo:

- `/me` usa `requireAuth`.
- `/admin/users` usa `requireAuth` y `requireRole('admin')`.

## 15. Que se prueba automaticamente

Los tests de integracion prueban flujos completos:

- Registro.
- Login.
- Logout.
- `/me`.
- Reautenticacion.
- Cambio de password.
- Activacion de 2FA.
- Login con TOTP.
- Recovery codes.
- Desactivacion de 2FA.
- OAuth 42.
- Linking y unlinking de OAuth.
- UI servida desde rutas publicas.

Los tests corren con repositorios en memoria para ser rapidos y no depender de PostgreSQL.

## 16. Explicacion archivo por archivo

Esta seccion lista los archivos del proyecto y explica su funcion.

### `.env.example`

Es una plantilla para crear el archivo `.env` real.

Contiene nombres de variables necesarias:

- `NODE_ENV`
- `HOST`
- `PORT`
- `COOKIE_SECURE`
- `TOTP_ENCRYPTION_KEY_BASE64`
- Variables OAuth 42.
- `DATABASE_URL` comentada.

No debe contener secretos reales. Sirve como guia para que cada desarrollador cree su propio `.env`.

### `.gitignore`

Dice a Git que archivos no debe subir.

Ignora:

- `node_modules/`, porque son dependencias instaladas localmente.
- `.env` y `.env.*`, porque pueden contener secretos.
- `dist/`, porque es codigo compilado.
- Logs.
- Carpetas de editor.
- Carpetas locales de agentes.
- Archivos temporales.

Permite explicitamente `.env.example`, porque ese archivo si debe subirse como plantilla.

### `README.md`

Es la guia rapida del proyecto.

Explica:

- Que stack se usa.
- Que modulos existen.
- Como arrancar localmente.
- Como configurar PostgreSQL.
- Como configurar OAuth 42.
- Que endpoints hay.
- Que notas de seguridad tiene el sistema.

Es el documento que alguien leeria primero para usar el proyecto.

### `DEV.md`

Es una guia mas tecnica para desarrolladores.

Explica:

- Proposito del backend.
- Limites del diseno.
- Stack.
- Fronteras entre modulos.
- Flujos detallados.
- Modelo de datos.
- Variables de entorno.

Mientras `README.md` es mas practico, `DEV.md` explica decisiones de arquitectura.

### `Bitacora.md`

Es este archivo.

Su objetivo es explicar el proyecto de forma didactica y completa, pensando en alguien que no lee codigo habitualmente.

### `package.json`

Es el archivo principal de configuracion de un proyecto Node.js.

Indica:

- Nombre del proyecto.
- Version.
- Que usa modulos ES (`"type": "module"`).
- Scripts disponibles.
- Dependencias de produccion.
- Dependencias de desarrollo.

Scripts importantes:

- `npm run build`: compila TypeScript a JavaScript.
- `npm start`: arranca el servidor compilado.
- `npm test`: ejecuta tests de integracion.
- `npm run dev`: deja TypeScript compilando en modo observacion.

### `package-lock.json`

Guarda las versiones exactas de las dependencias instaladas.

Aunque no se suele leer a mano, es importante subirlo porque permite que otras maquinas instalen el mismo arbol de dependencias.

### `tsconfig.json`

Configura TypeScript.

Indica:

- Que version de JavaScript generar.
- Que sistema de modulos usar.
- Que el modo estricto esta activo.
- Que el codigo fuente esta en `src`.
- Que el resultado compilado va a `dist`.

### `docker-compose.yml`

Define un servicio PostgreSQL local.

Sirve para levantar una base de datos con:

```bash
docker compose up -d postgres
```

Usa valores locales simples como usuario `postgres`, password `postgres` y base `transcendence`.

No es una configuracion de produccion. Es para desarrollo.

### `db/migrations/001_auth_base.sql`

Crea las tablas principales de autenticacion.

Tablas:

- `users`: usuarios.
- `password_credentials`: passwords hasheados.
- `sessions`: sesiones.
- `login_challenges`: retos temporales para completar 2FA.
- `two_factor_totp`: secretos TOTP cifrados.
- `recovery_codes`: codigos de recuperacion hasheados.
- `oauth_accounts`: enlaces entre usuarios locales y cuentas 42.
- `oauth_states`: states temporales para OAuth.

Tambien crea indices para acelerar busquedas.

La migracion usa `create table if not exists`, por eso puede ejecutarse varias veces sin recrear todo desde cero.

### `src/server.ts`

Es el punto de entrada del servidor.

Hace tres cosas:

1. Importa `buildApp`.
2. Construye la app.
3. La pone a escuchar en `HOST` y `PORT`.

Es pequeno porque casi todo el trabajo real esta en `src/app.ts`.

### `src/app.ts`

Es el centro de ensamblaje de la aplicacion.

Hace muchas tareas importantes:

- Crea la instancia Fastify.
- Configura parser JSON.
- Registra cookies.
- Registra la proteccion CSRF basica.
- Crea conexion PostgreSQL si hay `DATABASE_URL`.
- Ejecuta migraciones si hay PostgreSQL.
- Decide si usar repositorios PostgreSQL o memoria.
- Crea servicios.
- Registra rutas.
- Registra rutas mock OAuth en desarrollo.
- Define el manejador global de errores.

Este archivo es como la mesa donde se conectan todas las piezas.

### `src/config/env.ts`

Lee y valida variables de entorno.

Usa `zod`, una libreria de validacion.

Esto evita que el programa arranque con configuracion invalida sin darse cuenta.

Por ejemplo:

- `PORT` debe ser numero positivo.
- `NODE_ENV` debe ser `development`, `test` o `production`.
- URLs OAuth deben tener formato URL.
- `TOTP_ENCRYPTION_KEY_BASE64` debe existir.

### `src/config/security.ts`

Convierte variables de entorno en valores de seguridad usados por la app.

Define:

- Nombre de cookie de sesion.
- Nombre de cookie OAuth.
- Si la cookie debe ser `secure`.
- `sameSite`.
- Duracion de sesion.
- Duracion de login challenge.
- Duracion de OAuth state.
- Ventana de reautenticacion para acciones sensibles.
- Issuer TOTP.
- Clave de cifrado TOTP.

### `src/db/client.ts`

Crea el pool de PostgreSQL.

Un pool es un grupo de conexiones reutilizables a la base de datos.

Si no hay `DATABASE_URL` o si `NODE_ENV=test`, devuelve `null`. Eso hace que la app use repositorios en memoria.

### `src/db/migrate.ts`

Ejecuta migraciones SQL.

Lee el archivo `db/migrations/001_auth_base.sql` y lo manda a PostgreSQL.

Se ejecuta al arrancar la app si hay base de datos.

### `src/db/pgMappers.ts`

Convierte filas de PostgreSQL en objetos TypeScript del proyecto.

PostgreSQL usa nombres como:

```text
created_at
```

El codigo TypeScript usa nombres como:

```text
createdAt
```

Este archivo hace esa traduccion para usuarios, sesiones, credenciales, TOTP, recovery codes, OAuth, etc.

### `src/shared/errors/AppError.ts`

Define una clase de error propia.

Un `AppError` contiene:

- Mensaje.
- Codigo HTTP.
- Codigo interno.

Esto permite que el manejador global de errores devuelva respuestas ordenadas.

### `src/shared/errors/httpErrors.ts`

Contiene funciones pequenas para crear errores comunes:

- `badRequest`
- `unauthorized`
- `forbidden`
- `conflict`
- `tooManyRequests`

En vez de escribir numeros HTTP manualmente en todo el proyecto, se usan estas funciones.

### `src/shared/crypto/randomToken.ts`

Genera tokens aleatorios seguros.

Se usa para:

- IDs internos.
- Tokens de sesion.
- Login challenges.
- OAuth states.
- Recovery codes.

Usa criptografia de Node, no `Math.random`.

### `src/shared/crypto/hashToken.ts`

Calcula un hash SHA-256 de un token.

Se usa para no guardar tokens originales.

Ejemplos:

- Cookie de sesion: el navegador tiene token real, la base guarda hash.
- Recovery code: el usuario ve codigo real una vez, la base guarda hash.

### `src/shared/crypto/encryption.ts`

Define `SecretBox`, una utilidad para cifrar y descifrar secretos.

Usa AES-256-GCM.

Se usa para guardar secretos TOTP cifrados.

Si la clave `TOTP_ENCRYPTION_KEY_BASE64` no decodifica a 32 bytes, lanza error.

### `src/shared/crypto/passwordHasher.ts`

Define como se hashean y verifican passwords.

Usa `scrypt`, una funcion pensada para proteger passwords.

El hash guardado incluye:

- Version del formato.
- Salt.
- Hash.

El salt evita que dos usuarios con el mismo password tengan el mismo hash.

### `src/shared/http/cookies.ts`

Contiene funciones para poner y limpiar cookies.

Funciones:

- `setSessionCookie`
- `clearSessionCookie`
- `setOAuthStateCookie`
- `clearOAuthStateCookie`

Centralizar esto evita repetir opciones de seguridad en cada ruta.

### `src/shared/http/csrf.ts`

Contiene una proteccion basica contra CSRF.

Para metodos no seguros, como `POST` o `DELETE`, mira la cabecera `Origin`.

Si existe `Origin`, debe coincidir con el host que recibio la peticion.

Si no coincide, rechaza con error `CSRF_ORIGIN_MISMATCH`.

### `src/shared/http/rateLimit.ts`

Implementa un rate limiter en memoria.

Sirve para limitar intentos repetidos, por ejemplo login y segundo factor.

No es una solucion distribuida para produccion con varias instancias, pero ayuda en desarrollo y como base.

### `src/ui/ui.routes.ts`

Registra rutas para servir la UI manual.

Hace que:

- `GET /` devuelva `public/index.html`.
- `GET /ui/app.css` devuelva CSS.
- `GET /ui/app.js` devuelva JavaScript.

### `public/index.html`

Es la pagina HTML de pruebas.

Contiene formularios y secciones para:

- Registro.
- Login.
- Login OAuth 42.
- Segundo factor.
- Ver sesion actual.
- Logout.
- Reautenticacion.
- Setup 2FA.
- Confirmar 2FA.
- Ver recovery codes.
- Cambiar password.
- Link/unlink OAuth 42.
- Log de respuestas.

### `public/app.css`

Define el aspecto visual de la UI manual.

Controla:

- Colores.
- Layout en grid.
- Paneles.
- Formularios.
- Botones.
- Responsive para pantallas pequenas.

### `public/app.js`

Da comportamiento a la UI manual.

Escucha clicks y submits de formularios.

Hace llamadas `fetch` a endpoints del backend.

Actualiza:

- Estado de sesion.
- Log de respuestas.
- Formulario de segundo factor.
- Provisioning URI.
- Recovery codes.

Tambien envia el inicio de linking OAuth 42 usando un formulario `POST`, porque el backend espera `POST /auth/oauth/42/link/start`.

### `src/modules/users/users.types.ts`

Define los tipos relacionados con usuarios.

Incluye:

- Estructura de usuario.
- Roles.
- Estados.
- Datos necesarios para crear usuario.

### `src/modules/users/users.repository.ts`

Define la interfaz de repositorio de usuarios y la implementacion en memoria.

Permite:

- Crear usuario.
- Borrar usuario.
- Buscar por ID.
- Buscar por username.
- Buscar por email.
- Listar usuarios.

La version en memoria guarda usuarios en un `Map`.

### `src/modules/users/users.pgRepository.ts`

Implementa el repositorio de usuarios usando PostgreSQL.

Hace queries SQL contra la tabla `users`.

Normaliza username y email a minusculas.

Convierte errores de unicidad en error de conflicto.

### `src/modules/users/users.service.ts`

Servicio de usuarios.

Es una capa pequena encima del repositorio.

Actualmente delega operaciones como:

- Crear usuario.
- Borrar usuario.
- Buscar usuario.
- Listar usuarios.

Aunque parezca simple, ayuda a mantener separada la logica de negocio del almacenamiento.

### `src/modules/users/users.routes.ts`

Define rutas relacionadas con usuarios.

Rutas:

- `GET /me`: devuelve el usuario actual. Requiere login.
- `GET /admin/users`: lista usuarios. Requiere login y rol admin.

### `src/modules/auth/auth.types.ts`

Define tipos de autenticacion.

Por ejemplo:

- Credencial de password.
- Resultado de login.
- Caso `authenticated`.
- Caso `requires_2fa`.

Estos tipos ayudan a que TypeScript sepa que forma puede tener cada respuesta.

### `src/modules/auth/auth.repository.ts`

Define la interfaz de repositorio de autenticacion y la implementacion en memoria.

Gestiona:

- Credenciales de password.
- Login challenges para 2FA.

La implementacion en memoria se usa en tests y cuando no hay base de datos.

### `src/modules/auth/auth.pgRepository.ts`

Implementa el repositorio de autenticacion con PostgreSQL.

Gestiona:

- Tabla `password_credentials`.
- Tabla `login_challenges`.

El consumo de login challenge es atomico: solo se actualiza si no estaba consumido y no expiro.

### `src/modules/auth/auth.service.ts`

Contiene las reglas principales de autenticacion.

Responsabilidades:

- Registrar usuario.
- Crear credencial de password.
- Login con password.
- Detectar si hace falta 2FA.
- Crear login challenge.
- Completar login 2FA.
- Reautenticar usuario.
- Cambiar password.

Tambien aplica rate limit basico a login y segundo factor.

### `src/modules/auth/auth.routes.ts`

Define endpoints de autenticacion.

Rutas:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/login/2fa`
- `POST /auth/logout`
- `POST /auth/reauthenticate`
- `POST /auth/password/change`

Este archivo se encarga de:

- Validar cuerpos de request con `zod`.
- Leer IP y user-agent.
- Poner o limpiar cookies.
- Llamar al servicio de auth.

### `src/modules/authorization/currentUser.ts`

Extiende los tipos de Fastify para que una request pueda tener:

- `currentUser`
- `currentSession`

Esto es importante porque TypeScript necesita saber que esas propiedades existen despues de pasar por `requireAuth`.

### `src/modules/authorization/requireAuth.ts`

Define el guard `requireAuth`.

Un guard es una funcion que se ejecuta antes de una ruta.

Hace:

1. Lee cookie de sesion.
2. Busca sesion.
3. Comprueba que sea valida.
4. Adjunta usuario y sesion a la request.

Si algo falla, devuelve `unauthorized`.

### `src/modules/authorization/requireRole.ts`

Define el guard `requireRole`.

Sirve para exigir un rol concreto, por ejemplo `admin`.

Primero comprueba que exista `currentUser`. Luego compara su rol.

### `src/modules/sessions/sessions.types.ts`

Define tipos de sesiones.

Incluye:

- Sesion guardada.
- Sesion recien creada con token real.
- Sesion junto con usuario.

### `src/modules/sessions/sessions.repository.ts`

Define la interfaz de repositorio de sesiones y la implementacion en memoria.

Permite:

- Crear sesion.
- Buscar por hash de token.
- Actualizar `lastSeenAt`.
- Revocar sesion.
- Revocar otras sesiones.
- Marcar reautenticacion.

### `src/modules/sessions/sessions.pgRepository.ts`

Implementa sesiones con PostgreSQL.

Usa la tabla `sessions`.

Actualiza:

- `revoked_at` al revocar.
- `reauthenticated_at` al reautenticar.
- `last_seen_at` cuando se usa la sesion.

### `src/modules/sessions/sessions.service.ts`

Contiene la logica de sesiones.

Hace:

- Crear token aleatorio.
- Hashear token antes de guardar.
- Calcular expiracion.
- Buscar sesion desde cookie.
- Comprobar expiracion y revocacion.
- Comprobar que el usuario siga activo.
- Revocar sesiones.

### `src/modules/two_factor/twoFactor.types.ts`

Define tipos de 2FA.

Incluye:

- Registro TOTP.
- Recovery code.
- Resultado de setup TOTP.

### `src/modules/two_factor/twoFactor.repository.ts`

Define la interfaz de repositorio 2FA y la version en memoria.

Gestiona:

- TOTP pendiente o activo.
- Recovery codes.
- Consumo de recovery code.
- Reemplazo de recovery codes.
- Desactivacion de TOTP.

### `src/modules/two_factor/twoFactor.pgRepository.ts`

Implementa 2FA con PostgreSQL.

Usa:

- `two_factor_totp`
- `recovery_codes`

Las operaciones delicadas usan transacciones cuando cambian varias cosas relacionadas.

El consumo de recovery code es atomico.

### `src/modules/two_factor/totp.service.ts`

Gestiona TOTP.

Hace:

- Generar secreto.
- Cifrar secreto.
- Descifrar secreto.
- Crear provisioning URI.
- Verificar codigos.

Usa `otplib`.

### `src/modules/two_factor/recoveryCodes.service.ts`

Gestiona recovery codes.

Hace:

- Generar 10 codigos.
- Hashearlos antes de guardarlos.
- Consumir un codigo recibido por usuario.

Los recovery codes reales solo se muestran al usuario cuando se generan.

### `src/modules/two_factor/twoFactor.service.ts`

Contiene la logica de alto nivel de 2FA.

Responsabilidades:

- Saber si 2FA esta activo.
- Empezar setup TOTP.
- Confirmar setup.
- Verificar TOTP.
- Consumir recovery code.
- Regenerar recovery codes.
- Desactivar 2FA.

### `src/modules/two_factor/twoFactor.routes.ts`

Define endpoints de 2FA.

Rutas:

- `POST /2fa/setup`
- `POST /2fa/confirm`
- `POST /2fa/recovery-codes/regenerate`
- `DELETE /2fa`

Todas requieren login.

Todas requieren reautenticacion reciente porque son acciones sensibles.

### `src/modules/oauth/oauth.types.ts`

Define tipos de OAuth.

Incluye:

- Proveedor OAuth.
- Perfil recibido de 42.
- Cuenta OAuth local.
- State OAuth.
- Resultado de callback.
- Resultado de link/unlink.

### `src/modules/oauth/oauth.repository.ts`

Define la interfaz OAuth y la implementacion en memoria.

Gestiona:

- States OAuth.
- Cuentas OAuth enlazadas.
- Buscar cuenta por proveedor e ID externo.
- Buscar cuenta por usuario.
- Contar cuentas OAuth de un usuario.
- Crear o borrar enlaces.

### `src/modules/oauth/oauth.pgRepository.ts`

Implementa OAuth con PostgreSQL.

Usa:

- `oauth_states`
- `oauth_accounts`

Consume states con un `UPDATE ... WHERE consumed_at is null RETURNING *`, lo que evita reusar el mismo state.

### `src/modules/oauth/oauth.service.ts`

Contiene la logica principal OAuth.

Responsabilidades:

- Verificar que OAuth este configurado.
- Crear URL de autorizacion.
- Crear state.
- Validar state y cookie temporal.
- Intercambiar code por access token.
- Pedir perfil a 42.
- Resolver usuario local.
- Crear usuario local si hace falta.
- Impedir auto-link por email.
- Linkear cuenta 42.
- Deslinkear cuenta 42 sin dejar al usuario sin acceso.

Tambien aplica timeout a llamadas externas.

### `src/modules/oauth/oauth.routes.ts`

Define endpoints OAuth.

Rutas:

- `GET /auth/oauth/42`
- `GET /auth/oauth/42/callback`
- `POST /auth/oauth/42/link/start`
- `GET /auth/oauth/42/link/callback`
- `DELETE /auth/oauth/42/link`

Maneja cookies temporales OAuth y cookies de sesion final.

### `src/modules/oauth/mock/mockOAuth.routes.ts`

Define un proveedor OAuth falso para desarrollo.

Simula:

- Endpoint de autorizacion.
- Endpoint de token.
- Endpoint de perfil.

Sirve para probar OAuth sin conectar con la API real de 42.

Solo se registra en `NODE_ENV=development`.

### `tests/integration/auth-flow.test.mjs`

Test de integracion para autenticacion local.

Comprueba flujos como:

- Registro.
- Login.
- Logout.
- Reautenticacion.
- Cambio de password.
- Activacion de 2FA.
- Login con TOTP.
- Recovery codes.
- Desactivacion de 2FA.

Es importante porque prueba el sistema desde fuera, como si fuera un cliente HTTP.

### `tests/integration/oauth-flow.test.mjs`

Test de integracion para OAuth 42.

Comprueba:

- Inicio de OAuth.
- Validacion de state.
- Rechazo de state invalido.
- Creacion de usuario OAuth.
- Login OAuth.
- OAuth con 2FA.
- Linking.
- Unlinking.
- Conflictos cuando una cuenta 42 pertenece a otro usuario.

Usa un `fetch` falso para no depender de Internet.

### `tests/integration/ui.test.mjs`

Test que comprueba que la UI manual se sirve correctamente.

Valida que rutas como `/`, `/ui/app.css` y `/ui/app.js` respondan.

### `docs/superpowers/specs/2026-05-23-oauth-42-account-linking-design.md`

Documento de diseno sobre account linking de OAuth 42.

Explica como debe funcionar vincular una cuenta 42 a un usuario existente.

Sirve como referencia historica de decisiones.

### `docs/superpowers/plans/2026-05-22-oauth-42-integration.md`

Plan de implementacion para integrar OAuth 42.

Describe pasos y tareas para crear el flujo OAuth inicial.

No es codigo ejecutado por la app; es documentacion de planificacion.

### `docs/superpowers/plans/2026-05-23-oauth-42-account-linking.md`

Plan de implementacion para account linking de OAuth 42.

Describe tareas para separar login OAuth de linking OAuth y proteger el flujo.

Tampoco es codigo ejecutado por la app; es documentacion de trabajo.

## 17. Resumen de dependencias importantes

### Fastify

Framework HTTP. Recibe peticiones y responde.

### @fastify/cookie

Permite leer y escribir cookies.

### zod

Valida datos recibidos.

### pg

Cliente PostgreSQL.

### otplib

Genera y verifica codigos TOTP.

### dotenv

Carga variables desde `.env`.

### TypeScript

Permite escribir JavaScript con tipos.

## 18. Como leer este proyecto si empiezas desde cero

Una ruta recomendada:

1. Leer `README.md`.
2. Leer esta bitacora hasta la seccion de flujos.
3. Abrir `src/app.ts` para ver como se conectan las piezas.
4. Abrir `src/modules/auth/auth.routes.ts` para ver rutas de login.
5. Abrir `src/modules/auth/auth.service.ts` para ver reglas de login.
6. Abrir `src/modules/sessions/sessions.service.ts` para entender sesiones.
7. Abrir `src/modules/two_factor/twoFactor.service.ts` para entender 2FA.
8. Abrir `src/modules/oauth/oauth.service.ts` para entender OAuth.
9. Abrir tests para ver ejemplos reales de uso.

## 19. Que deberia vigilarse antes de produccion

El proyecto tiene buenas bases, pero antes de produccion convendria revisar:

- Usar rate limit persistente o compartido si hay varias instancias.
- Revisar configuracion de cookies detras de proxy HTTPS.
- Configurar correctamente `COOKIE_SECURE=true` en produccion.
- Rotacion y proteccion de `TOTP_ENCRYPTION_KEY_BASE64`.
- Logs y monitorizacion.
- Politica de limpieza de sesiones vencidas y states antiguos.
- Tests de concurrencia sobre 2FA y recovery codes.
- Politica real para crear usuarios admin.

## 20. Resumen final

Este backend esta organizado por dominios:

- Usuarios.
- Auth.
- Sesiones.
- 2FA.
- OAuth.
- Autorizacion.

Cada dominio tiene:

- Tipos.
- Repositorio.
- Servicio.
- Rutas, si expone endpoints HTTP.

La idea principal es separar responsabilidades:

- Las rutas entienden HTTP.
- Los servicios entienden reglas de negocio.
- Los repositorios entienden almacenamiento.
- Los helpers compartidos entienden seguridad, errores, cookies y criptografia.

Esa separacion hace que el proyecto sea mas facil de probar, mantener y explicar.
