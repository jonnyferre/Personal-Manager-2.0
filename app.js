
'use strict';

/* ===================== Helpers ===================== */
const $ = (s, el=document) => el.querySelector(s);
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const pad2 = (x) => String(x).padStart(2,'0');
const fmtISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseISO = (s) => { const [y,m,d]=(s||'').split('-').map(n=>parseInt(n,10)); if(!y||!m||!d) return null; return new Date(y,m-1,d); };
const monthName = (m)=>['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];
const fmtEUR = (n)=>Number(n||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});

function el(tag, attrs={}, children=[]){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') n.className=v;
    else if(k==='text') n.textContent=v;
    else if(k==='html') n.innerHTML=v;
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k,v);
  }
  for(const c of children){ if(c==null) continue; if(typeof c==='string') n.appendChild(document.createTextNode(c)); else n.appendChild(c); }
  return n;
}
function help(t){ return el('div',{class:'minihelp',text:t}); }
function kpiItem(label, value, hint){
  return el('div',{class:'kpi__item'},[
    el('div',{class:'kpi__label',text:label}),
    el('div',{class:'kpi__value',text:value}),
    el('div',{class:'kpi__hint',text:hint})
  ]);
}
function modalFoot(btns){
  const w=el('div');
  btns.forEach(b=>{
    const bt=el('button',{class:b.kind||'btn',text:b.text});
    bt.addEventListener('click', b.onClick);
    w.appendChild(bt);
  });
  return w;
}
function fieldText(label, val, ph, onChange, type='text'){
  const w=el('div',{class:'field'});
  w.appendChild(el('div',{class:'label',text:label}));
  const i=el('input',{class:'input',value:val??'',placeholder:ph??'',type});
  i.addEventListener('input',()=>onChange(i.value));
  w.appendChild(i); return w;
}
function fieldNumber(label, val, ph, onChange, step='0.01'){
  const w=el('div',{class:'field'});
  w.appendChild(el('div',{class:'label',text:label}));
  const i=el('input',{class:'input',value:(val??''),placeholder:ph??'',type:'number',step});
  i.addEventListener('input',()=>onChange(i.value===''?'':Number(i.value)));
  w.appendChild(i); return w;
}
function fieldDate(label, val, onChange){
  const w=el('div',{class:'field'});
  w.appendChild(el('div',{class:'label',text:label}));
  const i=el('input',{class:'input',value:val??'',type:'date'});
  i.addEventListener('input',()=>onChange(i.value));
  w.appendChild(i); return w;
}
function fieldSelect(label, val, opts, onChange){
  const w=el('div',{class:'field'});
  w.appendChild(el('div',{class:'label',text:label}));
  const s=el('select',{class:'select'});
  opts.forEach(o=>{
    const op=el('option',{value:o.value,text:o.label});
    if(String(o.value)===String(val)) op.selected=true;
    s.appendChild(op);
  });
  s.addEventListener('change',()=>onChange(s.value));
  w.appendChild(s); return w;
}

function fieldColor(label, val, onChange){
  const w=el('div',{class:'field'});
  w.appendChild(el('div',{class:'label',text:label}));
  const row=el('div',{class:'row',style:'gap:10px; align-items:center;'});
  const normalized=(val||'').trim();
  const init=(/^#?[0-9a-fA-F]{6}$/.test(normalized) ? (normalized.startsWith('#')?normalized:'#'+normalized) : '#7c3aed');
  const color=el('input',{class:'input',type:'color',value:init});
  const text=el('input',{class:'input',type:'text',value:(normalized||init),placeholder:'#RRGGBB'});

  function apply(v){
    let x=(v||'').trim();
    if(x && !x.startsWith('#')) x='#'+x;
    if(/^#[0-9a-fA-F]{6}$/.test(x)){
      color.value=x;
      text.value=x;
      onChange(x);
    }
  }
  color.addEventListener('input', ()=>apply(color.value));
  text.addEventListener('input', ()=>apply(text.value));

  const palette=['#22c55e','#60a5fa','#a78bfa','#f59e0b','#ef4444','#94a3b8','#7c3aed','#0ea5e9'];
  const chips=el('div',{class:'row',style:'flex-wrap:wrap; gap:10px; margin-top:10px;'});
  palette.forEach(p=>{
    const b=el('button',{class:'btn',type:'button',style:'padding:10px 12px; border-radius:999px; min-width:44px; display:flex; align-items:center; justify-content:center;'});
    b.appendChild(el('span',{class:'dot',style:`background:${p}; width:16px; height:16px; border-radius:999px; display:inline-block;`}));
    b.addEventListener('click',()=>apply(p));
    chips.appendChild(b);
  });

  row.appendChild(color);
  row.appendChild(text);
  w.appendChild(row);
  w.appendChild(chips);
  return w;
}
function toast(msg){
  const t=$('#toast');
  t.textContent=msg;
  t.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer=setTimeout(()=>t.classList.add('hidden'),1700);
}

/* ===================== Modal ===================== */
function openModal(title, body, foot){
  $('#modalTitle').textContent=title;
  const b=$('#modalBody'); const f=$('#modalFoot');
  b.innerHTML=''; f.innerHTML='';
  b.appendChild(body); f.appendChild(foot);
  $('#overlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
}
function closeModal(){
  $('#overlay').classList.add('hidden');
  document.body.style.overflow='';
}
$('#modalClose').addEventListener('click', closeModal);
$('#overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') closeModal(); });

/* ===================== Storage ===================== */
const KEY='pm_allinone_v1';
const defaults={
  app:{name:'Personal Manager'},
  economy:{
    ui:{tab:'accounts'},
    accounts:[{id:uid(),name:'Cuenta principal',bank:'',initialBalance:0,cards:[]}],
    movements:{},
    fixed:[],
    credits:[],
    goals:[]
  },
  work:{
    ui:{activeJobId:'', month:(new Date()).getMonth(), year:(new Date()).getFullYear()},
    turnTypes:[
      {id:'morning', label:'Mañana', color:'#22c55e', hours:8, kind:'work'},
      {id:'afternoon', label:'Tarde', color:'#60a5fa', hours:8, kind:'work'},
      {id:'night', label:'Noche', color:'#a78bfa', hours:8, kind:'work'},
      {id:'off', label:'Libre', color:'#94a3b8', hours:0, kind:'off'},
      {id:'oncall', label:'Velada', color:'#f59e0b', hours:0, kind:'velada'}
    ],
    jobs:[],
    overrides:{} // { [jobId]: { [dateISO]: {turnId, hoursWorked, extraHours, extraRate, oncallHours, oncallRate, note} } }
  },
  agenda:{
    ui:{month:(new Date()).getMonth(), year:(new Date()).getFullYear()},
    events:[] // {id,date,title,time,location,note}
  }
};
function load(){
  const raw=localStorage.getItem(KEY);
  if(!raw) return structuredClone(defaults);
  try{
    const d=JSON.parse(raw);
    const out=structuredClone(defaults);
    out.app={...out.app,...(d.app||{})};
    // economy
    out.economy={...out.economy,...(d.economy||{})};
    out.economy.ui={...out.economy.ui,...((d.economy||{}).ui||{})};
    out.economy.accounts=Array.isArray((d.economy||{}).accounts)? d.economy.accounts : out.economy.accounts;
    out.economy.movements=(d.economy||{}).movements||out.economy.movements;
    out.economy.fixed=Array.isArray((d.economy||{}).fixed)? d.economy.fixed : out.economy.fixed;
    out.economy.credits=Array.isArray((d.economy||{}).credits)? d.economy.credits : out.economy.credits;
    out.economy.goals=Array.isArray((d.economy||{}).goals)? d.economy.goals : out.economy.goals;
    out.economy.accounts.forEach(a=>{ if(!Array.isArray(a.cards)) a.cards=[]; });
    // work
    out.work={...out.work,...(d.work||{})};
    out.work.ui={...out.work.ui,...((d.work||{}).ui||{})};
    out.work.turnTypes=Array.isArray((d.work||{}).turnTypes)? d.work.turnTypes : out.work.turnTypes;
    out.work.jobs=Array.isArray((d.work||{}).jobs)? d.work.jobs : out.work.jobs;
    out.work.overrides=(d.work||{}).overrides||out.work.overrides;
    // agenda
    out.agenda={...out.agenda,...(d.agenda||{})};
    out.agenda.ui={...out.agenda.ui,...((d.agenda||{}).ui||{})};
    out.agenda.events=Array.isArray((d.agenda||{}).events)? d.agenda.events : out.agenda.events;
    return out;
  }catch{
    return structuredClone(defaults);
  }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state.data)); }

