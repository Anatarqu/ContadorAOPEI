// Netlify Function (API v2): recibe un Request y devuelve un Response.
import postgres from 'postgres';

// La ruta se declara aquí; no hacen falta redirects en netlify.toml.
export const config = { path: ['/api/projects', '/api/projects/:id'] };

const connectionString =
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DB_URL ||
  process.env.DATABASE_URL;

let sql = null;
let ready = null;

function getSql() {
  if (!connectionString) return null;
  if (!sql) {
    sql = postgres(connectionString, { max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require' });
  }
  return sql;
}

async function init(db) {
  await db`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      responsible TEXT NOT NULL,
      level TEXT NOT NULL,
      value TEXT NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Media',
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      observations TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM projects`;
  if (count === 0) {
    await db`
      INSERT INTO projects (name,responsible,level,value,start_date,due_date,priority,progress,observations,status)
      VALUES
      ('Implementación ERP','Andrés Atila','Estratégico','150000000 COP','2026-09-20T08:00:00-05:00','2026-10-03T18:00:00-05:00','Alta',62,'Finalizar inventario, integración y pruebas de aceptación.','active'),
      ('Auditoría de ciberseguridad','Laura Gómez','Táctico','45000000 COP','2026-09-20T09:00:00-05:00','2026-09-22T17:00:00-05:00','Crítica',35,'Revisar controles, evidencias y plan de remediación.','active'),
      ('Migración de servidores','Carlos Pérez','Operativo','80000000 COP','2026-09-18T08:00:00-05:00','2026-09-28T20:00:00-05:00','Media',78,'Migración por lotes y validación de servicios críticos.','active')
    `;
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));

export default async (req, context) => {
  const db = getSql();
  if (!db) {
    return json({ error: 'Base de datos no configurada', code: 'NO_DATABASE' }, 503);
  }
  try {
    if (!ready) ready = init(db).catch(e => { ready = null; throw e; });
    await ready;

    const method = req.method;
    const id = context.params?.id ? Number(context.params.id) : null;
    if (context.params?.id && !Number.isInteger(id)) return json({ error: 'ID inválido' }, 400);

    if (method === 'GET') {
      if (id) {
        const rows = await db`SELECT * FROM projects WHERE id=${id}`;
        return rows[0] ? json(rows[0]) : json({ error: 'Proyecto no encontrado' }, 404);
      }
      return json(await db`SELECT * FROM projects ORDER BY due_date ASC`);
    }

    let body = {};
    if (method === 'POST' || method === 'PUT') {
      try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    }

    if (method === 'POST') {
      const required = ['name', 'responsible', 'level', 'value', 'start_date', 'due_date'];
      const missing = required.filter(k => !body[k]);
      if (missing.length) return json({ error: `Campos obligatorios: ${missing.join(', ')}` }, 400);
      const [row] = await db`
        INSERT INTO projects (name,responsible,level,value,start_date,due_date,priority,progress,observations,status)
        VALUES (${body.name},${body.responsible},${body.level},${body.value},${body.start_date},${body.due_date},
                ${body.priority || 'Media'},${clamp(body.progress)},${body.observations || ''},'active')
        RETURNING *
      `;
      return json(row, 201);
    }

    if (method === 'PUT') {
      if (!id) return json({ error: 'ID requerido' }, 400);
      const current = await db`SELECT * FROM projects WHERE id=${id}`;
      if (!current[0]) return json({ error: 'Proyecto no encontrado' }, 404);
      const p = { ...current[0], ...body };
      const [row] = await db`
        UPDATE projects SET name=${p.name}, responsible=${p.responsible}, level=${p.level}, value=${p.value},
          start_date=${p.start_date}, due_date=${p.due_date}, priority=${p.priority}, progress=${clamp(p.progress)},
          observations=${p.observations || ''}, status=${p.status || 'active'}, updated_at=NOW()
        WHERE id=${id} RETURNING *
      `;
      return json(row);
    }

    if (method === 'DELETE') {
      if (!id) return json({ error: 'ID requerido' }, 400);
      await db`DELETE FROM projects WHERE id=${id}`;
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Método no permitido' }, 405);
  } catch (error) {
    console.error(error);
    return json({ error: 'Error interno', detail: error.message }, 500);
  }
};
