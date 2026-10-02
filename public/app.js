let items = [];
let mode = 'api';          // 'api' (GitHub) o 'local' (navegador)
let stageFilter = 'all';
const $ = id => document.getElementById(id);
const API = '/api/carpetas';
const LS_KEY = 'recompensasGASOP.carpetas';
const STAGES = { radicada: 'Radicada', consolidada: 'Consolidada', por_pagar: 'Por pagar' };

/* ---------- Respaldo local (solo si la API no está disponible) ---------- */
function lsRead(){try{const v=JSON.parse(localStorage.getItem(LS_KEY));if(Array.isArray(v))return v}catch{}return[]}
function lsWrite(list){try{localStorage.setItem(LS_KEY,JSON.stringify(list))}catch{}}
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const local={
  list(){return lsRead().sort((a,b)=>a.due_date.localeCompare(b.due_date))},
  create(d){const list=lsRead();const id=list.reduce((m,p)=>Math.max(m,p.id),0)+1;const now=new Date().toISOString();list.push({status:'active',...d,id,created_at:now,updated_at:now});lsWrite(list)},
  update(id,d){const list=lsRead();const i=list.findIndex(p=>p.id===id);if(i<0)throw new Error('Carpeta no encontrada');list[i]={...list[i],...d,updated_at:new Date().toISOString()};lsWrite(list)},
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
const apiMissing=e=>e.status===404||e.code==='NO_STORAGE'||e instanceof TypeError;

function setBanner(text){const b=$('modeBanner');b.textContent=text;b.classList.toggle('hidden',!text)}

async function load(){
  if(mode==='api'){
    try{items=await api(API);render();return}
    catch(e){
      if(!apiMissing(e)){showError(e);return}
      mode='local';
      setBanner(e.code==='NO_STORAGE'
        ?'Modo local: falta configurar GITHUB_TOKEN en Netlify. Los datos se guardan solo en este navegador.'
        :'Modo local: no se encontró la API (¿subiste solo la carpeta public?). Los datos se guardan solo en este navegador.');
    }
  }
  items=local.list();render();
}
function showError(e){$('grid').innerHTML=`<div class="card"><h3>No se pudieron cargar las carpetas</h3><div class="meta">${esc(e.message)}</div></div>`}

async function save(id,data){
  if(mode==='local'){id?local.update(id,data):local.create(data);return}
  await api(id?`${API}/${id}`:API,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}
async function del(id){
  if(mode==='local'){local.remove(id);return}
  await api(`${API}/${id}`,{method:'DELETE'});
}

/* ---------- Fechas (solo día, sin horas) ---------- */
function parseDay(s){const[y,m,d]=String(s||'').slice(0,10).split('-').map(Number);return new Date(y,(m||1)-1,d||1)}
const fmtDay=s=>s?parseDay(s).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}):'—';
function todayStr(){const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
// Cuenta hasta el final del día límite (23:59:59 hora local)
function remaining(due){
  const end=parseDay(due);end.setHours(23,59,59,999);
  const ms=end-new Date();
  if(ms<=0)return{text:'VENCIDA',days:0,hours:0,overdue:true};
  const days=Math.floor(ms/86400000),hours=Math.floor((ms%86400000)/3600000);
  return{text:`${days}d ${String(hours).padStart(2,'0')}h`,days,hours,overdue:false};
}

/* ---------- Render ---------- */
function status(p){if(p.status==='completed')return['Completada',''];const r=remaining(p.due_date);if(r.overdue)return['Vencida','danger'];if(r.days<1)return['Crítica','danger'];if(r.days<3)return['Próxima a vencer','warn'];return['En tiempo','']}
const isUrgent=p=>{if(p.status==='completed')return false;const r=remaining(p.due_date);return!r.overdue&&r.days<3};
function render(){
  const q=$('search').value.toLowerCase();
  const list=items.filter(p=>(stageFilter==='all'||p.stage===stageFilter)&&(p.name+' '+p.responsible+' '+p.level+' '+p.value+' '+(STAGES[p.stage]||'')).toLowerCase().includes(q));
  $('total').textContent=items.length;
  Object.keys(STAGES).forEach(s=>$('st_'+s).textContent=items.filter(p=>p.stage===s).length);
  $('urgent').textContent=items.filter(isUrgent).length;
  $('grid').innerHTML=list.map(card).join('')||`<div class="card empty">${items.length?'No hay carpetas que coincidan.':'Aún no hay carpetas. Pulsa “+ Nueva carpeta” para crear la primera.'}</div>`;
}
function card(p){
  const r=remaining(p.due_date),s=status(p),cls=s[1]?' '+s[1]:'',done=p.status==='completed',prog=clamp(p.progress);
  return `<article class="card${cls}"><div class="card-top"><h3>${esc(p.name)}</h3><span class="stage stage-${esc(p.stage)}">${esc(STAGES[p.stage]||'Radicada')}</span></div><div class="meta">Responsable: <b>${esc(p.responsible)}</b><br>Nivel: ${esc(p.level)} · Valor: ${esc(p.value)}<br>Inicio: ${fmtDay(p.start_date)} · Límite: ${fmtDay(p.due_date)}</div><div class="timer ${r.overdue||done?'overdue':''}">${done?'COMPLETADA':r.text}<small>${done?'':' restantes'}</small></div><span class="badge ${s[1]}">${s[0]}</span><div class="progress"><i style="width:${prog}%"></i></div><div class="foot"><span>Avance ${prog}%</span><span>Prioridad ${esc(p.priority)}</span></div><div class="meta" style="margin-top:12px">${esc(p.observations||'Sin observaciones')}</div><div class="actions"><button class="btn" onclick="edit(${p.id})">Editar</button><button class="btn" onclick="complete(${p.id})">${done?'Reactivar':'Completar'}</button><button class="btn" onclick="removeItem(${p.id})">Eliminar</button></div></article>`;
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

/* ---------- Modal y acciones ---------- */
function openModal(p=null){
  $('modal').classList.remove('hidden');
  $('modalTitle').textContent=p?'Editar carpeta':'Nueva carpeta';
  $('id').value=p?.id||'';
  ['name','responsible','level','value','priority','progress','observations','stage'].forEach(k=>$(k).value=p?.[k]??({priority:'Media',progress:0,stage:stageFilter==='all'?'radicada':stageFilter}[k]??''));
  $('start_date').value=p?String(p.start_date).slice(0,10):todayStr();
  $('due_date').value=p?String(p.due_date).slice(0,10):'';
}
const closeModal=()=>$('modal').classList.add('hidden');
$('newBtn').onclick=()=>openModal();
$('closeBtn').onclick=$('cancelBtn').onclick=closeModal;
$('search').oninput=render;
$('tabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;stageFilter=b.dataset.stage;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));render()};

$('projectForm').onsubmit=async e=>{
  e.preventDefault();
  const data={name:$('name').value.trim(),responsible:$('responsible').value.trim(),level:$('level').value.trim(),value:$('value').value.trim(),start_date:$('start_date').value,due_date:$('due_date').value,stage:$('stage').value,priority:$('priority').value,progress:clamp($('progress').value),observations:$('observations').value.trim()};
  if(data.due_date<data.start_date){alert('La fecha límite debe ser igual o posterior a la fecha de inicio.');return}
  const id=Number($('id').value)||null,btn=$('saveBtn');
  btn.disabled=true;btn.textContent='Guardando…';
  try{await save(id,data);closeModal();await load()}catch(err){alert(err.message)}
  finally{btn.disabled=false;btn.textContent='Guardar carpeta'}
};
window.edit=id=>openModal(items.find(p=>p.id===id));
window.complete=async id=>{const p=items.find(x=>x.id===id);const d=p.status==='completed'?{status:'active'}:{status:'completed',progress:100};try{await save(id,d);await load()}catch(e){alert(e.message)}};
window.removeItem=async id=>{if(!confirm('¿Eliminar carpeta?'))return;try{await del(id);await load()}catch(e){alert(e.message)}};

load();
setInterval(render,60000);
setInterval(()=>{if($('modal').classList.contains('hidden'))load()},300000);
