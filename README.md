# Recompensas GASOP

Dashboard para gestionar carpetas con responsable, nivel, valor, fechas (solo día), prioridad, avance, observaciones y **estado**: Radicada, Consolidada o Por pagar. El contador muestra los días y horas que faltan hasta el final de la fecha límite.

## Dónde se guardan los datos

En el **repositorio de GitHub**, como el archivo `data/carpetas.json` en la rama **`datos`**. Cada cambio (crear, editar, eliminar) queda como un commit, así que tienes historial completo y puedes ver o restaurar versiones anteriores desde GitHub.

Se usa una rama separada y los commits llevan `[skip netlify]` para que guardar datos **no** dispare un nuevo despliegue.

## Configuración (una sola vez)

### 1. Crear el token de GitHub
1. GitHub → foto de perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. *Repository access*: **Only select repositories** → `ContadorAOPEI`.
3. *Permissions → Repository permissions → Contents*: **Read and write**.
4. Genera el token y cópialo (solo se muestra una vez).

### 2. Configurarlo en Netlify
1. En tu proyecto de Netlify: **Project configuration → Environment variables → Add a variable**.
2. Clave: `GITHUB_TOKEN` · Valor: el token copiado.
3. (Opcional) `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_FILE` si quieres cambiar los valores por defecto.
4. **Deploys → Trigger deploy → Deploy site**.

La primera vez que guardes una carpeta se crea automáticamente la rama `datos` y el archivo.

## Despliegue
El proyecto se despliega desde GitHub (Netlify → Import an existing project). `netlify.toml` ya define la carpeta publicada y las funciones.

Si falta el token o se sube solo la carpeta `public`, la app funciona en **modo local** (datos solo en el navegador) y lo indica con un aviso amarillo.

## Ejecutar localmente
```bash
npm install
npm start
```
Abre `http://localhost:3000`. Localmente los datos se guardan en `data/carpetas.local.json` (no se sube a GitHub).

## API
- `GET /api/carpetas`
- `GET /api/carpetas/:id`
- `POST /api/carpetas`
- `PUT /api/carpetas/:id`
- `DELETE /api/carpetas/:id`

## Seguridad
- El token solo vive en Netlify; nunca lo pongas en el código.
- Cualquiera que tenga el enlace del sitio puede ver y editar las carpetas. Si necesitas restringirlo, Netlify permite proteger el sitio con contraseña (planes de pago) o se puede agregar un inicio de sesión.
