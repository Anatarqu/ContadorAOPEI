let projects = [];
let mode = 'api'; // 'api' (servidor/BD) o 'local' (navegador)
const $ = id => document.getElementById(id);
const LS_KEY = 'contadorAOPEI.projects';

/* ---------- Almacenamiento local (respaldo cuando no hay API) ---------- */
const seed = [
  {id:1,name:'Implementación ERP',responsible:'Andrés Atila',level:'Estratégico',value:'150000000 COP',start_date:'2026-09-20T13:00:00.000Z',due_date:'2026-10-03T23:00:00.000Z',priority:'Alta',progress:62,observations:'Finalizar inventario, integración y pruebas de aceptación.',status:'active'},
  {id:2,name:'Auditoría de ciberseguridad',responsible:'Laura Gómez',level:'Táctico',value:'45000000 COP',start_date:'2026-09-20T14:00:00.000Z',due_date:'2026-09-22T22:00:00.000Z',priority:'Crítica',progress:35,observations:'Revisar controles, evidencias y plan de remediación.',status:'active'},
  {id:3,name:'Migración de servidores',responsible:'Carlos Pérez',level:'Operativo',value:'80000000 COP',start_date:'2026-09-18T13:00:00.000Z',due_date:'2026-09-29T01:00:00.000Z',priority:'Media',progress:78,observations:'Migración por lotes y validación de servicios críticos.',status:'active'}
];
function lsRead(){try{const v=JSON.parse(localStorage.getItem(LS_KEY));if(Array.isArray(v))return v}catch{}lsWrite(seed);return seed.map(p=>({...p}))}
function lsWrite(list){try{localStorage.setItem(LS_KEY,JSON.stringify(list))}catch{}}
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const local = {
  list(){return lsRead().sort((a,b)=>new Date(a.due_date)-new Date(b.due_date))},
  create(d){const list=lsRead();const id=list.reduce((m,p)=>Math.max(m,p.id),0)+1;const now=new Date().toISOString();list.push({...d,id,progress:clamp(d.progress),priority:d.priority||'Media',status:'active',created_at:now,updated_at:now});lsWrite(list)},
  update(id,d){const list=lsRead();const i=list.findIndex(p=>p.id===id);if(i<0)throw new Error('Proyecto no encontrado');list[i]={...list[i],...d,progress:clamp(d.progress??list[i].progress),updated_at:new Date().toISOString()};lsWrite(list)},
  remove(id){lsWrite(lsRead().filter(p=>p.id!==id))}
};

/* ---------- API ---------- */
async function api(url,options={}){
  const r=await fetch(url,options);
  const isJson=(r.headers.get('content-type')||'').includes('application/json');
  if(!r.ok){let e={};if(isJson){try{e=await r.json()}catch{}}const err=new Error(e.error||`HTTP ${r.status}`);err.status=r.status;err.code=e.code;throw err}
  if(r.status===204)return null;
  if(!isJson){const err=new Error('La API no está disponible');err.status=404;throw err}
  return r.json();
}
// Si la API no existe (subida solo de archivos estáticos) o no tiene BD, usar modo local.
const apiMissing=e=>e.status===404||e.status===503||e.code==='NO_DATABASE'||e instanceof TypeError;

async function load(){
  if(mode==='api'){
    try{projects=await api('/api/projects');render();return}
    catch(e){if(!apiMissing(e)){showError(e);return}mode='local';$('modeBanner').classList.remove('hidden')}
  }
  projects=local.list();render();
}
function showError(e){$('grid').innerHTML=`<div class="card"><h3>No se pudieron cargar los proyectos</h3><div class="meta">${esc(e.message)}</div></div>`}

