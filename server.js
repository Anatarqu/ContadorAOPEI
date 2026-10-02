// Servidor solo para pruebas locales (npm start). En Netlify se usa la función que guarda en GitHub.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'data', 'carpetas.local.json');
const STAGES = ['radicada', 'consolidada', 'por_pagar'];

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } };
const write = list => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(list, null, 2)); };
const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));
const clean = (p, base = {}) => {
  const x = { ...base, ...p };
  return { ...x, id: base.id, progress: clamp(x.progress), stage: STAGES.includes(x.stage) ? x.stage : 'radicada',
    status: x.status === 'completed' ? 'completed' : 'active', start_date: String(x.start_date || '').slice(0, 10),
    due_date: String(x.due_date || '').slice(0, 10), created_at: base.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
};
const invalid = p => ['name', 'responsible', 'level', 'value', 'start_date', 'due_date'].some(k => !p[k]) ? 'Faltan campos obligatorios.'
  : p.due_date < p.start_date ? 'La fecha límite debe ser igual o posterior a la fecha de inicio.' : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/carpetas', (req, res) => res.json(read().sort((a, b) => a.due_date.localeCompare(b.due_date))));
app.post('/api/carpetas', (req, res) => {
  const list = read(); const item = clean(req.body, { id: list.reduce((m, p) => Math.max(m, p.id), 0) + 1 });
  const err = invalid(item); if (err) return res.status(400).json({ error: err });
  list.push(item); write(list); res.status(201).json(item);
});
app.put('/api/carpetas/:id', (req, res) => {
  const list = read(); const i = list.findIndex(p => p.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: 'Carpeta no encontrada' });
  const item = clean(req.body, list[i]); const err = invalid(item); if (err) return res.status(400).json({ error: err });
  list[i] = item; write(list); res.json(item);
});
app.delete('/api/carpetas/:id', (req, res) => { write(read().filter(p => p.id !== Number(req.params.id))); res.status(204).end(); });
app.listen(PORT, () => console.log(`Recompensas GASOP local: http://localhost:${PORT}`));