const state={ data:load(), view:'home', params:{}, stack:[], toastTimer:null };

/* ===================== Router / Topbar ===================== */
function setTopbar(title, subtitle, canBack, showAdd){
  $('#brandTitle').textContent=title;
  $('#viewSubtitle').textContent=subtitle||'';
  $('#btnBack').style.visibility=canBack?'visible':'hidden';
  $('#btnQuickAdd').style.visibility=showAdd?'visible':'hidden';
}
function push(view, params={}){ state.stack.push({view:state.view,params:state.params}); state.view=view; state.params=params; render(); }
function pop(){ const p=state.stack.pop(); if(!p){ state.view='home'; state.params={}; render(); return; } state.view=p.view; state.params=p.params; render(); }
$('#btnBack').addEventListener('click', pop);

/* ===================== Settings & QuickAdd ===================== */
$('#btnSettings').addEventListener('click', ()=>{
  const wrap=el('div',{class:'form'});
  let name=state.data.app.name||'Personal Manager';
  wrap.appendChild(fieldText('Nombre de la app', name, 'Nombre', v=>name=v));
  wrap.appendChild(help('Esto solo cambia el título en la barra superior.'));
  openModal('Ajustes', wrap, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:()=>{ state.data.app.name=(name||'Personal Manager'); save(); closeModal(); render(); }},
    {text:'Reset (borrar todo)',kind:'btn bad',onClick:()=>{
      if(!confirm('¿Seguro? Esto borrará TODO.')) return;
      localStorage.removeItem(KEY);
      state.data=load();
      state.view='home'; state.params={}; state.stack=[];
      toast('Datos reiniciados');
      closeModal(); render();
    }}
  ]));
});

$('#btnQuickAdd').addEventListener('click', ()=>{
  if(state.view==='economy'){
    const tab=state.data.economy.ui.tab||'accounts';
    if(tab==='accounts') return openAddAccount();
    if(tab==='fixed') return openAddFixed();
    if(tab==='credits') return openAddCredit();
    if(tab==='goals') return openAddGoal();
  }
  if(state.view==='account') return openAddMovement(state.params.accountId);
  if(state.view==='work') return openAddJob();
  if(state.view==='agenda') return openAddEvent(fmtISO(new Date()));
  // home
  const wrap=el('div',{class:'form'},[help('¿Qué quieres añadir?')]);
  openModal('Añadir', wrap, modalFoot([
    {text:'Cuenta',kind:'btn primary',onClick:()=>{closeModal(); push('economy'); state.data.economy.ui.tab='accounts'; render(); openAddAccount();}},
    {text:'Gasto fijo',kind:'btn',onClick:()=>{closeModal(); push('economy'); state.data.economy.ui.tab='fixed'; render(); openAddFixed();}},
    {text:'Crédito',kind:'btn',onClick:()=>{closeModal(); push('economy'); state.data.economy.ui.tab='credits'; render(); openAddCredit();}},
    {text:'Meta',kind:'btn',onClick:()=>{closeModal(); push('economy'); state.data.economy.ui.tab='goals'; render(); openAddGoal();}},
    {text:'Trabajo',kind:'btn',onClick:()=>{closeModal(); push('work'); render(); openAddJob();}},
    {text:'Evento agenda',kind:'btn',onClick:()=>{closeModal(); push('agenda'); render(); openAddEvent(fmtISO(new Date()));}},
  ]));
});

/* ===================== Shared Calendar ===================== */
function buildMonthGrid(year, month){
  const first=new Date(year, month, 1);
  const startDow=(first.getDay()+6)%7; // Mon=0
  const daysInMonth=new Date(year, month+1, 0).getDate();
  const daysPrev=new Date(year, month, 0).getDate();
  const cells=[];
  // prev month fillers
  for(let i=0;i<startDow;i++){
    const day=daysPrev-startDow+i+1;
    const d=new Date(year, month-1, day);
    cells.push({date:d, inMonth:false});
  }
  // current month
  for(let day=1; day<=daysInMonth; day++){
    cells.push({date:new Date(year, month, day), inMonth:true});
  }
  // next month fillers to complete 6 weeks (42 cells)
  while(cells.length<42){
    const d=new Date(year, month, daysInMonth + (cells.length - (startDow+daysInMonth)) + 1);
    cells.push({date:d, inMonth:false});
  }
  return cells;
}
function calendarWidget(year, month, renderDay){
  const cal=el('div',{class:'calendar'});
  const head=el('div',{class:'cal__head'});
  ['L','M','X','J','V','S','D'].forEach(x=>head.appendChild(el('div',{text:x})));
  const grid=el('div',{class:'cal__grid'});
  const cells=buildMonthGrid(year, month);
  cells.forEach(({date,inMonth})=>{
    const iso=fmtISO(date);
    const d=el('div',{class:`day ${inMonth?'':'muted'}`});
    d.appendChild(el('div',{class:'day__num',text:String(date.getDate())}));
    const badges=el('div',{class:'day__badges'});
    d.appendChild(badges);
    if(renderDay) renderDay({container:d,badges, date, iso, inMonth});
    grid.appendChild(d);
  });
  cal.appendChild(head); cal.appendChild(grid);
  return cal;
}

/* ===================== HOME ===================== */
function tile(title, icon, onClick){
  const t=el('div',{class:'tile'});
  t.addEventListener('click', onClick);
  t.appendChild(el('div',{class:'tile__title',text:title}));
  t.appendChild(el('div',{class:'tile__badge',text:icon}));
  return t;
}
function renderHome(){
  const c=el('div',{class:'card'});
  const b=el('div',{class:'card__body'});
  const g=el('div',{class:'bigtiles'});
  g.appendChild(tile('Trabajo','🗓️',()=>push('work')));
  g.appendChild(tile('Economía','💳',()=>push('economy')));
  g.appendChild(tile('Agenda','📌',()=>push('agenda')));
  b.appendChild(g);
  c.appendChild(b);
  return c;
}