async function save(id,data){
  if(mode==='local'){id?local.update(id,data):local.create(data);return}
  await api(id?`/api/projects/${id}`:'/api/projects',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}
async function del(id){
  if(mode==='local'){local.remove(id);return}
  await api('/api/projects/'+id,{method:'DELETE'});
}

/* ---------- Fechas ---------- */
// datetime-local ("2026-09-20T08:00", hora local) -> ISO con zona horaria
const toISO=v=>v?new Date(v).toISOString():'';
// ISO -> valor válido para <input type="datetime-local">
function toLocalInput(v){if(!v)return'';const d=new Date(v);if(isNaN(d))return'';const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}

/* ---------- Render ---------- */
function remaining(due){const ms=new Date(due)-new Date();if(ms<=0)return{text:'VENCIDO',days:0,hours:0,overdue:true};const days=Math.floor(ms/86400000);const hours=Math.floor((ms%86400000)/3600000);return{text:`${days}d ${String(hours).padStart(2,'0')}h`,days,hours,overdue:false}}
function status(p){if(p.status==='completed')return['Completado',''];const r=remaining(p.due_date);if(r.overdue)return['Vencido','danger'];if(r.days<1)return['Crítico','danger'];if(r.days<3)return['Próximo a vencer','warn'];return['En tiempo','']}
function render(){
  const q=$('search').value.toLowerCase();
  const list=projects.filter(p=>(p.name+' '+p.responsible+' '+p.level+' '+p.value).toLowerCase().includes(q));
  $('total').textContent=projects.length;
  $('active').textContent=projects.filter(p=>p.status==='active').length;
  $('urgent').textContent=projects.filter(p=>{if(p.status!=='active')return false;const r=remaining(p.due_date);return!r.overdue&&r.days<3}).length;
  $('done').textContent=projects.filter(p=>p.status==='completed').length;
  $('grid').innerHTML=list.map(card).join('')||'<div class="card">No hay proyectos que coincidan.</div>';
}
function card(p){
  const r=remaining(p.due_date),s=status(p),cls=s[1]?' '+s[1]:'',done=p.status==='completed',prog=clamp(p.progress);
  return `<article class="card${cls}"><h3>${esc(p.name)}</h3><div class="meta">Responsable: <b>${esc(p.responsible)}</b><br>Nivel: ${esc(p.level)} · Valor: ${esc(p.value)}<br>Vence: ${new Date(p.due_date).toLocaleString('es-CO')}</div><div class="timer ${r.overdue||done?'overdue':''}">${done?'COMPLETADO':r.text}<small>${done?'':' restantes'}</small></div><span class="badge ${s[1]}">${s[0]}</span><div class="progress"><i style="width:${prog}%"></i></div><div class="foot"><span>Avance ${prog}%</span><span>Prioridad ${esc(p.priority)}</span></div><div class="meta" style="margin-top:12px">${esc(p.observations||'Sin observaciones')}</div><div class="actions"><button class="btn" onclick="edit(${p.id})">Editar</button><button class="btn" onclick="complete(${p.id})">${done?'Reactivar':'Completar'}</button><button class="btn" onclick="removeProject(${p.id})">Eliminar</button></div></article>`;
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

/* ---------- Modal y acciones ---------- */
function openModal(p=null){
  $('modal').classList.remove('hidden');
  $('modalTitle').textContent=p?'Editar proyecto':'Nuevo proyecto';
  $('id').value=p?.id||'';
  ['name','responsible','level','value','priority','progress','observations'].forEach(k=>$(k).value=p?.[k]??(k==='priority'?'Media':k==='progress'?0:''));
  $('start_date').value=toLocalInput(p?.start_date);
  $('due_date').value=toLocalInput(p?.due_date);
}
const closeModal=()=>$('modal').classList.add('hidden');
$('newBtn').onclick=()=>openModal();
$('closeBtn').onclick=$('cancelBtn').onclick=closeModal;
$('search').oninput=render;

$('projectForm').onsubmit=async e=>{
  e.preventDefault();
  const data={name:$('name').value.trim(),responsible:$('responsible').value.trim(),level:$('level').value.trim(),value:$('value').value.trim(),start_date:toISO($('start_date').value),due_date:toISO($('due_date').value),priority:$('priority').value,progress:clamp($('progress').value),observations:$('observations').value.trim()};
  if(new Date(data.due_date)<new Date(data.start_date)){alert('La fecha límite debe ser posterior a la fecha de inicio.');return}
  const id=Number($('id').value)||null;
  try{await save(id,data);closeModal();await load()}catch(err){alert(err.message)}
};
window.edit=id=>openModal(projects.find(p=>p.id===id));
window.complete=async id=>{const p=projects.find(x=>x.id===id);const d=p.status==='completed'?{status:'active',progress:p.progress}:{status:'completed',progress:100};try{await save(id,d);await load()}catch(e){alert(e.message)}};
window.removeProject=async id=>{if(!confirm('¿Eliminar proyecto?'))return;try{await del(id);await load()}catch(e){alert(e.message)}};

load();
setInterval(render,60000);
setInterval(load,300000);
