# ContadorAOPEI — Microgerencia y Seguimiento

Dashboard personal para gestionar proyectos, responsables, nivel, valor, observaciones, avance y cuenta regresiva. El contador muestra **solo días y horas**.

## Arquitectura

- Frontend: HTML, CSS y JavaScript.
- Desarrollo local: Express + SQLite para funcionar inmediatamente.
- Producción Netlify: Netlify Functions + PostgreSQL.
- Base de datos de producción: Netlify Database mediante `NETLIFY_DB_URL`.

Netlify puede conectar el repositorio de GitHub y desplegar automáticamente cada push. Las Functions usan variables de entorno para credenciales y configuración.

## Ejecutar localmente

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

La primera ejecución crea `data.db` y carga tres proyectos de ejemplo. No necesitas configurar una base de datos para probar la aplicación localmente.

## Desplegar en Netlify

### Opción A — Prueba rápida (arrastrar carpeta)
1. Entra a https://app.netlify.com/drop
2. Arrastra **la carpeta `public`** (no la carpeta raíz del proyecto).
3. La app funciona en **modo local**: los datos se guardan en el navegador (localStorage). Verás un aviso amarillo indicándolo.

> Arrastrar carpetas no despliega Functions, por eso se usa el modo local.

### Opción B — Con base de datos (GitHub o Netlify CLI)
1. Sube el proyecto completo a GitHub e impórtalo en Netlify (**Add new project → Import an existing project**), o usa `npx netlify deploy --prod` desde la carpeta raíz.
2. En Netlify crea la base de datos (**Extensions / Netlify DB**, Neon PostgreSQL). Esto crea la variable `NETLIFY_DATABASE_URL`. También se acepta `DATABASE_URL` si usas otro PostgreSQL.
3. Haz un nuevo deploy. La API `/api/projects` crea la tabla automáticamente y carga los datos de ejemplo.

Si la base de datos no está configurada, la app pasa sola a modo local en vez de fallar.

## Datos almacenados

Cada proyecto contiene:

- Nombre
- Responsable
- Nivel (manual)
- Valor (manual)
- Fecha de inicio
- Fecha límite
- Prioridad
- Avance
- Observaciones
- Estado
- Fechas de creación/actualización

## API

- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

## Seguridad

No guardes credenciales de base de datos en GitHub. Configúralas como variables de entorno de Netlify.