/* ===================== ECONOMY ===================== */
function getAcc(id){ return state.data.economy.accounts.find(a=>a.id===id)||null; }
function movs(id){
  if(!Array.isArray(state.data.economy.movements[id])) state.data.economy.movements[id]=[];
  return state.data.economy.movements[id];
}
function accBalance(id){
  const a=getAcc(id); if(!a) return 0;
  const s=movs(id).reduce((t,x)=>t+(x.type==='income'?Number(x.amount||0):-Number(x.amount||0)),0);
  return Number(a.initialBalance||0)+s;
}
function totalPending(){
  const fixed=state.data.economy.fixed.filter(x=>x.active).reduce((s,x)=>s+Number(x.amount||0),0);
  const credits=state.data.economy.credits.filter(x=>x.active).reduce((s,x)=>s+Number(x.amount||0),0);
  return {fixed,credits,total:fixed+credits};
}
function totalCardUsed(){
  let u=0;
  state.data.economy.accounts.forEach(a=>(a.cards||[]).forEach(c=>u+=Number(c.used||0)));
  return u;
}
function totals(){
  const total=state.data.economy.accounts.reduce((s,a)=>s+accBalance(a.id),0);
  const pending=totalPending().total;
  const cardUsed=totalCardUsed();
  const available=total-pending-cardUsed;
  return {total,pending,cardUsed,available};
}
function accOpts(){
  return [{value:'',label:'(Selecciona cuenta)'}].concat(state.data.economy.accounts.map(a=>({value:a.id,label:a.name})));
}
function tabBtn(label, value, active){
  const b=el('button',{class:`tab ${active===value?'active':''}`,text:label});
  b.addEventListener('click',()=>{ state.data.economy.ui.tab=value; render(); });
  return b;
}
function renderEconomy(){
  const wrap=el('div',{class:'grid cols-1'});
  const t=totals();
  const sum=el('div',{class:'card'});
  const body=el('div',{class:'card__body'});
  const kpi=el('div',{class:'kpi'});
  kpi.appendChild(kpiItem('Saldo total', fmtEUR(t.total),'Suma de todas las cuentas'));
  kpi.appendChild(kpiItem('Disponible', fmtEUR(t.available),'Saldo - pendientes - tarjetas'));
  kpi.appendChild(kpiItem('Pendiente', fmtEUR(t.pending),'Gastos fijos + créditos'));
  kpi.appendChild(kpiItem('Tarjetas', fmtEUR(t.cardUsed),'Consumido total en tarjetas'));
  body.appendChild(kpi);
  body.appendChild(el('div',{class:'hr'}));

  const tabs=el('div',{class:'tabs'});
  const active=state.data.economy.ui.tab||'accounts';
  tabs.appendChild(tabBtn('Cuentas','accounts',active));
  tabs.appendChild(tabBtn('Gastos fijos','fixed',active));
  tabs.appendChild(tabBtn('Créditos','credits',active));
  tabs.appendChild(tabBtn('Metas','goals',active));
  body.appendChild(tabs);
  sum.appendChild(body);
  wrap.appendChild(sum);

  if(active==='accounts') wrap.appendChild(renderAccounts());
  if(active==='fixed') wrap.appendChild(renderFixed());
  if(active==='credits') wrap.appendChild(renderCredits());
  if(active==='goals') wrap.appendChild(renderGoals());
  return wrap;
}
function renderAccounts(){
  const card=el('div',{class:'card'});
  const body=el('div',{class:'card__body'});
  body.appendChild(el('div',{class:'card__title',text:'Cuentas'}));
  body.appendChild(el('div',{class:'row',style:'margin-top:10px;'},[
    el('button',{class:'btn primary',text:'Añadir cuenta',onClick:openAddAccount})
  ]));
  const list=el('div',{class:'list',style:'margin-top:12px;'});
  state.data.economy.accounts.forEach(a=>{
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:a.name}),
      el('div',{class:'item__meta',text:a.bank||'Cuenta'}),
    ]));
    const right=el('div',{class:'item__right'});
    right.appendChild(el('span',{class:'badge',text:fmtEUR(accBalance(a.id))}));
    right.appendChild(el('button',{class:'btn primary',text:'Abrir',onClick:()=>push('account',{accountId:a.id})}));
    right.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>openEditAccount(a.id)}));
    it.appendChild(right);
    list.appendChild(it);
  });
  body.appendChild(list); card.appendChild(body); return card;
}
function openAddAccount(){
  const d={name:'',bank:'',initialBalance:0};
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre',d.name,'Ej: Santander',v=>d.name=v));
  w.appendChild(fieldText('Banco (opcional)',d.bank,'',v=>d.bank=v));
  w.appendChild(fieldNumber('Saldo inicial',d.initialBalance,'0',v=>d.initialBalance=v));
  openModal('Nueva cuenta', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Crear',kind:'btn primary',onClick:()=>{
      if(!d.name.trim()) return toast('Pon un nombre');
      state.data.economy.accounts.push({id:uid(),name:d.name.trim(),bank:(d.bank||'').trim(),initialBalance:Number(d.initialBalance||0),cards:[]});
      toast('Cuenta creada'); closeModal(); render();
    }}
  ]));
}
function openEditAccount(id){
  const a=getAcc(id); if(!a) return;
  const d=structuredClone(a);
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre',d.name,'',v=>d.name=v));
  w.appendChild(fieldText('Banco (opcional)',d.bank,'',v=>d.bank=v));
  w.appendChild(fieldNumber('Saldo inicial',d.initialBalance,'0',v=>d.initialBalance=v));
  openModal('Editar cuenta', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      a.name=(d.name||'').trim()||a.name;
      a.bank=(d.bank||'').trim();
      a.initialBalance=Number(d.initialBalance||0);
      toast('Guardado'); closeModal(); render();
    }},
    {text:'Borrar cuenta',kind:'btn bad',onClick:()=>{
      if(!confirm('¿Borrar cuenta y movimientos?')) return;
      state.data.economy.accounts=state.data.economy.accounts.filter(x=>x.id!==id);
      delete state.data.economy.movements[id];
      toast('Cuenta borrada'); closeModal(); render();
    }}
  ]));
}
function renderAccount(id){
  const a=getAcc(id);
  if(!a) return el('div',{class:'card'},[el('div',{class:'card__body',text:'Cuenta no encontrada.'})]);
  const wrap=el('div',{class:'grid cols-1'});
  const top=el('div',{class:'card'});
  const b=el('div',{class:'card__body'});
  const k=el('div',{class:'kpi kpi--account'});
  // Saldo actual como bloque principal (ancho completo)
  const saldoWide = kpiItem('Saldo actual',fmtEUR(accBalance(id)),'Saldo inicial + movimientos');
  saldoWide.classList.add('kpi__item--wide');
  k.appendChild(saldoWide);

  const used=(a.cards||[]).reduce((s,c)=>s+Number(c.used||0),0);
  k.appendChild(kpiItem('Tarjetas (consumido)',fmtEUR(used),'Dentro de esta cuenta'));
  k.appendChild(kpiItem('Movimientos',String(movs(id).length),'Ingresos y gastos'));
  b.appendChild(k);
  b.appendChild(el('div',{class:'hr'}));
  b.appendChild(el('div',{class:'row'},[
    el('button',{class:'btn primary',text:'Añadir movimiento',onClick:()=>openAddMovement(id)}),
    el('button',{class:'btn',text:'Añadir tarjeta',onClick:()=>openAddCard(id)}),
    el('button',{class:'btn',text:'Editar cuenta',onClick:()=>openEditAccount(id)}),
  ]));
  top.appendChild(b); wrap.appendChild(top);

  const cards=el('div',{class:'card'});
  const cb=el('div',{class:'card__body'});
  cb.appendChild(el('div',{class:'card__title',text:'Tarjetas'}));
  cb.appendChild(el('div',{class:'card__subtitle',text:'Límite, consumido y día de cobro.'}));
  const cl=el('div',{class:'list',style:'margin-top:12px;'});
  if(!(a.cards||[]).length) cl.appendChild(help('No hay tarjetas.'));
  (a.cards||[]).forEach(c=>{
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:c.title||'Tarjeta'}),
      el('div',{class:'item__meta',text:`Límite ${fmtEUR(c.limit||0)} • Consumido ${fmtEUR(c.used||0)} • Cobro día ${c.day||1}`})
    ]));
    const r=el('div',{class:'item__right'});
    r.appendChild(el('span',{class:'badge',text:fmtEUR(Number(c.limit||0)-Number(c.used||0))}));
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>openEditCard(id,c.id)}));
    r.appendChild(el('button',{class:'btn bad',text:'Borrar',onClick:()=>{
      if(!confirm('¿Borrar tarjeta?')) return;
      a.cards=a.cards.filter(x=>x.id!==c.id);
      toast('Tarjeta borrada'); render();
    }}));
    it.appendChild(r); cl.appendChild(it);
  });
  cb.appendChild(cl); cards.appendChild(cb); wrap.appendChild(cards);

  const mcard=el('div',{class:'card'});
  const mb=el('div',{class:'card__body'});
  mb.appendChild(el('div',{class:'card__title',text:'Movimientos'}));
  const ml=el('div',{class:'list',style:'margin-top:12px;'});
  const sorted=movs(id).slice().sort((x,y)=>(y.date||'').localeCompare(x.date||''));
  if(!sorted.length) ml.appendChild(help('Aún no hay movimientos.'));
  sorted.forEach(mv=>{
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:mv.title||'(sin título)'}),
      el('div',{class:'item__meta',text:`${mv.date||''} • ${mv.type==='income'?'Ingreso':'Gasto'}${mv.note?' • '+mv.note:''}`})
    ]));
    const r=el('div',{class:'item__right'});
    r.appendChild(el('span',{class:`badge ${mv.type==='income'?'good':'bad'}`,text:(mv.type==='income'?'+':'-')+fmtEUR(mv.amount)}));
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>openEditMovement(id,mv.id)}));
    r.appendChild(el('button',{class:'btn bad',text:'Borrar',onClick:()=>{
      if(!confirm('¿Borrar movimiento?')) return;
      state.data.economy.movements[id]=movs(id).filter(x=>x.id!==mv.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r); ml.appendChild(it);
  });
  mb.appendChild(ml); mcard.appendChild(mb); wrap.appendChild(mcard);
  return wrap;
}
function openAddCard(accId){
  const a=getAcc(accId); if(!a) return;
  const d={title:'',limit:0,used:0,day:1,note:''};
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre',d.title,'Ej: VISA',v=>d.title=v));
  const two=el('div',{class:'two'});
  two.appendChild(fieldNumber('Límite (€)',d.limit,'0',v=>d.limit=v));
  two.appendChild(fieldNumber('Consumido (€)',d.used,'0',v=>d.used=v));
  w.appendChild(two);
  w.appendChild(fieldNumber('Día de cobro (1-28)',d.day,'1',v=>d.day=v,'1'));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  openModal('Nueva tarjeta', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      a.cards.push({id:uid(),title:(d.title||'').trim(),limit:Number(d.limit||0),used:Number(d.used||0),day:Math.min(Math.max(Number(d.day||1),1),28),note:(d.note||'').trim()});
      toast('Tarjeta guardada'); closeModal(); render();
    }}
  ]));
}
function openEditCard(accId, cardId){
  const a=getAcc(accId); if(!a) return;
  const c=(a.cards||[]).find(x=>x.id===cardId); if(!c) return;
  const d=structuredClone(c);
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre',d.title,'Ej: VISA',v=>d.title=v));
  const two=el('div',{class:'two'});
  two.appendChild(fieldNumber('Límite (€)',d.limit,'0',v=>d.limit=v));
  two.appendChild(fieldNumber('Consumido (€)',d.used,'0',v=>d.used=v));
  w.appendChild(two);
  w.appendChild(fieldNumber('Día de cobro (1-28)',d.day,'1',v=>d.day=v,'1'));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  openModal('Editar tarjeta', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      c.title=(d.title||'').trim();
      c.limit=Number(d.limit||0);
      c.used=Number(d.used||0);
      c.day=Math.min(Math.max(Number(d.day||1),1),28);
      c.note=(d.note||'').trim();
      toast('Tarjeta actualizada'); closeModal(); render();
    }}
  ]));
}
function openAddMovement(accId){
  const d={date:fmtISO(new Date()),type:'expense',amount:'',title:'',note:''};
  const w=el('div',{class:'form'});
  w.appendChild(fieldDate('Fecha',d.date,v=>d.date=v));
  w.appendChild(fieldSelect('Tipo',d.type,[{value:'expense',label:'Gasto'},{value:'income',label:'Ingreso'}],v=>d.type=v));
  w.appendChild(fieldNumber('Importe (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldText('Título',d.title,'Ej: Glovo',v=>d.title=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  openModal('Nuevo movimiento', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.amount||Number(d.amount)<=0) return toast('Importe inválido');
      movs(accId).push({id:uid(),date:d.date,type:d.type,amount:Number(d.amount),title:(d.title||'').trim(),note:(d.note||'').trim()});
      toast('Movimiento guardado'); closeModal(); render();
    }}
  ]));
}
function openEditMovement(accId, movId){
  const m=movs(accId).find(x=>x.id===movId); if(!m) return;
  const d=structuredClone(m);
  const w=el('div',{class:'form'});
  w.appendChild(fieldDate('Fecha',d.date,v=>d.date=v));
  w.appendChild(fieldSelect('Tipo',d.type,[{value:'expense',label:'Gasto'},{value:'income',label:'Ingreso'}],v=>d.type=v));
  w.appendChild(fieldNumber('Importe (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldText('Título',d.title,'',v=>d.title=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  openModal('Editar movimiento', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.amount||Number(d.amount)<=0) return toast('Importe inválido');
      m.date=d.date; m.type=d.type; m.amount=Number(d.amount); m.title=(d.title||'').trim(); m.note=(d.note||'').trim();
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}
function renderFixed(){
  const card=el('div',{class:'card'});
  const b=el('div',{class:'card__body'});
  b.appendChild(el('div',{class:'card__title',text:'Gastos fijos'}));
  b.appendChild(el('div',{class:'card__subtitle',text:'Suscripciones y recibos con día de cobro + cuenta.'}));
  b.appendChild(el('div',{class:'row',style:'margin-top:10px;'},[el('button',{class:'btn primary',text:'Añadir gasto fijo',onClick:openAddFixed})]));
  const list=el('div',{class:'list',style:'margin-top:12px;'});
  if(!state.data.economy.fixed.length) list.appendChild(help('No hay gastos fijos aún.'));
  state.data.economy.fixed.forEach(f=>{
    const a=getAcc(f.accountId);
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:f.title}),
      el('div',{class:'item__meta',text:`Día ${f.day} • ${a?a.name:'Sin cuenta'}${f.note?' • '+f.note:''}`})
    ]));
    const r=el('div',{class:'item__right'});
    r.appendChild(el('span',{class:'badge',text:fmtEUR(f.amount)}));
    r.appendChild(el('span',{class:`badge ${f.active?'good':'warn'}`,text:f.active?'Activo':'Pausado'}));
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>openEditFixed(f.id)}));
    r.appendChild(el('button',{class:'btn bad',text:'Borrar',onClick:()=>{
      if(!confirm('¿Borrar gasto fijo?')) return;
      state.data.economy.fixed=state.data.economy.fixed.filter(x=>x.id!==f.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r); list.appendChild(it);
  });
  b.appendChild(list); card.appendChild(b); return card;
}
function openAddFixed(){
  const d={title:'',amount:'',day:1,accountId:'',note:'',active:true};
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Título',d.title,'Ej: Netflix',v=>d.title=v));
  w.appendChild(fieldNumber('Importe (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldNumber('Día de cobro (1-28)',d.day,'1',v=>d.day=v,'1'));
  w.appendChild(fieldSelect('Cuenta asociada',d.accountId,accOpts(),v=>d.accountId=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  w.appendChild(fieldSelect('Estado',d.active?'1':'0',[{value:'1',label:'Activo'},{value:'0',label:'Pausado'}],v=>d.active=(v==='1')));
  openModal('Nuevo gasto fijo', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.title.trim()) return toast('Pon un título');
      if(!d.amount||Number(d.amount)<=0) return toast('Importe inválido');
      state.data.economy.fixed.push({id:uid(),title:d.title.trim(),amount:Number(d.amount),day:Math.min(Math.max(Number(d.day||1),1),28),accountId:d.accountId,note:(d.note||'').trim(),active:!!d.active});
      toast('Guardado'); closeModal(); render();
    }}
  ]));
}
function openEditFixed(id){
  const f=state.data.economy.fixed.find(x=>x.id===id); if(!f) return;
  const d=structuredClone(f);
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Título',d.title,'',v=>d.title=v));
  w.appendChild(fieldNumber('Importe (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldNumber('Día de cobro (1-28)',d.day,'1',v=>d.day=v,'1'));
  w.appendChild(fieldSelect('Cuenta asociada',d.accountId,accOpts(),v=>d.accountId=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  w.appendChild(fieldSelect('Estado',d.active?'1':'0',[{value:'1',label:'Activo'},{value:'0',label:'Pausado'}],v=>d.active=(v==='1')));
  openModal('Editar gasto fijo', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      f.title=(d.title||'').trim()||f.title;
      f.amount=Number(d.amount||0);
      f.day=Math.min(Math.max(Number(d.day||1),1),28);
      f.accountId=d.accountId;
      f.note=(d.note||'').trim();
      f.active=!!d.active;
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}
function renderCredits(){
  const card=el('div',{class:'card'});
  const b=el('div',{class:'card__body'});
  b.appendChild(el('div',{class:'card__title',text:'Créditos'}));
  b.appendChild(el('div',{class:'card__subtitle',text:'Cuotas mensuales asociadas a una cuenta.'}));
  b.appendChild(el('div',{class:'row',style:'margin-top:10px;'},[el('button',{class:'btn primary',text:'Añadir crédito',onClick:openAddCredit})]));
  const list=el('div',{class:'list',style:'margin-top:12px;'});
  if(!state.data.economy.credits.length) list.appendChild(help('No hay créditos aún.'));
  state.data.economy.credits.forEach(c=>{
    const a=getAcc(c.accountId);
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:c.title}),
      el('div',{class:'item__meta',text:`Día ${c.day} • ${a?a.name:'Sin cuenta'}${c.note?' • '+c.note:''}`})
    ]));
    const r=el('div',{class:'item__right'});
    r.appendChild(el('span',{class:'badge',text:fmtEUR(c.amount)}));
    r.appendChild(el('span',{class:`badge ${c.active?'good':'warn'}`,text:c.active?'Activo':'Pausado'}));
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>openEditCredit(c.id)}));
    r.appendChild(el('button',{class:'btn bad',text:'Borrar',onClick:()=>{
      if(!confirm('¿Borrar crédito?')) return;
      state.data.economy.credits=state.data.economy.credits.filter(x=>x.id!==c.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r); list.appendChild(it);
  });
  b.appendChild(list); card.appendChild(b); return card;
}
function openAddCredit(){
  const d={title:'',amount:'',day:1,accountId:'',note:'',active:true};
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre del crédito',d.title,'Ej: Préstamo coche',v=>d.title=v));
  w.appendChild(fieldNumber('Cuota mensual (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldNumber('Día de cobro (1-28)',d.day,'1',v=>d.day=v,'1'));
  w.appendChild(fieldSelect('Cuenta asociada',d.accountId,accOpts(),v=>d.accountId=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  w.appendChild(fieldSelect('Estado',d.active?'1':'0',[{value:'1',label:'Activo'},{value:'0',label:'Pausado'}],v=>d.active=(v==='1')));
  openModal('Nuevo crédito', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.title.trim()) return toast('Pon un nombre');
      if(!d.amount||Number(d.amount)<=0) return toast('Cuota inválida');
      state.data.economy.credits.push({id:uid(),title:d.title.trim(),amount:Number(d.amount),day:Math.min(Math.max(Number(d.day||1),1),28),accountId:d.accountId,note:(d.note||'').trim(),active:!!d.active});
      toast('Guardado'); closeModal(); render();
    }}
  ]));
}
function openEditCredit(id){
  const c=state.data.economy.credits.find(x=>x.id===id); if(!c) return;
  const d=structuredClone(c);
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre del crédito',d.title,'',v=>d.title=v));
  w.appendChild(fieldNumber('Cuota mensual (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldNumber('Día de cobro (1-28)',d.day,'1',v=>d.day=v,'1'));
  w.appendChild(fieldSelect('Cuenta asociada',d.accountId,accOpts(),v=>d.accountId=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  w.appendChild(fieldSelect('Estado',d.active?'1':'0',[{value:'1',label:'Activo'},{value:'0',label:'Pausado'}],v=>d.active=(v==='1')));
  openModal('Editar crédito', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      c.title=(d.title||'').trim()||c.title;
      c.amount=Number(d.amount||0);
      c.day=Math.min(Math.max(Number(d.day||1),1),28);
      c.accountId=d.accountId;
      c.note=(d.note||'').trim();
      c.active=!!d.active;
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}
function goalProgress(g){
  const hist=Array.isArray(g.history)? g.history:[];
  const saved=hist.reduce((s,h)=>s+(h.type==='in'?Number(h.amount||0):-Number(h.amount||0)),0);
  const target=Number(g.target||0);
  const pct=target>0?Math.max(0,Math.min(1,saved/target)):0;
  return {saved,target,pct};
}
function renderGoals(){
  const card=el('div',{class:'card'});
  const b=el('div',{class:'card__body'});
  b.appendChild(el('div',{class:'card__title',text:'Metas'}));
  b.appendChild(el('div',{class:'card__subtitle',text:'Ahorro por objetivos con aportaciones y gastos.'}));
  b.appendChild(el('div',{class:'row',style:'margin-top:10px;'},[el('button',{class:'btn primary',text:'Añadir meta',onClick:openAddGoal})]));
  const list=el('div',{class:'list',style:'margin-top:12px;'});
  if(!state.data.economy.goals.length) list.appendChild(help('No hay metas aún.'));
  state.data.economy.goals.forEach(g=>{
    const p=goalProgress(g);
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:g.title}),
      el('div',{class:'item__meta',text:`Ahorrado ${fmtEUR(p.saved)} / ${fmtEUR(p.target)} • ${(p.pct*100).toFixed(1)}%`})
    ]));
    const r=el('div',{class:'item__right'});
    r.appendChild(el('span',{class:'badge',text:fmtEUR(p.target-p.saved)}));
    r.appendChild(el('button',{class:'btn primary',text:'Abrir',onClick:()=>openGoalDetail(g.id)}));
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>openEditGoal(g.id)}));
    r.appendChild(el('button',{class:'btn bad',text:'Borrar',onClick:()=>{
      if(!confirm('¿Borrar meta?')) return;
      state.data.economy.goals=state.data.economy.goals.filter(x=>x.id!==g.id);
      toast('Borrado'); render();
    }}));
    it.appendChild(r); list.appendChild(it);
  });
  b.appendChild(list); card.appendChild(b); return card;
}
function openAddGoal(){
  const d={title:'',target:'',deadline:'',accountId:''};
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre de la meta',d.title,'Ej: Ahorrar 10k',v=>d.title=v));
  w.appendChild(fieldNumber('Objetivo (€)',d.target,'0',v=>d.target=v));
  w.appendChild(fieldDate('Fecha objetivo (opcional)',d.deadline,v=>d.deadline=v));
  w.appendChild(fieldSelect('Cuenta origen (opcional)',d.accountId,accOpts(),v=>d.accountId=v));
  openModal('Nueva meta', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.title.trim()) return toast('Pon un nombre');
      if(!d.target||Number(d.target)<=0) return toast('Objetivo inválido');
      state.data.economy.goals.push({id:uid(),title:d.title.trim(),target:Number(d.target),deadline:d.deadline||'',accountId:d.accountId||'',history:[]});
      toast('Meta creada'); closeModal(); render();
    }}
  ]));
}
function openEditGoal(id){
  const g=state.data.economy.goals.find(x=>x.id===id); if(!g) return;
  const d=structuredClone(g);
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre de la meta',d.title,'',v=>d.title=v));
  w.appendChild(fieldNumber('Objetivo (€)',d.target,'0',v=>d.target=v));
  w.appendChild(fieldDate('Fecha objetivo (opcional)',d.deadline,v=>d.deadline=v));
  w.appendChild(fieldSelect('Cuenta origen (opcional)',d.accountId,accOpts(),v=>d.accountId=v));
  openModal('Editar meta', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      g.title=(d.title||'').trim()||g.title;
      g.target=Number(d.target||0);
      g.deadline=d.deadline||'';
      g.accountId=d.accountId||'';
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}
function openGoalDetail(id){
  const g=state.data.economy.goals.find(x=>x.id===id); if(!g) return;
  const p=goalProgress(g);
  const w=el('div',{class:'form'});
  w.appendChild(el('div',{class:'card__title',text:g.title}));
  w.appendChild(help(`Ahorrado: ${fmtEUR(p.saved)} / ${fmtEUR(p.target)} • ${(p.pct*100).toFixed(1)}%`));
  if(g.deadline) w.appendChild(help(`Fecha objetivo: ${g.deadline}`));
  w.appendChild(el('div',{class:'hr'}));
  const list=el('div',{class:'list'});
  const hist=(g.history||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!hist.length) list.appendChild(help('Sin movimientos en la meta.'));
  hist.forEach(h=>{
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:h.type==='in'?'Aportación':'Gasto'}),
      el('div',{class:'item__meta',text:`${h.date}${h.note?' • '+h.note:''}`})
    ]));
    const r=el('div',{class:'item__right'});
    r.appendChild(el('span',{class:`badge ${h.type==='in'?'good':'bad'}`,text:(h.type==='in'?'+':'-')+fmtEUR(h.amount)}));
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>{ closeModal(); openEditGoalEntry(id,h.id);} }));
    r.appendChild(el('button',{class:'btn bad',text:'Borrar',onClick:()=>{
      if(!confirm('¿Borrar movimiento?')) return;
      g.history=(g.history||[]).filter(x=>x.id!==h.id);
      toast('Borrado'); closeModal(); render();
    }}));
    it.appendChild(r); list.appendChild(it);
  });
  w.appendChild(list);
  openModal('Meta', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Añadir aportación',kind:'btn primary',onClick:()=>{ closeModal(); openAddGoalEntry(id,'in'); }},
    {text:'Añadir gasto',kind:'btn',onClick:()=>{ closeModal(); openAddGoalEntry(id,'out'); }},
  ]));
}
function openAddGoalEntry(goalId, type){
  const g=state.data.economy.goals.find(x=>x.id===goalId); if(!g) return;
  const d={date:fmtISO(new Date()),amount:'',note:''};
  const w=el('div',{class:'form'});
  w.appendChild(fieldDate('Fecha',d.date,v=>d.date=v));
  w.appendChild(fieldNumber('Importe (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  openModal(type==='in'?'Nueva aportación':'Nuevo gasto', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.amount||Number(d.amount)<=0) return toast('Importe inválido');
      if(!Array.isArray(g.history)) g.history=[];
      g.history.push({id:uid(),date:d.date,type:(type==='in'?'in':'out'),amount:Number(d.amount),note:(d.note||'').trim()});
      // reflejo opcional en cuenta
      if(g.accountId){
        movs(g.accountId).push({id:uid(),date:d.date,type:(type==='in'?'expense':'income'),amount:Number(d.amount),title:`Meta: ${g.title}`,note:(type==='in'?'Aportación a meta':'Retirada de meta')});
      }
      toast('Guardado'); closeModal(); render();
    }}
  ]));
}
function openEditGoalEntry(goalId, entryId){
  const g=state.data.economy.goals.find(x=>x.id===goalId); if(!g) return;
  const h=(g.history||[]).find(x=>x.id===entryId); if(!h) return;
  const d=structuredClone(h);
  const w=el('div',{class:'form'});
  w.appendChild(fieldDate('Fecha',d.date,v=>d.date=v));
  w.appendChild(fieldNumber('Importe (€)',d.amount,'0',v=>d.amount=v));
  w.appendChild(fieldText('Nota (opcional)',d.note,'',v=>d.note=v));
  openModal('Editar movimiento', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.amount||Number(d.amount)<=0) return toast('Importe inválido');
      h.date=d.date; h.amount=Number(d.amount); h.note=(d.note||'').trim();
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}

