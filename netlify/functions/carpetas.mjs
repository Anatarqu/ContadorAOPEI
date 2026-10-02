// Recompensas GASOP — API de carpetas.
// Guarda los datos como un archivo JSON dentro del repositorio de GitHub.
//
// Variables de entorno (Netlify → Project configuration → Environment variables):
//   GITHUB_TOKEN   (obligatoria) token fine-grained con permiso "Contents: Read and write" sobre el repo
//   GITHUB_REPO    (opcional) por defecto "Anatarqu/ContadorAOPEI"
//   GITHUB_BRANCH  (opcional) por defecto "datos"  — rama separada para no disparar despliegues
//   GITHUB_FILE    (opcional) por defecto "data/carpetas.json"

export const config = { path: ['/api/carpetas', '/api/carpetas/:id'] };

const TOKEN  = process.env.GITHUB_TOKEN;
const REPO   = process.env.GITHUB_REPO   || 'Anatarqu/ContadorAOPEI';
const BRANCH = process.env.GITHUB_BRANCH || 'datos';
const FILE   = process.env.GITHUB_FILE   || 'data/carpetas.json';
const GH = 'https://api.github.com';

const STAGES = ['radicada', 'consolidada', 'por_pagar'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function gh(path, options = {}) {
  const r = await fetch(GH + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'recompensas-gasop',
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, ok: r.ok, body };
}

const enc = encodeURIComponent;
const filePath = FILE.split('/').map(enc).join('/');

// Crea la rama de datos a partir de la rama principal si aún no existe.
async function ensureBranch() {
  const ref = await gh(`/repos/${REPO}/git/ref/heads/${enc(BRANCH)}`);
  if (ref.ok) return;
  if (ref.status === 401 || ref.status === 403) throw new HttpError(500, 'El token de GitHub no tiene permisos sobre el repositorio.');
  const repo = await gh(`/repos/${REPO}`);
  if (!repo.ok) throw new HttpError(500, `No se encontró el repositorio ${REPO} o el token no tiene acceso.`);
  const base = await gh(`/repos/${REPO}/git/ref/heads/${enc(repo.body.default_branch)}`);
  if (!base.ok) throw new HttpError(500, 'El repositorio está vacío: sube primero el código a GitHub.');
  const created = await gh(`/repos/${REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: base.body.object.sha })
  });
  if (!created.ok && created.status !== 422) throw new HttpError(500, `No se pudo crear la rama "${BRANCH}".`);
}

async function readData() {
  const r = await gh(`/repos/${REPO}/contents/${filePath}?ref=${enc(BRANCH)}`);
  if (r.status === 404) return { list: [], sha: null };
  if (!r.ok) throw new HttpError(500, `GitHub respondió ${r.status} al leer los datos.`);
  const list = JSON.parse(Buffer.from(r.body.content || '', 'base64').toString('utf8') || '[]');
  return { list: Array.isArray(list) ? list : [], sha: r.body.sha };
}

async function writeData(list, sha, message) {
  return gh(`/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `${message} [skip netlify]`,
      content: Buffer.from(JSON.stringify(list, null, 2) + '\n', 'utf8').toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    })
  });
}

// Lee, modifica y guarda. Si otra persona guardó al mismo tiempo, reintenta.
async function mutate(fn, message) {
  await ensureBranch();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { list, sha } = await readData();
    const result = fn(list);
    const w = await writeData(list, sha, message);
    if (w.ok) return result;
    if (w.status !== 409 && w.status !== 422) throw new HttpError(500, `GitHub respondió ${w.status} al guardar.`);
  }
  throw new HttpError(409, 'Conflicto al guardar, intenta de nuevo.');
}

const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));

function clean(input, base = {}) {
  const p = { ...base, ...input };
  return {
    id: base.id,
    name: String(p.name ?? '').trim(),
    responsible: String(p.responsible ?? '').trim(),
    level: String(p.level ?? '').trim(),
    value: String(p.value ?? '').trim(),
    start_date: String(p.start_date ?? '').slice(0, 10),
    due_date: String(p.due_date ?? '').slice(0, 10),
    priority: p.priority || 'Media',
    progress: clamp(p.progress),
    observations: String(p.observations ?? '').trim(),
    stage: STAGES.includes(p.stage) ? p.stage : 'radicada',
    status: p.status === 'completed' ? 'completed' : 'active',
    created_at: base.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function validate(p) {
  const missing = ['name', 'responsible', 'level', 'value', 'start_date', 'due_date'].filter(k => !p[k]);
  if (missing.length) throw new HttpError(400, `Campos obligatorios: ${missing.join(', ')}`);
  if (!DATE_RE.test(p.start_date) || !DATE_RE.test(p.due_date)) throw new HttpError(400, 'Las fechas deben tener formato AAAA-MM-DD.');
  if (p.due_date < p.start_date) throw new HttpError(400, 'La fecha límite debe ser igual o posterior a la fecha de inicio.');
}

export default async (req, context) => {
  if (!TOKEN) return json({ error: 'Falta configurar GITHUB_TOKEN en Netlify', code: 'NO_STORAGE' }, 503);
  try {
    const method = req.method;
    const id = context.params?.id ? Number(context.params.id) : null;
    if (context.params?.id && !Number.isInteger(id)) return json({ error: 'ID inválido' }, 400);

    if (method === 'GET') {
      await ensureBranch();
      const { list } = await readData();
      if (id) {
        const item = list.find(p => p.id === id);
        return item ? json(item) : json({ error: 'Carpeta no encontrada' }, 404);
      }
      return json(list.sort((a, b) => a.due_date.localeCompare(b.due_date)));
    }

    let body = {};
    if (method === 'POST' || method === 'PUT') {
      try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    }

    if (method === 'POST') {
      const item = await mutate(list => {
        const next = clean(body, { id: list.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1 });
        validate(next);
        list.push(next);
        return next;
      }, `Nueva carpeta: ${String(body.name || '').slice(0, 60)}`);
      return json(item, 201);
    }

    if (method === 'PUT') {
      if (!id) return json({ error: 'ID requerido' }, 400);
      const item = await mutate(list => {
        const i = list.findIndex(p => p.id === id);
        if (i < 0) throw new HttpError(404, 'Carpeta no encontrada');
        const next = clean(body, list[i]);
        validate(next);
        list[i] = next;
        return next;
      }, `Actualizar carpeta #${id}`);
      return json(item);
    }

    if (method === 'DELETE') {
      if (!id) return json({ error: 'ID requerido' }, 400);
      await mutate(list => {
        const i = list.findIndex(p => p.id === id);
        if (i >= 0) list.splice(i, 1);
      }, `Eliminar carpeta #${id}`);
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Método no permitido' }, 405);
  } catch (error) {
    if (!error.status || error.status >= 500) console.error(error);
    return json({ error: error.message || 'Error interno' }, error.status || 500);
  }
};
