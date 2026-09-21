# Project Timer

Aplicación web de gestión de proyectos con cuenta regresiva en **días y horas**, responsables, observaciones, Nivel y Valor.

## Stack
- Node.js + Express
- SQLite mediante better-sqlite3
- HTML/CSS/JavaScript sin framework
- Tema negro/verde

## Ejecutar
Requiere Node.js 18+.

```bash
npm install
npm start
```

Abrir: http://localhost:3000

La base `data.db` se crea automáticamente y se cargan 3 proyectos de ejemplo en el primer arranque.

## Campos
- Nombre
- Responsable
- Nivel (manual)
- Valor (manual)
- Fecha de inicio
- Fecha límite
- Prioridad
- Avance
- Observaciones

El contador muestra únicamente **días y horas**. El servidor expone CRUD básico mediante `/api/projects`.