/* ===================== WORK ===================== */
function getTurn(turnId){
  return state.data.work.turnTypes.find(t=>t.id===turnId) || state.data.work.turnTypes[0];
}
function jobById(id){ return state.data.work.jobs.find(j=>j.id===id)||null; }
function jobOverrides(jobId){
  if(!state.data.work.overrides[jobId]) state.data.work.overrides[jobId]={};
  return state.data.work.overrides[jobId];
}
function rotationAt(job, dateISO){
  const d=parseISO(dateISO);
  const start=parseISO(job.contractStart);
  if(!d || !start) return null;
  // before start or after end
  if(d < start) return null;
  if(job.contractEnd){
    const end=parseISO(job.contractEnd);
    if(end && d > end) return null;
  }
  const rot = Array.isArray(job.rotation) && job.rotation.length ? job.rotation : ['morning','afternoon','night','off'];
  const diffDays = Math.floor((d - start) / (1000*60*60*24));
  const idx = ((diffDays % rot.length) + rot.length) % rot.length;
  return rot[idx];
}
function dayPlan(jobId, dateISO){
  const job=jobById(jobId); if(!job) return null;
  const ov=jobOverrides(jobId)[dateISO] || null;
  const turnId = ov?.turnId || rotationAt(job, dateISO);
  if(!turnId) return null;
  const turn=getTurn(turnId);
  const hoursWorked = (ov?.hoursWorked ?? turn.hours ?? 0);
  const extraHours = Number(ov?.extraHours||0);
  const extraRate = (ov?.extraRate===''||ov?.extraRate==null) ? Number(job.salaryPerHour||0) : Number(ov.extraRate||0);
  const oncallHours = Number(ov?.oncallHours||0);
  const oncallRate = (ov?.oncallRate===''||ov?.oncallRate==null) ? Number(job.oncallRatePerHour||0) : Number(ov.oncallRate||0);
  const note = ov?.note || '';
  return {turnId, turn, hoursWorked, extraHours, extraRate, oncallHours, oncallRate, note};
}
function workMonthTotals(jobId, year, month){
  const job=jobById(jobId); if(!job) return {hours:0,oncall:0,gross:0,net:0};
  const daysInMonth=new Date(year,month+1,0).getDate();
  let hours=0, oncall=0, gross=0;
  for(let d=1; d<=daysInMonth; d++){
    const iso=fmtISO(new Date(year,month,d));
    const p=dayPlan(jobId, iso);
    if(!p) continue;
    const basePay = Number(p.hoursWorked||0) * Number(job.salaryPerHour||0);
    const extraPay = Number(p.extraHours||0) * Number(p.extraRate||0);
    const oncallPay = Number(p.oncallHours||0) * Number(p.oncallRate||0);
    hours += Number(p.hoursWorked||0) + Number(p.extraHours||0);
    oncall += Number(p.oncallHours||0);
    gross += basePay + extraPay + oncallPay;
  }
  const irpf = Math.max(0, Math.min(1, Number(job.irpfPercent||0)/100));
  const net = gross * (1 - irpf);
  return {hours,oncall,gross,net};
}

