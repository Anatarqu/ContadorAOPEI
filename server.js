const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'data.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  responsible TEXT NOT NULL,
  level TEXT NOT NULL,
  value TEXT NOT NULL,
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Media',
  progress INTEGER NOT NULL DEFAULT 0,
  observations TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

const count = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
if (count === 0) {
  const insert = db.prepare(`INSERT INTO projects (name,responsible,level,value,start_date,due_date,priority,progress,observations,status) VALUES (@name,@responsible,@level,@value,@start_date,@due_date,@priority,@progress,@observations,@status)`);
  insert.run({name:'Implementación ERP',responsible:'Andrés Atila',level:'Estratégico',value:'150000000 COP',start_date:'2026-09-20T08:00',due_date:'2026-10-03T18:00',priority:'Alta',progress:62,observations:'Finalizar inventario, integración y pruebas de aceptación.',status:'active'});
  insert.run({name:'Auditoría de ciberseguridad',responsible:'Laura Gómez',level:'Táctico',value:'45000000 COP',start_date:'2026-09-20T09:00',due_date:'2026-09-22T17:00',priority:'Crítica',progress:35,observations:'Revisar controles, evidencias y plan de remediación.',status:'active'});
  insert.run({name:'Migración de servidores',responsible:'Carlos Pérez',level:'Operativo',value:'80000000 COP',start_date:'2026-09-18T08:00',due_date:'2026-09-28T20:00',priority:'Media',progress:78,observations:'Migración por lotes y validación de servicios críticos.',status:'active'});
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/projects', (req,res)=>res.json(db.prepare('SELECT * FROM projects ORDER BY due_date ASC').all()));
app.post('/api/projects',(req,res)=>{
  const p=req.body;
  if(!p.name||!p.responsible||!p.level||!p.value||!p.start_date||!p.due_date)return res.status(400).json({error:'Nombre, responsable, nivel, valor, fecha de inicio y fecha límite son obligatorios.'});
  const info=db.prepare(`INSERT INTO projects (name,responsible,level,value,start_date,due_date,priority,progress,observations,status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(p.name,p.responsible,p.level,p.value,p.start_date,p.due_date,p.priority||'Media',Math.max(0,Math.min(100,Number(p.progress)||0)),p.observations||'','active');
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id=?').get(info.lastInsertRowid));
});
app.put('/api/projects/:id',(req,res)=>{
  const id=Number(req.params.id), current=db.prepare('SELECT * FROM projects WHERE id=?').get(id);
  if(!current)return res.status(404).json({error:'Proyecto no encontrado'});
  const p={...current,...req.body};
  db.prepare(`UPDATE projects SET name=?,responsible=?,level=?,value=?,start_date=?,due_date=?,priority=?,progress=?,observations=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(p.name,p.responsible,p.level,p.value,p.start_date,p.due_date,p.priority,Math.max(0,Math.min(100,Number(p.progress)||0)),p.observations||'',p.status||'active',id);
  res.json(db.prepare('SELECT * FROM projects WHERE id=?').get(id));
});
app.delete('/api/projects/:id',(req,res)=>{db.prepare('DELETE FROM projects WHERE id=?').run(Number(req.params.id));res.status(204).end()});
app.listen(PORT,()=>console.log(`ContadorAOPEI local: http://localhost:${PORT}`));
