# Documentación Completa del Proyecto Transcendence Backend

## 1. Introducción al Proyecto

**Transcendence** es un backend moderno desarrollado para una aplicación web 

### Tecnologías Principales
- **Runtime:** Node.js (Entorno de ejecución para JavaScript en el servidor).
- **Lenguaje:** TypeScript (Superset de JavaScript con tipado estático).
- **Base de Datos:** PostgreSQL (Base de datos relacional robusta).
- **Framework Web:** Fastify (Framework rápido y de baja sobrecarga para APIs).
- **ORM:** Kysely (Constructor de consultas SQL type-safe para TypeScript).
- **Autenticación:** Sesiones seguras mediante cookies HTTP-only y hashes de contraseñas (Argon2/Bcrypt).

---

## 2. Conceptos Básicos de TypeScript (Para Principiantes)

Si nunca has usado TypeScript, esta sección te ayudará a entender por qué lo usamos y cómo leer el código.

### ¿Qué es TypeScript?
Imagina que JavaScript es como escribir en un cuaderno sin reglas: puedes escribir "5" + "manzanas" y el programa intentará sumarlas aunque no tenga sentido. TypeScript añade reglas estrictas antes de que el programa se ejecute. Te obliga a definir qué tipo de dato es cada cosa (número, texto, booleano), evitando errores tontos.

### Diferencias Clave con Ejemplos