function renderWork(){
  const wrap=el('div',{class:'grid cols-1'});
  const jobs=state.data.work.jobs;

  // header card: job selector + month/year
  const head=el('div',{class:'card'});
  const b=el('div',{class:'card__body'});

  const jobId = state.data.work.ui.activeJobId || (jobs[0]?.id||'');
  if(!state.data.work.ui.activeJobId && jobId) state.data.work.ui.activeJobId = jobId;
  const job=jobId? jobById(jobId): null;

  const toolbar=el('div',{class:'toolbar'});
  // job select options
  const jobOpts=[{value:'',label:'(Selecciona trabajo)'}].concat(jobs.map(j=>({value:j.id,label:j.name})));
  toolbar.appendChild(fieldSelect('Trabajo', jobId, jobOpts, v=>{ state.data.work.ui.activeJobId=v; render(); }));

  const year=Number(state.data.work.ui.year||new Date().getFullYear());
  const month=Number(state.data.work.ui.month||new Date().getMonth());
  const years=[]; for(let y=year-3; y<=year+3; y++) years.push({value:String(y),label:String(y)});
  const months=[...Array(12)].map((_,i)=>({value:String(i),label:monthName(i)}));
  toolbar.appendChild(fieldSelect('Mes', String(month), months, v=>{ state.data.work.ui.month=Number(v); render(); }));
  toolbar.appendChild(fieldSelect('Año', String(year), years, v=>{ state.data.work.ui.year=Number(v); render(); }));
  b.appendChild(toolbar);
  b.appendChild(el('div',{class:'hr'}));
  b.appendChild(el('div',{class:'row'},[
    el('button',{class:'btn primary',text:'Añadir trabajo',onClick:openAddJob}),
    el('button',{class:'btn',text:'Turnos',onClick:openTurnTypes}),
    job? el('button',{class:'btn',text:'Editar',onClick:()=>openEditJob(job.id)}): null,
  ]));
  head.appendChild(b);
  wrap.appendChild(head);

  if(!job){
    const empty=el('div',{class:'card'},[el('div',{class:'card__body'},[help('Crea un trabajo para empezar a programar turnos.')])]);
    wrap.appendChild(empty);
    return wrap;
  }

  // totals
  const tot=workMonthTotals(job.id, year, month);
  const sum=el('div',{class:'card'});
  const sb=el('div',{class:'card__body'});
  const k=el('div',{class:'kpi'});
  k.appendChild(kpiItem('Horas trabajadas', String(tot.hours.toFixed(2)), 'Incluye horas extra'));
  k.appendChild(kpiItem('Horas velada', String(tot.oncall.toFixed(2)), 'Marcadas como velada'));
  k.appendChild(kpiItem('Bruto', fmtEUR(tot.gross), 'Sin descontar IRPF'));
  k.appendChild(kpiItem('Cash', fmtEUR(tot.net), 'Neto (IRPF aplicado)'));
  sb.appendChild(k);
  sum.appendChild(sb);
  wrap.appendChild(sum);

  // calendar
  const cal=calendarWidget(year, month, ({container,badges,iso,inMonth})=>{
    const p=dayPlan(job.id, iso);
    if(p){
      const chip=el('div',{class:'chip'});
      chip.appendChild(el('span',{class:'dot',style:`background:${p.turn.color}`}));
      chip.appendChild(el('span',{text:p.turn.label}));
      badges.appendChild(chip);

      const sub=[];
      const baseHours = Number(p.hoursWorked||0);
      if(baseHours>0) sub.push(`${baseHours}h`);
      if(Number(p.extraHours||0)>0) sub.push(`+${Number(p.extraHours||0)}h`);
      if(Number(p.oncallHours||0)>0) sub.push(`V:${Number(p.oncallHours||0)}h`);
      if(sub.length){
        badges.appendChild(el('div',{class:'small',text:sub.join(' • ')}));
      }
    }
    container.addEventListener('click', ()=>openDayEditor(job.id, iso));
  });
  wrap.appendChild(el('div',{class:'card'},[el('div',{class:'card__body'},[
    el('div',{class:'card__title',text:`Calendario — ${monthName(month)} ${year}`}),
    el('div',{class:'card__subtitle',text:'Pulsa un día para editar horas, extras, veladas o turno.'}),
    el('div',{class:'hr'}),
    cal
  ])]));

  return wrap;
}

function openAddJob(){
  const d={name:'',contractStart:fmtISO(new Date()),contractEnd:'',salaryPerHour:0,irpfPercent:0,oncallRatePerHour:0, rotation:['morning','afternoon','night','off']};
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre del trabajo',d.name,'Ej: Stellantis',v=>d.name=v));
  const two=el('div',{class:'two'});
  two.appendChild(fieldDate('Inicio contrato',d.contractStart,v=>d.contractStart=v));
  two.appendChild(fieldDate('Fin contrato (opcional)',d.contractEnd,v=>d.contractEnd=v));
  w.appendChild(two);
  const two2=el('div',{class:'two'});
  two2.appendChild(fieldNumber('€/hora',d.salaryPerHour,'0',v=>d.salaryPerHour=v));
  two2.appendChild(fieldNumber('IRPF %',d.irpfPercent,'0',v=>d.irpfPercent=v,'0.1'));
  w.appendChild(two2);
  w.appendChild(fieldNumber('€/hora velada',d.oncallRatePerHour,'0',v=>d.oncallRatePerHour=v));
  w.appendChild(help('Rotación: se configura en el editor de trabajo (botón Editar).'));
  openModal('Nuevo trabajo', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Crear',kind:'btn primary',onClick:()=>{
      if(!d.name.trim()) return toast('Pon un nombre');
      const job={id:uid(), name:d.name.trim(), contractStart:d.contractStart, contractEnd:d.contractEnd||'', salaryPerHour:Number(d.salaryPerHour||0), irpfPercent:Number(d.irpfPercent||0), oncallRatePerHour:Number(d.oncallRatePerHour||0), rotation:d.rotation};
      state.data.work.jobs.push(job);
      state.data.work.ui.activeJobId=job.id;
      toast('Trabajo creado'); closeModal(); render();
    }}
  ]));
}