#### A. Tipado Estático (La gran ventaja)
En **JavaScript**, esto es válido pero peligroso:
```javascript
let edad = 25;
edad = "veinticinco"; // ¡Error lógico! Ahora edad es texto, no número.

En TypeScript, el compilador te detiene antes de ejecutar:
typescript
let edad: number = 25;
edad = "veinticinco"; 
// ERROR: Type 'string' is not assignable to type 'number'.

Nota: Los dos puntos : number indican que esa variable SOLO puede guardar números.
B. Interfaces (Definiendo la forma de los objetos)
En bases de datos y APIs, sabemos exactamente qué campos tendrá un usuario. TypeScript nos permite definir ese "molde":

typescript
// Definimos cómo debe ser un usuario
interface Usuario {
    id: number;
    username: string;
    email: string;
    isActive: boolean;
    createdAt?: Date; // El '?' significa que este campo es opcional
}

// Uso correcto
const user1: Usuario = {
    id: 1,
    username: "Pablo",
    email: "pablo@example.com",
    isActive: true
};

// Uso incorrecto (Falta email)
const user2: Usuario = {
    id: 2,
    username: "Ana",
    isActive: false
};
// ERROR: Property 'email' is missing in type...



C. Tipos Union y Literales
Podemos ser muy específicos sobre qué valores son aceptados:

typescript
// Solo puede ser 'GET', 'POST', 'PUT' o 'DELETE'
type MetodoHTTP = 'GET' | 'POST' | 'PUT' | 'DELETE';

function enviarRequest(metodo: MetodoHTTP) {
    // ... lógica
}

enviarRequest('PATCH'); // ERROR: 'PATCH' no está en la lista permitida.


D. Generics (Cajas reutilizables)
Permiten crear funciones que trabajan con cualquier tipo de dato, pero manteniendo la seguridad. Es como decir "esta caja guarda lo que tú quieras, pero una vez metes un zapato, solo podrás sacar zapatos".
typescript
// T es el tipo que decidiremos luego
function identidad<T>(valor: T): T {
    return valor;
}

const numero = identidad<number>(10); // Devuelve number
const texto = identidad<string>("Hola"); // Devuelve string


¿Cómo se ejecuta TypeScript?
Los navegadores y Node.js no entienden TypeScript nativamente. Necesitamos un paso intermedio llamado Compilación.
Escribes código en archivos .ts.
Ejecutas el compilador (tsc o npm run build).
El compilador genera archivos .js limpios en la carpeta dist/.
Node.js ejecuta esos archivos .js.
3. Arquitectura del Sistema
El proyecto sigue una arquitectura modular separada por responsabilidades.

Estructura de Directorios
trascendence/
├── src/                  # Código fuente original (TypeScript)
│   ├── app.ts            # Configuración principal de la aplicación (Fastify)
│   ├── server.ts         # Punto de entrada (inicia el servidor)
│   ├── routes/           # Definición de endpoints API
│   │   ├── auth.ts       # Login, registro, cambio de contraseña
│   │   ├── users.ts      # Gestión de perfiles
│   │   └── game.ts       # Lógica de partidas
│   ├── db/               # Conexión y migraciones de Base de Datos
│   │   ├── index.ts      # Configuración de Kysely (DB Pool)
│   │   └── migrate.ts    # Script para actualizar tablas
│   ├── types/            # Definiciones de tipos TypeScript globales
│   └── utils/            # Funciones helper (validadores, hashing)
├── dist/                 # Código compilado (JavaScript) - NO EDITAR
├── tests/                # Tests de integración
├── .env                  # Variables de entorno (Secretos, DB URL)
├── package.json          # Dependencias y scripts
└── tsconfig.json         # Configuración del compilador TypeScript

Flujo de una Petición (Request Lifecycle)
Cliente (Frontend): Envía una petición HTTP (ej: POST /auth/login).
Servidor (Fastify):
Recibe la petición.
Ejecuta Hooks/Middlewares: Verifica cookies, valida headers, comprueba CORS.
Ruta la petición al controlador correspondiente (src/routes/auth.ts).
Controlador:
Valida los datos de entrada (ej: ¿el email tiene formato correcto?).
Llama a la lógica de negocio o base de datos.
Base de Datos (PostgreSQL):
Ejecuta la consulta SQL segura generada por Kysely.
Devuelve los datos crudos.
Respuesta:
El controlador procesa los datos.
Fastify envía la respuesta JSON al cliente con el código de estado adecuado (200 OK, 401 Error, etc.).



4. Módulos Principales y Funcionalidad
A. Autenticación (src/routes/auth.ts)
Es el corazón de la seguridad. Maneja:
Registro: Hash de contraseña, creación de usuario en DB, generación de tokens 2FA (si aplica).
Login: Verificación de credenciales, inicio de sesión seguro.
Reautenticación: Requerida para acciones sensibles (cambiar email/password). Valida la contraseña actual nuevamente.
Logout: Invalidación de la sesión.
Seguridad Clave:
Las contraseñas nunca se guardan en texto plano. Se usa un algoritmo de hash (como Argon2) que convierte miPassword123 en una cadena irreconocible $argon2id$....
Las sesiones se gestionan con cookies HttpOnly (inaccesibles para JavaScript del navegador, previniendo robo de sesión XSS).
B. Base de Datos (src/db/)
Usamos Kysely, un constructor de consultas SQL. A diferencia de otros ORMs (como TypeORM), Kysely no oculta SQL, sino que lo hace más seguro y con autocompletado.
Migraciones: Archivos que definen cómo cambian las tablas con el tiempo. Al iniciar, migrate.ts verifica si la DB está al día.
Type-Safety: Si intentas hacer db.selectFrom('users').select('campo_inexistente'), TypeScript te dará error antes de compilar.
C. Gestión de Errores
El sistema utiliza códigos de estado HTTP estándar:
200: Éxito.
201: Creado (registro exitoso).
400: Bad Request (datos mal formados, contraseña débil).
401: Unauthorized (no logueado o sesión expirada).
403: Forbidden (logueado pero sin permisos).
409: Conflict (usuario o email ya existe).
500: Internal Server Error (fallo en el servidor o DB).
5. Diagramas de Flujo de Datos
Diagrama 1: Flujo de Registro de Usuario
mermaid
graph TD
    A[Cliente: Formulario Registro] -->|POST /auth/register| B(Fastify Server)
    B --> C{Validar Datos?}
    C -->|No (Email inválido)| D[Responder 400 Bad Request]
    C -->|Sí| E[Hash Contraseña (Argon2)]
    E --> F[Insertar en DB PostgreSQL]
    F -->|Error (Usuario existe)| G[Responder 409 Conflict]
    F -->|Éxito| H[Crear Sesión / Cookie]
    H --> I[Responder 201 Created + User Data]



Diagrama 2: Flujo de Cambio de Contraseña (Seguro)
Este es el flujo crítico que requiere reautenticación.

mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Fastify API
    participant DB as PostgreSQL

    Note over U, DB: Paso 1: Reautenticación
    U->>F: POST /auth/reauthenticate { password: "actual" }
    F->>DB: Verificar credenciales
    DB-->>F: Usuario válido
    F->>F: Marcar sesión como "Reautenticada" (Temporal)
    F-->>U: 200 OK (Token temporal o Cookie especial)

    Note over U, DB: Paso 2: Cambio de Contraseña (< 10 min)
    U->>F: POST /auth/password/change { new_password: "nueva_segura" }
    F->>F: Verificar estado "Reautenticado"
    alt No reautenticado recientemente
        F-->>U: 401 Unauthorized
    else Reautenticado OK
        F->>F: Validar fortaleza nueva contraseña
        alt Contraseña débil
            F-->>U: 400 Bad Request
        else Contraseña fuerte
            F->>F: Hash Nueva Contraseña
            F->>DB: UPDATE users SET password = ...
            DB-->>F: OK
            F->>F: Invalidar otras sesiones (Opcional)
            F-->>U: 200 OK Password Changed
        end
    end




Code
Preview

Diagrama 3: Arquitectura Interna de Datos
+----------------+       +---------------------+       +------------------+
|   Frontend     |       |   Backend (Node)    |       |   Database       |
|   (React/Vue)  |       |   (Fastify + TS)    |       |   (PostgreSQL)   |
+----------------+       +---------------------+       +------------------+
       |                           |                            |
       | 1. HTTPS Request          |                            |
       | (JSON Body + Cookies)     |                            |
       +-------------------------->|                            |
                                   | 2. Parse & Validate        |
                                   | (Zod / Schema)             |
                                   |                            |
                                   | 3. Business Logic          |
                                   | (Auth Check, Rules)        |
                                   |                            |
                                   | 4. SQL Query (Kysely)      |
                                   +--------------------------->|
                                                                | 5. Execute
                                                                | 6. Return Rows
                                   | 7. Map to TS Objects       |<---------------------------+
                                   |                            |
       | 8. JSON Response          |                            |
       | (Data + Status Code)      |                            |
       |<--------------------------+                            |


6. Guía de Uso y Comandos
Prerrequisitos
Node.js v18+ instalado.
PostgreSQL instalado y corriendo.
Archivo .env configurado (ver .env.example).






Instalación
bash
npm install

Desarrollo
Para compilar automáticamente los cambios en TypeScript:
bash
npm run build

(Esto abre tsc en modo watch. En otra terminal, ejecuta el servidor).

Construcción (Build)
Genera los archivos JS en dist/:
bash
npm run build


Iniciar Servidor
Ejecuta la versión compilada:

bash
npm start


Base de Datos
Las migraciones se ejecutan automáticamente al iniciar (npm start). Si necesitas forzarlas manualmente o crear una nueva:
Editar archivos en src/db/migrations/.
El sistema usa transacciones para asegurar que si una migración falla, la DB no quede a medias.
7. Seguridad Implementada
SQL Injection: Prevenida totalmente gracias a Kysely, que escapa parámetros automáticamente. Nunca se concatenan strings en las queries.
XSS (Cross-Site Scripting): Las cookies de sesión tienen el flag HttpOnly, impidiendo que scripts maliciosos en el navegador las lean.
CSRF (Cross-Site Request Forgery): Se valida el origen de las peticiones y se usan cookies SameSite=Strict o Lax.
Contraseñas: Hashing lento y con sal (salt) usando Argon2id, el estándar actual de la industria.
Rate Limiting: (Si está implementado) Limita el número de intentos de login para evitar ataques de fuerza bruta.
8. Apéndice: Ejemplos de Código Útiles


Cómo conectar a la DB (src/db/index.ts)
typescript
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from '../types/database';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});


Ejemplo de Ruta Segura (src/routes/profile.ts)
typescript

app.get('/profile', async (req, reply) => {
  // req.user es inyectado por el middleware de autenticación
  if (!req.user) {
    return reply.status(401).send({ error: 'No autorizado' });
  }

  const user = await db.selectFrom('users')
    .where('id', '=', req.user.id)
    .select(['username', 'email', 'avatar_url'])
    .executeTakeFirst();

  return reply.send(user);
});



Documentación generada para el proyecto Transcendence Backend. Última actualización: 2026.
### Pasos para guardar el archivo en Windows:

1.  Abre el **Bloc de notas** (Notepad) o un editor de código como VS Code.
2.  Copia **todo** el texto que está dentro del bloque de código de arriba (desde `# Documentación...` hasta el final).
3.  Pégalo en tu editor.
4.  Ve a **Archivo > Guardar como**.
5.  Navega a `C:\Proyectos\trascendence` (crea la carpeta si no existe).
6.  En "Nombre de archivo", escribe: `DOCUMENTACION_COMPLETA.md`.
7.  **Importante:** En "Tipo", selecciona **"Todos los archivos (*.*)"** (no lo dejes como documento de texto).
8.  Guarda.

Ahora tendrás el archivo listo para leer en cualquier visor Markdown o subirlo a GitHub.