function openEditJob(jobId){
  const job=jobById(jobId); if(!job) return;
  const d=structuredClone(job);
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre',d.name,'',v=>d.name=v));
  const two=el('div',{class:'two'});
  two.appendChild(fieldDate('Inicio contrato',d.contractStart,v=>d.contractStart=v));
  two.appendChild(fieldDate('Fin contrato (opcional)',d.contractEnd,v=>d.contractEnd=v));
  w.appendChild(two);
  const two2=el('div',{class:'two'});
  two2.appendChild(fieldNumber('€/hora',d.salaryPerHour,'0',v=>d.salaryPerHour=v));
  two2.appendChild(fieldNumber('IRPF %',d.irpfPercent,'0',v=>d.irpfPercent=v,'0.1'));
  w.appendChild(two2);
  w.appendChild(fieldNumber('€/hora velada',d.oncallRatePerHour,'0',v=>d.oncallRatePerHour=v));

  // Rotation builder
  w.appendChild(el('div',{class:'hr'}));
  w.appendChild(el('div',{class:'card__title',text:'Rotación'}));
  w.appendChild(el('div',{class:'card__subtitle',text:'Añade pasos con un turno y repeticiones. Se genera la secuencia automáticamente.'}));
  const steps=[];
  function redrawRotation(){
    rotPreview.textContent = (d.rotation||[]).map(id=>getTurn(id).label).join(' • ') || '(vacío)';
  }
  const rotPreview=el('div',{class:'minihelp',text:''});
  w.appendChild(rotPreview);
  redrawRotation();

  const addStepRow=el('div',{class:'row'});
  const turnOpts=state.data.work.turnTypes.map(t=>({value:t.id,label:t.label}));
  let stepTurn=turnOpts[0]?.value || 'morning';
  let stepRep=1;
  addStepRow.appendChild(fieldSelect('Turno', stepTurn, turnOpts, v=>stepTurn=v));
  addStepRow.appendChild(fieldNumber('Repetir', stepRep, '1', v=>stepRep=v, '1'));
  addStepRow.appendChild(el('button',{class:'btn',text:'Añadir',onClick:()=>{
    const rep=Math.max(1, Math.min(30, Number(stepRep||1)));
    if(!Array.isArray(d.rotation)) d.rotation=[];
    for(let i=0;i<rep;i++) d.rotation.push(stepTurn);
    redrawRotation();
  }}));
  w.appendChild(addStepRow);
  w.appendChild(el('div',{class:'row'},[
    el('button',{class:'btn',text:'Borrar último',onClick:()=>{ (d.rotation||[]).pop(); redrawRotation(); }}),
    el('button',{class:'btn',text:'Vaciar',onClick:()=>{ d.rotation=[]; redrawRotation(); }}),
  ]));

  openModal('Editar trabajo', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      job.name=(d.name||'').trim()||job.name;
      job.contractStart=d.contractStart;
      job.contractEnd=d.contractEnd||'';
      job.salaryPerHour=Number(d.salaryPerHour||0);
      job.irpfPercent=Number(d.irpfPercent||0);
      job.oncallRatePerHour=Number(d.oncallRatePerHour||0);
      job.rotation=Array.isArray(d.rotation)? d.rotation.slice() : job.rotation;
      toast('Trabajo actualizado'); closeModal(); render();
    }},
    {text:'Borrar trabajo',kind:'btn bad',onClick:()=>{
      if(!confirm('¿Borrar trabajo y sus overrides?')) return;
      state.data.work.jobs=state.data.work.jobs.filter(x=>x.id!==jobId);
      delete state.data.work.overrides[jobId];
      if(state.data.work.ui.activeJobId===jobId) state.data.work.ui.activeJobId=state.data.work.jobs[0]?.id||'';
      toast('Borrado'); closeModal(); render();
    }}
  ]));
}

function openTurnTypes(){
  const w=el('div',{class:'form'});
  w.appendChild(el('div',{class:'card__title',text:'Turnos'}));
  w.appendChild(el('div',{class:'card__subtitle',text:'Colores y horas por defecto.'}));
  const list=el('div',{class:'list',style:'margin-top:12px;'});

  function rowFor(t){
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:t.label}),
      el('div',{class:'item__meta',text:`Horas: ${t.hours} • Tipo: ${t.kind}`}),
    ]));
    const r=el('div',{class:'item__right'});
    const dot=el('span',{class:'badge',text:'●',style:`color:${t.color}; font-size:18px; padding:8px 12px;`});
    r.appendChild(dot);
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>openEditTurnType(t.id)}));
    it.appendChild(r);
    return it;
  }
  state.data.work.turnTypes.forEach(t=>list.appendChild(rowFor(t)));
  w.appendChild(list);
  openModal('Turnos', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal}
  ]));
}

function openEditTurnType(turnId){
  const t=state.data.work.turnTypes.find(x=>x.id===turnId); if(!t) return;
  const d=structuredClone(t);
  const w=el('div',{class:'form'});
  w.appendChild(fieldText('Nombre',d.label,'',v=>d.label=v));
  w.appendChild(fieldColor('Color', d.color, v=>d.color=v));
  w.appendChild(fieldNumber('Horas por defecto',d.hours,'0',v=>d.hours=v,'0.25'));
  w.appendChild(fieldSelect('Tipo',d.kind,[
    {value:'work',label:'Trabajo'},
    {value:'off',label:'Libre'},
    {value:'velada',label:'Velada'}
  ],v=>d.kind=v));
  openModal('Editar turno', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      t.label=(d.label||'').trim()||t.label;
      t.color=(d.color||'').trim()||t.color;
      t.hours=Number(d.hours||0);
      t.kind=d.kind||t.kind;
      toast('Turno actualizado'); closeModal(); render();
    }}
  ]));
}

function openDayEditor(jobId, dateISO){
  const job=jobById(jobId); if(!job) return;
  const ovMap=jobOverrides(jobId);
  const current=ovMap[dateISO] || {};
  const baseTurn = rotationAt(job, dateISO) || 'off';
  const d={
    turnId: current.turnId || baseTurn,
    hoursWorked: (current.hoursWorked ?? null), // if null -> use default
    extraHours: Number(current.extraHours||0),
    extraRate: (current.extraRate==null? '' : Number(current.extraRate)),
    oncallHours: Number(current.oncallHours||0),
    oncallRate: (current.oncallRate==null? '' : Number(current.oncallRate)),
    note: current.note||''
  };
  const w=el('div',{class:'form'});
  w.appendChild(el('div',{class:'card__title',text:`${dateISO}`}));
  w.appendChild(el('div',{class:'card__subtitle',text:`Trabajo: ${job.name}`}));
  w.appendChild(el('div',{class:'hr'}));

  const turnOpts=state.data.work.turnTypes.map(t=>({value:t.id,label:t.label}));
  w.appendChild(fieldSelect('Turno', d.turnId, turnOpts, v=>d.turnId=v));

  const turn=getTurn(d.turnId);
  const defaultHours=turn.hours||0;
  w.appendChild(help(`Horas por defecto de este turno: ${defaultHours}h. Si dejas vacío "Horas trabajadas", usará ese valor.`));

  w.appendChild(fieldNumber('Horas trabajadas (opcional)', d.hoursWorked==null?'':d.hoursWorked, '', v=>d.hoursWorked=v, '0.25'));

  const two=el('div',{class:'two'});
  two.appendChild(fieldNumber('Horas extra', d.extraHours, '0', v=>d.extraHours=v, '0.25'));
  two.appendChild(fieldNumber('€/hora extra (opcional)', d.extraRate, '', v=>d.extraRate=v, '0.01'));
  w.appendChild(two);

  const two2=el('div',{class:'two'});
  two2.appendChild(fieldNumber('Horas velada', d.oncallHours, '0', v=>d.oncallHours=v, '0.25'));
  two2.appendChild(fieldNumber('€/hora velada (opcional)', d.oncallRate, '', v=>d.oncallRate=v, '0.01'));
  w.appendChild(two2);

  w.appendChild(fieldText('Nota (opcional)', d.note, '', v=>d.note=v));

  openModal('Editar día', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Borrar ajustes',kind:'btn bad',onClick:()=>{
      if(!confirm('¿Borrar overrides de este día?')) return;
      delete ovMap[dateISO];
      toast('Borrado'); closeModal(); render();
    }},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      const obj={
        turnId: d.turnId,
        extraHours: Number(d.extraHours||0),
        oncallHours: Number(d.oncallHours||0),
        note: (d.note||'').trim()
      };
      if(d.hoursWorked!=='' && d.hoursWorked!=null) obj.hoursWorked=Number(d.hoursWorked||0);
      if(d.extraRate!=='' && d.extraRate!=null) obj.extraRate=Number(d.extraRate||0);
      if(d.oncallRate!=='' && d.oncallRate!=null) obj.oncallRate=Number(d.oncallRate||0);
      // if all fields are default-ish, still keep (simpler)
      ovMap[dateISO]=obj;
      toast('Guardado'); closeModal(); render();
    }}
  ]));
}

/* ===================== AGENDA ===================== */
function eventsOn(iso){
  return state.data.agenda.events.filter(e=>e.date===iso).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
}
function renderAgenda(){
  const wrap=el('div',{class:'grid cols-1'});
  const head=el('div',{class:'card'});
  const b=el('div',{class:'card__body'});
  const year=Number(state.data.agenda.ui.year||new Date().getFullYear());
  const month=Number(state.data.agenda.ui.month||new Date().getMonth());

  const toolbar=el('div',{class:'toolbar'});
  const years=[]; for(let y=year-3; y<=year+3; y++) years.push({value:String(y),label:String(y)});
  const months=[...Array(12)].map((_,i)=>({value:String(i),label:monthName(i)}));
  toolbar.appendChild(fieldSelect('Mes', String(month), months, v=>{ state.data.agenda.ui.month=Number(v); render(); }));
  toolbar.appendChild(fieldSelect('Año', String(year), years, v=>{ state.data.agenda.ui.year=Number(v); render(); }));
  b.appendChild(toolbar);
  b.appendChild(el('div',{class:'hr'}));
  b.appendChild(el('div',{class:'row'},[
    el('button',{class:'btn primary',text:'Añadir evento',onClick:()=>openAddEvent(fmtISO(new Date(year,month,new Date().getDate())))}),
  ]));
  head.appendChild(b);
  wrap.appendChild(head);

  const cal=calendarWidget(year, month, ({container,badges,iso})=>{
    const ev=eventsOn(iso);
    if(ev.length){
      const chip=el('div',{class:'chip'});
      chip.appendChild(el('span',{class:'dot',style:'background: rgba(124,58,237,0.85)'}));
      chip.appendChild(el('span',{text: ev[0].title || 'Evento'}));
      badges.appendChild(chip);
      if(ev.length>1) container.appendChild(el('div',{class:'day__count',text:`+${ev.length-1}`}));
    }
    container.addEventListener('click', ()=>openDayAgenda(iso));
  });

  wrap.appendChild(el('div',{class:'card'},[el('div',{class:'card__body'},[
    el('div',{class:'card__title',text:`Agenda — ${monthName(month)} ${year}`}),
    el('div',{class:'card__subtitle',text:'Pulsa un día para ver/añadir eventos.'}),
    el('div',{class:'hr'}),
    cal
  ])]));

  return wrap;
}

function openDayAgenda(dateISO){
  const w=el('div',{class:'form'});
  w.appendChild(el('div',{class:'card__title',text:dateISO}));
  const list=el('div',{class:'list',style:'margin-top:12px;'});
  const ev=eventsOn(dateISO);
  if(!ev.length) list.appendChild(help('No hay eventos.'));
  ev.forEach(e=>{
    const it=el('div',{class:'item'});
    it.appendChild(el('div',{class:'item__main'},[
      el('div',{class:'item__title',text:e.title||'(sin título)'}),
      el('div',{class:'item__meta',text:`${e.time||'--:--'}${e.location?' • '+e.location:''}${e.note?' • '+e.note:''}`})
    ]));
    const r=el('div',{class:'item__right'});
    r.appendChild(el('button',{class:'btn',text:'Editar',onClick:()=>{ closeModal(); openEditEvent(e.id);} }));
    r.appendChild(el('button',{class:'btn bad',text:'Borrar',onClick:()=>{
      if(!confirm('¿Borrar evento?')) return;
      state.data.agenda.events=state.data.agenda.events.filter(x=>x.id!==e.id);
      toast('Borrado'); closeModal(); render();
    }}));
    it.appendChild(r);
    list.appendChild(it);
  });
  w.appendChild(list);
  openModal('Eventos', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Añadir',kind:'btn primary',onClick:()=>{ closeModal(); openAddEvent(dateISO);} }
  ]));
}

function openAddEvent(dateISO){
  const d={date:dateISO,title:'',time:'',location:'',note:''};
  const w=el('div',{class:'form'});
  w.appendChild(fieldDate('Fecha', d.date, v=>d.date=v));
  w.appendChild(fieldText('Título', d.title, 'Ej: Dentista', v=>d.title=v));
  w.appendChild(fieldText('Hora (opcional)', d.time, 'Ej: 18:30', v=>d.time=v, 'time'));
  w.appendChild(fieldText('Lugar (opcional)', d.location, '', v=>d.location=v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v=>d.note=v));
  openModal('Nuevo evento', w, modalFoot([
    {text:'Cancelar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      if(!d.title.trim()) return toast('Pon un título');
      state.data.agenda.events.push({id:uid(),date:d.date,title:d.title.trim(),time:d.time||'',location:(d.location||'').trim(),note:(d.note||'').trim()});
      toast('Evento guardado'); closeModal(); render();
    }}
  ]));
}
function openEditEvent(id){
  const e=state.data.agenda.events.find(x=>x.id===id); if(!e) return;
  const d=structuredClone(e);
  const w=el('div',{class:'form'});
  w.appendChild(fieldDate('Fecha', d.date, v=>d.date=v));
  w.appendChild(fieldText('Título', d.title, '', v=>d.title=v));
  w.appendChild(fieldText('Hora (opcional)', d.time, '', v=>d.time=v, 'time'));
  w.appendChild(fieldText('Lugar (opcional)', d.location, '', v=>d.location=v));
  w.appendChild(fieldText('Nota (opcional)', d.note, '', v=>d.note=v));
  openModal('Editar evento', w, modalFoot([
    {text:'Cerrar',kind:'btn',onClick:closeModal},
    {text:'Guardar',kind:'btn primary',onClick:()=>{
      e.date=d.date; e.title=(d.title||'').trim()||e.title; e.time=d.time||'';
      e.location=(d.location||'').trim(); e.note=(d.note||'').trim();
      toast('Actualizado'); closeModal(); render();
    }}
  ]));
}

/* ===================== Render ===================== */
function render(){
  save();
  const main=$('#main'); main.innerHTML='';
  const appName=state.data.app.name||'Personal Manager';

  if(state.view==='home'){
    setTopbar(appName,'',false,false);
    main.appendChild(renderHome());
  }else if(state.view==='economy'){
    setTopbar('Economía','Resumen + gestión',true,true);
    main.appendChild(renderEconomy());
  }else if(state.view==='account'){
    const a=getAcc(state.params.accountId);
    setTopbar(a?a.name:'Cuenta','Movimientos + tarjetas',true,true);
    main.appendChild(renderAccount(state.params.accountId));
  }else if(state.view==='work'){
    setTopbar('Trabajo','Calendario + turnos',true,true);
    main.appendChild(renderWork());
  }else if(state.view==='agenda'){
    setTopbar('Agenda','Calendario + eventos',true,true);
    main.appendChild(renderAgenda());
  }else{
    setTopbar(appName,'',true,false);
    main.appendChild(help('Vista no encontrada.'));
  }
}
render();
