'use strict';

/* ============================================================
   Personal Manager V3 (sin service-worker, pensado para GitHub Pages)
   - Trabajo: turnos + calendario (edición por día + rotación simple)
   - Economía: cuentas + movimientos + tarjetas + gastos fijos + créditos + metas
   - Agenda: calendario + eventos por día
   Todo en localStorage.
   ============================================================ */

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const EUR = (n) => (Number(n||0)).toLocaleString('es-ES', { style:'currency', currency:'EUR' });
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

const pad2 = (x)=>String(x).padStart(2,'0');
const fmtISO = (d)=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseISO = (s)=>{
  if(!s) return null;
  const [y,m,d]=String(s).split('-').map(v=>parseInt(v,10));
  if(!y||!m||!d) return null;
  return new Date(y,m-1,d);
};

const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const dowNames = ['L','M','X','J','V','S','D']; // monday-first

const uid = ()=>Math.random().toString(16).slice(2)+Date.now().toString(16);

function el(tag, attrs={}, children=[]){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') n.className=v;
    else if(k==='text') n.textContent=v;
    else if(k==='html') n.innerHTML=v;
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for(const c of children||[]){
    if(c==null) continue;
    n.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
  }
  return n;
}

function toast(msg){
  const t=$('#toast');
  t.textContent=msg;
  t.classList.remove('hidden');
  clearTimeout(toast._tm);
  toast._tm=setTimeout(()=>t.classList.add('hidden'), 2200);
}

/* ====================== Storage ====================== */

const KEY = 'pm_v3_state';

const defaultState = ()=>{
  const today = new Date();
  const ym = `${today.getFullYear()}-${pad2(today.getMonth()+1)}`;
  return {
    ui: { theme:'light' },
    economy: {
      accounts: [
        { id: uid(), name:'Cuenta principal', type:'Bancaria', initial: 0, createdAt: Date.now() }
      ],
      // per-account objects keyed by account id
      movements: {},   // {accId: [ {id, date, type, amount, cat, note} ] }
      cards: {},       // {accId: [ {id, name, limit, billingDay, consumed} ] }
      fixed: {},       // {accId: [ {id, name, amount, day, active} ] }
      credits: {},     // {accId: [ {id, name, balance, monthly, day, note} ] }
      goals: {},       // {accId: [ {id, name, target, saved, due, note} ] }
    },
    work: {
      shifts: [
        { id: uid(), name:'Mañana', color:'#22c55e', hours:8, kind:'Trabajo' },
        { id: uid(), name:'Tarde',  color:'#3b82f6', hours:8, kind:'Trabajo' },
        { id: uid(), name:'Noche',  color:'#a855f7', hours:8, kind:'Trabajo' },
        { id: uid(), name:'Libre',  color:'#9ca3af', hours:0, kind:'Libre' },
        { id: uid(), name:'Velada', color:'#f59e0b', hours:8, kind:'Velada' },
      ],
      // rotation pattern: array of shift ids
      rotation: {
        startDate: fmtISO(new Date(today.getFullYear(), today.getMonth(), 1)),
        pattern: [] // empty => manual
      },
      days: {} // { 'YYYY-MM-DD': {shiftId, hours, extraHours, extraRate, veladaHours, veladaRate, note} }
    },
    agenda: {
      events: {} // { 'YYYY-MM-DD': [ {id, title, time, note} ] }
    },
    meta: { createdAt: Date.now(), lastSavedAt: Date.now(), version: 3, monthFocus: ym }
  };
};

function loadState(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw) return defaultState();
    const st=JSON.parse(raw);
    if(!st || typeof st!=='object') return defaultState();
    // upgrade guards
    st.meta = st.meta || {};
    st.economy = st.economy || defaultState().economy;
    st.work = st.work || defaultState().work;
    st.agenda = st.agenda || defaultState().agenda;
    return st;
  }catch(e){
    console.error(e);
    return defaultState();
  }
}
let state = loadState();

function saveState(){
  state.meta.lastSavedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* ====================== Router / UI shell ====================== */

const ROUTES = {
  home: ()=>'home',
  work: ()=>'work',
  agenda: ()=>'agenda',
  economy: ()=>'economy',
  account: (id)=>`account:${id}`,
};

let navStack = [ ROUTES.home() ];
let route = navStack[navStack.length-1];

function setTop(title, subtitle=''){
  $('#topTitle').textContent = title;
  $('#topSubtitle').textContent = subtitle;
}

function setButtons({back=true, add=true, settings=true}={}){
  $('#btnBack').classList.toggle('hidden', !back);
  $('#btnAdd').classList.toggle('hidden', !add);
  $('#btnSettings').classList.toggle('hidden', !settings);
}

function go(to){
  route = to;
  navStack.push(to);
  render();
}

function back(){
  if(navStack.length<=1) return;
  navStack.pop();
  route = navStack[navStack.length-1];
  render();
}

/* ====================== Modal helpers ====================== */

function showModal(title, bodyEl, buttons=[]){
  $('#modalTitle').textContent = title;
  const b=$('#modalBody'); b.innerHTML=''; b.appendChild(bodyEl);
  const f=$('#modalFoot'); f.innerHTML='';
  for(const btn of buttons){
    const node = el('button', { class:`btn ${btn.kind||''}`.trim(), text: btn.text || 'OK', onclick: ()=>btn.onClick && btn.onClick() });
    f.appendChild(node);
  }
  $('#overlay').classList.remove('hidden');
}

function closeModal(){
  $('#overlay').classList.add('hidden');
  $('#modalBody').innerHTML='';
  $('#modalFoot').innerHTML='';
}

function fieldText(label, value, {placeholder='', onInput=()=>{}, type='text'}={}){
  const w=el('div',{class:'field'},[
    el('div',{class:'label',text:label}),
    el('input',{class:'input', value:value??'', placeholder, type, oninput:(e)=>onInput(e.target.value)})
  ]);
  return w;
}
function fieldNumber(label, value, {placeholder='', onInput=()=>{}, step='0.01', min=null, max=null}={}){
  const attrs = {class:'input', value:(value??''), placeholder, type:'number', step, oninput:(e)=>onInput(e.target.value)};
  if(min!=null) attrs.min=min;
  if(max!=null) attrs.max=max;
  const w=el('div',{class:'field'},[
    el('div',{class:'label',text:label}),
    el('input', attrs)
  ]);
  return w;
}
function fieldDate(label, value, {onInput=()=>{}}={}){
  return el('div',{class:'field'},[
    el('div',{class:'label',text:label}),
    el('input',{class:'input', type:'date', value:value??'', oninput:(e)=>onInput(e.target.value)})
  ]);
}
function fieldSelect(label, value, options, {onChange=()=>{}}={}){
  const s=el('select',{class:'select', onchange:(e)=>onChange(e.target.value)});
  for(const opt of options){
    const o=el('option',{value:opt.value, text:opt.label});
    if(String(opt.value)===String(value)) o.selected=true;
    s.appendChild(o);
  }
  return el('div',{class:'field'},[
    el('div',{class:'label',text:label}),
    s
  ]);
}
function fieldColor(label, value, {onInput=()=>{}}={}){
  return el('div',{class:'field'},[
    el('div',{class:'label',text:label}),
    el('input',{class:'input', type:'color', value:value||'#000000', oninput:(e)=>onInput(e.target.value)})
  ]);
}

/* ====================== Calendar builder ====================== */

function monthMatrix(year, monthIndex){ // monthIndex:0..11
  const first = new Date(year, monthIndex, 1);
  const last  = new Date(year, monthIndex+1, 0);
  // monday-first: JS getDay => 0=Sun ... 6=Sat
  const firstDow = (first.getDay()+6)%7; // 0=Mon..6=Sun
  const daysInMonth = last.getDate();

  const cells = [];
  // previous month fillers
  const prevLast = new Date(year, monthIndex, 0).getDate();
  for(let i=0;i<firstDow;i++){
    const day = prevLast - (firstDow-1-i);
    const d = new Date(year, monthIndex-1, day);
    cells.push({date:d, inMonth:false});
  }
  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(year, monthIndex, day);
    cells.push({date:d, inMonth:true});
  }
  while(cells.length%7!==0){
    const d = new Date(year, monthIndex, daysInMonth + (cells.length - (firstDow+daysInMonth) ) + 1);
    cells.push({date:d, inMonth:false});
  }
  return cells;
}

function calendarView({year, monthIndex, onDayClick, dayBadge}){
  const wrap=el('div',{class:'calWrap'});
  const head=el('div',{class:'calHead'},[
    el('div',{class:'month', text:`${monthNames[monthIndex]} ${year}`}),
    el('div',{class:'calNav'},[
      el('button',{class:'btn ghost', text:'‹', onclick:()=>onDayClick({nav:-1})}),
      el('button',{class:'btn ghost', text:'›', onclick:()=>onDayClick({nav:+1})}),
      el('button',{class:'btn ghost', text:'Hoy', onclick:()=>onDayClick({nav:0, today:true})}),
    ])
  ]);
  wrap.appendChild(head);

  const grid=el('div',{class:'calGrid'});
  for(const d of dowNames) grid.appendChild(el('div',{class:'dow', text:d}));

  const cells = monthMatrix(year, monthIndex);
  for(const c of cells){
    const iso = fmtISO(c.date);
    const badge = dayBadge ? dayBadge(iso, c.inMonth) : null;

    const day = el('div',{class:`day ${c.inMonth?'':'muted'}`, onclick:()=>onDayClick({iso})},[
      el('div',{class:'dayNum', text:String(c.date.getDate())})
    ]);
    if(badge){
      day.appendChild(badge);
    }else{
      day.appendChild(el('div',{class:'daySub', text:''}));
    }
    grid.appendChild(day);
  }
  wrap.appendChild(grid);
  return wrap;
}

/* ====================== Economy logic ====================== */

function getAccById(id){ return state.economy.accounts.find(a=>a.id===id); }

function ensureAccContainers(accId){
  const E=state.economy;
  E.movements[accId]=E.movements[accId]||[];
  E.cards[accId]=E.cards[accId]||[];
  E.fixed[accId]=E.fixed[accId]||[];
  E.credits[accId]=E.credits[accId]||[];
  E.goals[accId]=E.goals[accId]||[];
}

function calcAccount(accId){
  ensureAccContainers(accId);
  const acc = getAccById(accId);
  const movs = state.economy.movements[accId];
  const cards = state.economy.cards[accId];
  const fixed = state.economy.fixed[accId];
  const credits = state.economy.credits[accId];
  const goals = state.economy.goals[accId];

  const sumMov = movs.reduce((s,m)=>s + (m.type==='Ingreso'?Number(m.amount||0): -Number(m.amount||0)), 0);
  const saldo = Number(acc.initial||0) + sumMov;

  const consumedCards = cards.reduce((s,c)=>s + Number(c.consumed||0), 0);
  const fixedMonthly = fixed.filter(x=>x.active!==false).reduce((s,f)=>s + Number(f.amount||0), 0);
  const creditsMonthly = credits.reduce((s,c)=>s + Number(c.monthly||0), 0);
  const goalsPending = goals.reduce((s,g)=>s + Math.max(0, Number(g.target||0)-Number(g.saved||0)), 0);

  return { saldo, sumMov, consumedCards, fixedMonthly, creditsMonthly, goalsPending, counts:{
    movs: movs.length, cards: cards.length, fixed: fixed.length, credits: credits.length, goals: goals.length
  }};
}

function calcTotals(){
  let totalSaldo=0, totalCards=0, totalFixed=0, totalCredits=0, totalGoals=0;
  for(const acc of state.economy.accounts){
    const c=calcAccount(acc.id);
    totalSaldo += c.saldo;
    totalCards += c.consumedCards;
    totalFixed += c.fixedMonthly;
    totalCredits += c.creditsMonthly;
    totalGoals += c.goalsPending;
  }
  return {totalSaldo, totalCards, totalFixed, totalCredits, totalGoals};
}

/* ====================== Work logic ====================== */

function getShift(id){ return state.work.shifts.find(s=>s.id===id); }

function getDayWork(iso){
  state.work.days[iso] = state.work.days[iso] || { shiftId:null, hours:null, extraHours:0, extraRate:0, veladaHours:0, veladaRate:0, note:'' };
  return state.work.days[iso];
}

function autoShiftForDate(iso){
  const rot = state.work.rotation;
  if(!rot || !rot.pattern || rot.pattern.length===0) return null;
  const start=parseISO(rot.startDate);
  if(!start) return null;
  const d=parseISO(iso);
  const diffDays = Math.floor((d - start) / (24*3600*1000));
  if(diffDays<0) return null;
  const idx = diffDays % rot.pattern.length;
  return rot.pattern[idx] || null;
}

/* ====================== Views ====================== */

function viewHome(){
  setTop('Personal Manager', 'Tu trabajo, tu dinero y tu agenda');
  setButtons({back:false, add:false, settings:true});

  const wrap=el('div');
  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'grid cols3'},[
      tile('🧰','Trabajo',()=>go(ROUTES.work())),
      tile('💶','Economía',()=>go(ROUTES.economy())),
      tile('🗓️','Agenda',()=>go(ROUTES.agenda())),
    ])
  ]));

  // resumen rápido
  const totals = calcTotals();
  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'hrow'},[
      el('h2',{text:'Resumen rápido'}),
      el('div',{class:'hint', text:'Todo se guarda en este dispositivo'})
    ]),
    el('div',{class:'grid cols2'},[
      kpiCard('Saldo total', EUR(totals.totalSaldo), 'Suma de cuentas'),
      kpiCard('Gastos fijos/mes', EUR(totals.totalFixed), 'Y créditos: '+EUR(totals.totalCredits)),
    ])
  ]));

  return wrap;
}

function tile(icon, name, onClick){
  return el('div',{class:'card iconTile', onclick:onClick},[
    el('div',{class:'ico', text:icon}),
    el('div',{style:'flex:1; min-width:0'},[
      el('div',{class:'name', text:name}),
    ]),
    el('div',{class:'chev', text:'›'})
  ]);
}

function kpiCard(label, value, small){
  return el('div',{class:'card'},[
    el('div',{class:'kpi'},[
      el('div',{class:'left'},[
        el('div',{class:'label', text:label}),
        el('div',{class:'value', text:value}),
        el('div',{class:'small', text:small||''}),
      ])
    ])
  ]);
}

/* ------------- ECONOMY ------------- */

function viewEconomy(){
  setTop('Economía', 'Resumen + cuentas');
  setButtons({back:true, add:true, settings:true});

  const totals = calcTotals();

  const wrap=el('div');

  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'grid cols2'},[
      kpiCard('Saldo total', EUR(totals.totalSaldo), 'Suma de todas las cuentas'),
      kpiCard('Pendiente', EUR(totals.totalGoals), 'Metas por completar'),
    ])
  ]));

  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'grid cols3'},[
      kpiCard('Tarjetas (consumido)', EUR(totals.totalCards), 'Total en todas las cuentas'),
      kpiCard('Gastos fijos/mes', EUR(totals.totalFixed), 'Suscripciones, alquiler, etc.'),
      kpiCard('Créditos/mes', EUR(totals.totalCredits), 'Cuotas mensuales'),
    ])
  ]));

  wrap.appendChild(el('div',{class:'card'},[
    el('div',{class:'hrow', style:'padding:14px; padding-bottom:0'},[
      el('h2',{text:'Cuentas'}),
      el('div',{class:'hint', text:'Entra en una cuenta para gestionarla'})
    ]),
    el('div',{class:'list'},[
      ...state.economy.accounts.map(acc=>{
        const c=calcAccount(acc.id);
        return el('div',{class:'row'},[
          el('div',{style:'min-width:0'},[
            el('div',{class:'title', text:acc.name}),
            el('div',{class:'sub', text:acc.type})
          ]),
          el('div',{class:'meta'},[
            el('div',{class:'pill', text:EUR(c.saldo)}),
            el('button',{class:'btn', text:'Abrir', onclick:(e)=>{e.stopPropagation(); go(ROUTES.account(acc.id));}})
          ])
        ]);
      }),
      state.economy.accounts.length===0 ? el('div',{class:'row'},[el('div',{class:'sub', text:'No hay cuentas. Usa + para crear una.'})]) : null
    ])
  ]));

  return wrap;
}

function modalAddAccount(editAcc=null){
  const isEdit = !!editAcc;
  const draft = isEdit ? {...editAcc} : { id: uid(), name:'', type:'Bancaria', initial:0 };

  const body = el('div',{},[
    fieldText('Nombre', draft.name, {placeholder:'Ej: Revolut', onInput:v=>draft.name=v}),
    fieldSelect('Tipo', draft.type, [
      {value:'Bancaria', label:'Bancaria'},
      {value:'Efectivo', label:'Efectivo'},
      {value:'Broker', label:'Broker'},
      {value:'Otra', label:'Otra'},
    ], {onChange:v=>draft.type=v}),
    fieldNumber('Saldo inicial (solo para cálculos)', draft.initial, {placeholder:'0', step:'0.01', onInput:v=>draft.initial=Number(v||0)}),
    el('div',{class:'smallhelp', text:'El saldo inicial NO se muestra como tarjeta. Se usa para que el saldo actual salga bien.'})
  ]);

  showModal(isEdit?'Editar cuenta':'Nueva cuenta', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar esta cuenta y sus datos?')) return;
      state.economy.accounts = state.economy.accounts.filter(a=>a.id!==editAcc.id);
      delete state.economy.movements[editAcc.id];
      delete state.economy.cards[editAcc.id];
      delete state.economy.fixed[editAcc.id];
      delete state.economy.credits[editAcc.id];
      delete state.economy.goals[editAcc.id];
      saveState(); closeModal(); render(); toast('Cuenta eliminada');
    }}] : []),
    {text:isEdit?'Guardar':'Crear', kind:'primary', onClick:()=>{
      if(!draft.name.trim()){ toast('Pon un nombre'); return; }
      if(isEdit){
        Object.assign(editAcc, {name:draft.name.trim(), type:draft.type, initial:Number(draft.initial||0)});
      }else{
        state.economy.accounts.push({id:draft.id, name:draft.name.trim(), type:draft.type, initial:Number(draft.initial||0), createdAt: Date.now()});
      }
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

function viewAccount(accId){
  const acc = getAccById(accId);
  if(!acc){
    setTop('Cuenta', 'No encontrada');
    setButtons({back:true, add:false, settings:true});
    return el('div',{class:'card pad'},[el('div',{text:'Esta cuenta ya no existe.'})]);
  }
  ensureAccContainers(accId);
  const calc = calcAccount(accId);

  setTop(acc.name, 'Movimientos + tarjetas + fijos + créditos + metas');
  setButtons({back:true, add:true, settings:true});

  const wrap = el('div');

  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'grid cols2'},[
      kpiCard('Saldo actual', EUR(calc.saldo), `${calc.counts.movs} movimientos`),
      kpiCard('Tarjetas (consumido)', EUR(calc.consumedCards), `${calc.counts.cards} tarjetas`),
    ])
  ]));

  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'grid cols3'},[
      kpiCard('Gastos fijos/mes', EUR(calc.fixedMonthly), `${calc.counts.fixed} items`),
      kpiCard('Créditos/mes', EUR(calc.creditsMonthly), `${calc.counts.credits} créditos`),
      kpiCard('Metas pendientes', EUR(calc.goalsPending), `${calc.counts.goals} metas`),
    ])
  ]));

  // Tabs
  const tabs = [
    {id:'mov', label:'Movimientos'},
    {id:'card', label:'Tarjetas'},
    {id:'fix', label:'Gastos fijos'},
    {id:'cred', label:'Créditos'},
    {id:'goal', label:'Metas'},
  ];
  let active = state._accountTab || 'mov';

  const tabsEl = el('div',{class:'tabs'}, tabs.map(t=>el('button',{
    class:`tab ${active===t.id?'active':''}`,
    text:t.label,
    onclick:()=>{ state._accountTab=t.id; saveState(); render(); }
  })));
  wrap.appendChild(el('div',{class:'card'},[tabsEl, el('div',{id:'tabBody', class:'list'},[])]));
  const tabBody = $('#tabBody', wrap);

  // Render tab content
  const E = state.economy;
  const movs = E.movements[accId];
  const cards = E.cards[accId];
  const fixed = E.fixed[accId];
  const credits = E.credits[accId];
  const goals = E.goals[accId];

  const headerButtons = el('div',{style:'display:flex; gap:10px; justify-content:flex-end; padding:14px; padding-top:0'},[
    el('button',{class:'btn', text:'Editar cuenta', onclick:()=>modalAddAccount(acc)}),
  ]);
  wrap.appendChild(headerButtons);

  if(active==='mov'){
    tabBody.appendChild(el('div',{class:'hrow'},[
      el('h2',{text:'Movimientos'}),
      el('div',{class:'hint', text:'Ingresos y gastos'})
    ]));
    tabBody.appendChild(el('div',{class:'smallhelp', text:'Tip: Puedes filtrar por mes más adelante. Ahora es lista completa.'}));
    tabBody.appendChild(el('hr',{class:'sep'}));

    for(const m of [...movs].sort((a,b)=>String(b.date).localeCompare(String(a.date)))){
      tabBody.appendChild(el('div',{class:'row'},[
        el('div',{style:'min-width:0'},[
          el('div',{class:'title', text:m.cat || (m.type==='Ingreso'?'Ingreso':'Gasto')}),
          el('div',{class:'sub', text:`${m.date || ''}${m.note?` · ${m.note}`:''}`})
        ]),
        el('div',{class:'meta'},[
          el('div',{class:'pill', text:(m.type==='Ingreso'?'+':'-')+EUR(m.amount)}),
          el('button',{class:'btn', text:'Editar', onclick:(e)=>{e.stopPropagation(); modalMovement(accId, m);}})
        ])
      ]));
    }
    if(movs.length===0){
      tabBody.appendChild(el('div',{class:'row'},[el('div',{class:'sub',text:'Aún no hay movimientos. Usa + para añadir.'})]));
    }
  }

  if(active==='card'){
    tabBody.appendChild(el('div',{class:'hrow'},[
      el('h2',{text:'Tarjetas'}),
      el('div',{class:'hint', text:'Límite, consumido y día de cobro'})
    ]));
    tabBody.appendChild(el('hr',{class:'sep'}));

    for(const c of cards){
      tabBody.appendChild(el('div',{class:'row'},[
        el('div',{style:'min-width:0'},[
          el('div',{class:'title', text:c.name}),
          el('div',{class:'sub', text:`Límite ${EUR(c.limit)} · Cobro día ${c.billingDay || '-'}`})
        ]),
        el('div',{class:'meta'},[
          el('div',{class:'pill', text:EUR(c.consumed)}),
          el('button',{class:'btn', text:'Editar', onclick:(e)=>{e.stopPropagation(); modalCard(accId, c);}})
        ])
      ]));
    }
    if(cards.length===0){
      tabBody.appendChild(el('div',{class:'row'},[el('div',{class:'sub',text:'No hay tarjetas. Usa + para añadir.'})]));
    }
  }

  if(active==='fix'){
    tabBody.appendChild(el('div',{class:'hrow'},[
      el('h2',{text:'Gastos fijos'}),
      el('div',{class:'hint', text:'Lo que se repite cada mes'})
    ]));
    tabBody.appendChild(el('hr',{class:'sep'}));

    for(const f of fixed){
      tabBody.appendChild(el('div',{class:'row'},[
        el('div',{style:'min-width:0'},[
          el('div',{class:'title', text:f.name}),
          el('div',{class:'sub', text:`Día ${f.day||'-'} · ${f.active===false?'Inactivo':'Activo'}`})
        ]),
        el('div',{class:'meta'},[
          el('div',{class:'pill', text:EUR(f.amount)}),
          el('button',{class:'btn', text:'Editar', onclick:(e)=>{e.stopPropagation(); modalFixed(accId, f);}})
        ])
      ]));
    }
    if(fixed.length===0){
      tabBody.appendChild(el('div',{class:'row'},[el('div',{class:'sub',text:'No hay gastos fijos. Usa + para añadir.'})]));
    }
  }

  if(active==='cred'){
    tabBody.appendChild(el('div',{class:'hrow'},[
      el('h2',{text:'Créditos'}),
      el('div',{class:'hint', text:'Saldo + cuota mensual'})
    ]));
    tabBody.appendChild(el('hr',{class:'sep'}));

    for(const c of credits){
      tabBody.appendChild(el('div',{class:'row'},[
        el('div',{style:'min-width:0'},[
          el('div',{class:'title', text:c.name}),
          el('div',{class:'sub', text:`Cuota ${EUR(c.monthly)} · Día ${c.day||'-'}`})
        ]),
        el('div',{class:'meta'},[
          el('div',{class:'pill', text:`Saldo ${EUR(c.balance)}`}),
          el('button',{class:'btn', text:'Editar', onclick:(e)=>{e.stopPropagation(); modalCredit(accId, c);}})
        ])
      ]));
    }
    if(credits.length===0){
      tabBody.appendChild(el('div',{class:'row'},[el('div',{class:'sub',text:'No hay créditos. Usa + para añadir.'})]));
    }
  }

  if(active==='goal'){
    tabBody.appendChild(el('div',{class:'hrow'},[
      el('h2',{text:'Metas'}),
      el('div',{class:'hint', text:'Objetivo + progreso'})
    ]));
    tabBody.appendChild(el('hr',{class:'sep'}));

    for(const g of goals){
      const pending = Math.max(0, Number(g.target||0)-Number(g.saved||0));
      tabBody.appendChild(el('div',{class:'row'},[
        el('div',{style:'min-width:0'},[
          el('div',{class:'title', text:g.name}),
          el('div',{class:'sub', text:`Objetivo ${EUR(g.target)} · Ahorrado ${EUR(g.saved)}${g.due?` · ${g.due}`:''}`})
        ]),
        el('div',{class:'meta'},[
          el('div',{class:'pill', text:`Pendiente ${EUR(pending)}`}),
          el('button',{class:'btn', text:'Editar', onclick:(e)=>{e.stopPropagation(); modalGoal(accId, g);}})
        ])
      ]));
    }
    if(goals.length===0){
      tabBody.appendChild(el('div',{class:'row'},[el('div',{class:'sub',text:'No hay metas. Usa + para añadir.'})]));
    }
  }

  // "+" behavior inside account: add depending on active tab
  state._addContext = { kind:'account', accId };

  return wrap;
}

function modalMovement(accId, edit=null){
  ensureAccContainers(accId);
  const list = state.economy.movements[accId];
  const isEdit=!!edit;
  const draft = isEdit ? {...edit} : {id:uid(), date: fmtISO(new Date()), type:'Gasto', amount:0, cat:'', note:''};

  const body=el('div',{},[
    fieldDate('Fecha', draft.date, {onInput:v=>draft.date=v}),
    fieldSelect('Tipo', draft.type, [{value:'Gasto',label:'Gasto'},{value:'Ingreso',label:'Ingreso'}], {onChange:v=>draft.type=v}),
    fieldNumber('Cantidad', draft.amount, {placeholder:'0', step:'0.01', onInput:v=>draft.amount=Number(v||0)}),
    fieldText('Categoría', draft.cat, {placeholder:'Ej: Supermercado / Nómina', onInput:v=>draft.cat=v}),
    el('div',{class:'field'},[
      el('div',{class:'label',text:'Nota'}),
      el('textarea',{class:'input', placeholder:'Opcional', oninput:(e)=>draft.note=e.target.value},[draft.note||''])
    ]),
  ]);

  showModal(isEdit?'Editar movimiento':'Añadir movimiento', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar este movimiento?')) return;
      state.economy.movements[accId] = list.filter(m=>m.id!==edit.id);
      saveState(); closeModal(); render(); toast('Eliminado');
    }}] : []),
    {text:isEdit?'Guardar':'Añadir', kind:'primary', onClick:()=>{
      if(!draft.amount || Number(draft.amount)<=0){ toast('Cantidad inválida'); return; }
      if(isEdit){
        Object.assign(edit, draft);
      }else{
        list.push(draft);
      }
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

function modalCard(accId, edit=null){
  ensureAccContainers(accId);
  const list = state.economy.cards[accId];
  const isEdit=!!edit;
  const draft = isEdit ? {...edit} : {id:uid(), name:'', limit:0, billingDay:1, consumed:0};

  const body=el('div',{},[
    fieldText('Nombre', draft.name, {placeholder:'Ej: Visa', onInput:v=>draft.name=v}),
    fieldNumber('Límite', draft.limit, {placeholder:'0', step:'0.01', onInput:v=>draft.limit=Number(v||0)}),
    fieldNumber('Consumido', draft.consumed, {placeholder:'0', step:'0.01', onInput:v=>draft.consumed=Number(v||0)}),
    fieldNumber('Día de cobro', draft.billingDay, {placeholder:'1-31', step:'1', min:1, max:31, onInput:v=>draft.billingDay=clamp(parseInt(v||'1',10),1,31)}),
  ]);

  showModal(isEdit?'Editar tarjeta':'Añadir tarjeta', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar esta tarjeta?')) return;
      state.economy.cards[accId] = list.filter(x=>x.id!==edit.id);
      saveState(); closeModal(); render(); toast('Eliminada');
    }}] : []),
    {text:isEdit?'Guardar':'Añadir', kind:'primary', onClick:()=>{
      if(!draft.name.trim()){ toast('Pon un nombre'); return; }
      if(isEdit) Object.assign(edit, draft);
      else list.push({...draft, name:draft.name.trim()});
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

function modalFixed(accId, edit=null){
  ensureAccContainers(accId);
  const list = state.economy.fixed[accId];
  const isEdit=!!edit;
  const draft = isEdit ? {...edit} : {id:uid(), name:'', amount:0, day:1, active:true};

  const body=el('div',{},[
    fieldText('Nombre', draft.name, {placeholder:'Ej: Alquiler / Netflix', onInput:v=>draft.name=v}),
    fieldNumber('Cantidad mensual', draft.amount, {placeholder:'0', step:'0.01', onInput:v=>draft.amount=Number(v||0)}),
    fieldNumber('Día de cobro', draft.day, {placeholder:'1-31', step:'1', min:1, max:31, onInput:v=>draft.day=clamp(parseInt(v||'1',10),1,31)}),
    fieldSelect('Estado', draft.active===false?'0':'1', [{value:'1',label:'Activo'},{value:'0',label:'Inactivo'}], {onChange:v=>draft.active=(v==='1')})
  ]);

  showModal(isEdit?'Editar gasto fijo':'Añadir gasto fijo', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar este gasto fijo?')) return;
      state.economy.fixed[accId] = list.filter(x=>x.id!==edit.id);
      saveState(); closeModal(); render(); toast('Eliminado');
    }}] : []),
    {text:isEdit?'Guardar':'Añadir', kind:'primary', onClick:()=>{
      if(!draft.name.trim()){ toast('Pon un nombre'); return; }
      if(!draft.amount || Number(draft.amount)<=0){ toast('Cantidad inválida'); return; }
      if(isEdit) Object.assign(edit, draft);
      else list.push({...draft, name:draft.name.trim()});
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

function modalCredit(accId, edit=null){
  ensureAccContainers(accId);
  const list = state.economy.credits[accId];
  const isEdit=!!edit;
  const draft = isEdit ? {...edit} : {id:uid(), name:'', balance:0, monthly:0, day:1, note:''};

  const body=el('div',{},[
    fieldText('Nombre', draft.name, {placeholder:'Ej: Coche / Préstamo', onInput:v=>draft.name=v}),
    fieldNumber('Saldo pendiente', draft.balance, {placeholder:'0', step:'0.01', onInput:v=>draft.balance=Number(v||0)}),
    fieldNumber('Cuota mensual', draft.monthly, {placeholder:'0', step:'0.01', onInput:v=>draft.monthly=Number(v||0)}),
    fieldNumber('Día de cobro', draft.day, {placeholder:'1-31', step:'1', min:1, max:31, onInput:v=>draft.day=clamp(parseInt(v||'1',10),1,31)}),
    el('div',{class:'field'},[
      el('div',{class:'label',text:'Nota'}),
      el('textarea',{class:'input', placeholder:'Opcional', oninput:(e)=>draft.note=e.target.value},[draft.note||''])
    ]),
  ]);

  showModal(isEdit?'Editar crédito':'Añadir crédito', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar este crédito?')) return;
      state.economy.credits[accId] = list.filter(x=>x.id!==edit.id);
      saveState(); closeModal(); render(); toast('Eliminado');
    }}] : []),
    {text:isEdit?'Guardar':'Añadir', kind:'primary', onClick:()=>{
      if(!draft.name.trim()){ toast('Pon un nombre'); return; }
      if(isEdit) Object.assign(edit, draft);
      else list.push({...draft, name:draft.name.trim()});
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

function modalGoal(accId, edit=null){
  ensureAccContainers(accId);
  const list = state.economy.goals[accId];
  const isEdit=!!edit;
  const draft = isEdit ? {...edit} : {id:uid(), name:'', target:0, saved:0, due:'', note:''};

  const body=el('div',{},[
    fieldText('Nombre', draft.name, {placeholder:'Ej: Viaje / Fondo emergencia', onInput:v=>draft.name=v}),
    fieldNumber('Objetivo', draft.target, {placeholder:'0', step:'0.01', onInput:v=>draft.target=Number(v||0)}),
    fieldNumber('Ahorrado', draft.saved, {placeholder:'0', step:'0.01', onInput:v=>draft.saved=Number(v||0)}),
    fieldDate('Fecha objetivo (opcional)', draft.due, {onInput:v=>draft.due=v}),
    el('div',{class:'field'},[
      el('div',{class:'label',text:'Nota'}),
      el('textarea',{class:'input', placeholder:'Opcional', oninput:(e)=>draft.note=e.target.value},[draft.note||''])
    ]),
  ]);

  showModal(isEdit?'Editar meta':'Añadir meta', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar esta meta?')) return;
      state.economy.goals[accId] = list.filter(x=>x.id!==edit.id);
      saveState(); closeModal(); render(); toast('Eliminada');
    }}] : []),
    {text:isEdit?'Guardar':'Añadir', kind:'primary', onClick:()=>{
      if(!draft.name.trim()){ toast('Pon un nombre'); return; }
      if(!draft.target || Number(draft.target)<=0){ toast('Objetivo inválido'); return; }
      if(isEdit) Object.assign(edit, draft);
      else list.push({...draft, name:draft.name.trim()});
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

/* ------------- AGENDA ------------- */

function viewAgenda(){
  setTop('Agenda', 'Calendario + eventos');
  setButtons({back:true, add:true, settings:true});
  state._addContext = { kind:'agenda' };

  const wrap=el('div');

  // month focus
  const today=new Date();
  const [y,m] = (state.meta.monthFocus||`${today.getFullYear()}-${pad2(today.getMonth()+1)}`).split('-').map(x=>parseInt(x,10));
  let year=y||today.getFullYear();
  let monthIndex=(m?m-1:today.getMonth());

  function goMonth(delta){
    const d=new Date(year, monthIndex+delta, 1);
    year=d.getFullYear(); monthIndex=d.getMonth();
    state.meta.monthFocus = `${year}-${pad2(monthIndex+1)}`;
    saveState(); render();
  }

  const cal = calendarView({
    year, monthIndex,
    onDayClick: ({iso, nav, today:goToday})=>{
      if(nav===-1) return goMonth(-1);
      if(nav===+1) return goMonth(+1);
      if(goToday){
        const d=new Date();
        state.meta.monthFocus = `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
        saveState(); return render();
      }
      if(iso) return modalAgendaDay(iso);
    },
    dayBadge: (iso,inMonth)=>{
      const ev = state.agenda.events[iso] || [];
      if(ev.length===0) return el('div',{class:'daySub', text:''});
      return el('div',{class:'dayTag'},[
        el('span',{class:'dot', style:'background:'+ (ev.length>=3 ? '#A212C4' : '#153293') }),
        el('span',{text: `${ev.length} evento${ev.length>1?'s':''}`})
      ]);
    }
  });

  wrap.appendChild(el('div',{class:'card'},[cal]));
  return wrap;
}

function modalAgendaDay(iso){
  state.agenda.events[iso]=state.agenda.events[iso]||[];
  const list = state.agenda.events[iso];

  const body=el('div',{},[
    el('div',{class:'hrow'},[
      el('h2',{text:`${iso}`}),
      el('div',{class:'hint', text:'Eventos del día'})
    ]),
    el('div',{class:'smallhelp', text:'Pulsa un evento para editarlo, o añade uno nuevo.'}),
    el('hr',{class:'sep'}),
    el('div',{id:'evList', class:'list', style:'padding:0'})
  ]);

  const evList = $('#evList', body);

  function renderList(){
    evList.innerHTML='';
    for(const e of list){
      evList.appendChild(el('div',{class:'row', onclick:()=>modalAgendaEvent(iso,e)},[
        el('div',{style:'min-width:0'},[
          el('div',{class:'title', text:e.title}),
          el('div',{class:'sub', text:`${e.time||''}${e.note?` · ${e.note}`:''}`})
        ]),
        el('div',{class:'meta'},[
          el('div',{class:'pill', text:e.time||'—'}),
          el('button',{class:'btn', text:'Editar', onclick:(x)=>{x.stopPropagation(); modalAgendaEvent(iso,e);}})
        ])
      ]));
    }
    if(list.length===0){
      evList.appendChild(el('div',{class:'row'},[el('div',{class:'sub', text:'No hay eventos.'})]));
    }
  }
  renderList();

  showModal('Agenda — Día', body, [
    {text:'Cerrar', kind:'ghost', onClick:()=>closeModal()},
    {text:'Añadir evento', kind:'primary', onClick:()=>modalAgendaEvent(iso,null)}
  ]);
}

function modalAgendaEvent(iso, edit=null){
  const list = state.agenda.events[iso];
  const isEdit=!!edit;
  const draft = isEdit ? {...edit} : {id:uid(), title:'', time:'', note:''};

  const body=el('div',{},[
    fieldText('Título', draft.title, {placeholder:'Ej: Médico', onInput:v=>draft.title=v}),
    fieldText('Hora (opcional)', draft.time, {placeholder:'Ej: 18:30', onInput:v=>draft.time=v}),
    el('div',{class:'field'},[
      el('div',{class:'label',text:'Nota'}),
      el('textarea',{class:'input', placeholder:'Opcional', oninput:(e)=>draft.note=e.target.value},[draft.note||''])
    ]),
  ]);

  showModal(isEdit?'Editar evento':'Añadir evento', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar este evento?')) return;
      state.agenda.events[iso] = list.filter(x=>x.id!==edit.id);
      saveState(); closeModal(); render(); toast('Eliminado');
    }}] : []),
    {text:isEdit?'Guardar':'Añadir', kind:'primary', onClick:()=>{
      if(!draft.title.trim()){ toast('Pon un título'); return; }
      if(isEdit) Object.assign(edit, draft, {title:draft.title.trim()});
      else list.push({...draft, title:draft.title.trim()});
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

/* ------------- WORK ------------- */

function viewWork(){
  setTop('Trabajo', 'Turnos + calendario');
  setButtons({back:true, add:true, settings:true});
  state._addContext = { kind:'work' };

  const wrap=el('div');

  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'grid cols2'},[
      el('div',{class:'card'},[
        el('div',{class:'kpi'},[
          el('div',{class:'left'},[
            el('div',{class:'label', text:'Rotación'}),
            el('div',{class:'value', text:(state.work.rotation.pattern?.length? `${state.work.rotation.pattern.length} días` : 'Manual')}),
            el('div',{class:'small', text: state.work.rotation.pattern?.length ? `Empieza: ${state.work.rotation.startDate}` : 'Sin patrón automático'})
          ]),
          el('div',{class:'badge', text: state.work.rotation.pattern?.length ? 'ON' : 'OFF'})
        ])
      ]),
      el('div',{class:'card'},[
        el('div',{class:'kpi'},[
          el('div',{class:'left'},[
            el('div',{class:'label', text:'Turnos'}),
            el('div',{class:'value', text:String(state.work.shifts.length)}),
            el('div',{class:'small', text:'Puedes editarlos (colores incluidos)'})
          ])
        ])
      ]),
    ])
  ]));

  // Calendar month focus uses meta.monthFocus too
  const today=new Date();
  const [y,m] = (state.meta.monthFocus||`${today.getFullYear()}-${pad2(today.getMonth()+1)}`).split('-').map(x=>parseInt(x,10));
  let year=y||today.getFullYear();
  let monthIndex=(m?m-1:today.getMonth());

  function goMonth(delta){
    const d=new Date(year, monthIndex+delta, 1);
    year=d.getFullYear(); monthIndex=d.getMonth();
    state.meta.monthFocus = `${year}-${pad2(monthIndex+1)}`;
    saveState(); render();
  }

  const cal = calendarView({
    year, monthIndex,
    onDayClick: ({iso, nav, today:goToday})=>{
      if(nav===-1) return goMonth(-1);
      if(nav===+1) return goMonth(+1);
      if(goToday){
        const d=new Date();
        state.meta.monthFocus = `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
        saveState(); return render();
      }
      if(iso) return modalWorkDay(iso);
    },
    dayBadge: (iso,inMonth)=>{
      const day = getDayWork(iso);
      const auto = autoShiftForDate(iso);
      const shiftId = day.shiftId || auto;
      const s = shiftId ? getShift(shiftId) : null;

      const tag = s ? el('div',{class:'dayTag'},[
        el('span',{class:'dot', style:'background:'+ (s.color||'#bbb')}),
        el('span',{text:s.name})
      ]) : null;

      const hours = (day.hours!=null ? day.hours : (s ? s.hours : null));
      const sub = el('div',{class:'daySub', text: hours!=null ? `${hours}h` : ''});

      const box = el('div',{},[]);
      if(tag) box.appendChild(tag);
      box.appendChild(sub);
      return box;
    }
  });

  wrap.appendChild(el('div',{class:'card'},[
    el('div',{class:'hrow', style:'padding:14px; padding-bottom:0'},[
      el('h2',{text:'Calendario'}),
      el('div',{class:'hint', text:'Pulsa un día para editar turno, horas, extras o velada'})
    ]),
    cal
  ]));

  // quick manage buttons
  wrap.appendChild(el('div',{class:'section'},[
    el('div',{class:'grid cols2'},[
      el('div',{class:'card pad'},[
        el('div',{class:'hrow'},[
          el('h2',{text:'Turnos'}),
          el('div',{class:'hint', text:'Colores con picker'})
        ]),
        el('button',{class:'btn', text:'Gestionar turnos', onclick:()=>modalManageShifts()}),
      ]),
      el('div',{class:'card pad'},[
        el('div',{class:'hrow'},[
          el('h2',{text:'Rotación'}),
          el('div',{class:'hint', text:'Patrón automático'})
        ]),
        el('button',{class:'btn', text:'Configurar rotación', onclick:()=>modalRotation()}),
      ]),
    ])
  ]));

  return wrap;
}

function modalManageShifts(){
  const body=el('div',{},[
    el('div',{class:'smallhelp', text:'Añade/edita turnos. Los colores se eligen con selector (no con códigos).'}),
    el('hr',{class:'sep'}),
    el('div',{id:'shiftList', class:'list', style:'padding:0'})
  ]);
  const listEl = $('#shiftList', body);

  const renderList=()=>{
    listEl.innerHTML='';
    for(const s of state.work.shifts){
      listEl.appendChild(el('div',{class:'row', onclick:()=>modalEditShift(s)},[
        el('div',{style:'min-width:0'},[
          el('div',{class:'title', text:s.name}),
          el('div',{class:'sub', text:`${s.kind} · ${s.hours}h`})
        ]),
        el('div',{class:'meta'},[
          el('span',{class:'dot', style:'background:'+ (s.color||'#bbb')}),
          el('button',{class:'btn', text:'Editar', onclick:(e)=>{e.stopPropagation(); modalEditShift(s);}})
        ])
      ]));
    }
  };
  renderList();

  showModal('Turnos', body, [
    {text:'Cerrar', kind:'ghost', onClick:()=>closeModal()},
    {text:'Añadir turno', kind:'primary', onClick:()=>modalEditShift(null)}
  ]);
}

function modalEditShift(edit=null){
  const isEdit=!!edit;
  const draft = isEdit ? {...edit} : {id:uid(), name:'', color:'#153293', hours:8, kind:'Trabajo'};

  const body=el('div',{},[
    fieldText('Nombre', draft.name, {placeholder:'Ej: Mañana', onInput:v=>draft.name=v}),
    fieldColor('Color', draft.color, {onInput:v=>draft.color=v}),
    fieldNumber('Horas por defecto', draft.hours, {placeholder:'8', step:'0.5', onInput:v=>draft.hours=Number(v||0)}),
    fieldSelect('Tipo', draft.kind, [{value:'Trabajo',label:'Trabajo'},{value:'Libre',label:'Libre'},{value:'Velada',label:'Velada'}], {onChange:v=>draft.kind=v}),
  ]);

  showModal(isEdit?'Editar turno':'Añadir turno', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    ...(isEdit ? [{text:'Eliminar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Eliminar este turno?')) return;
      // remove from shifts
      state.work.shifts = state.work.shifts.filter(x=>x.id!==edit.id);
      // remove from rotation pattern
      state.work.rotation.pattern = (state.work.rotation.pattern||[]).filter(id=>id!==edit.id);
      // remove from days assignments
      for(const [k,v] of Object.entries(state.work.days)){
        if(v.shiftId===edit.id) v.shiftId=null;
      }
      saveState(); closeModal(); render(); toast('Turno eliminado');
    }}] : []),
    {text:isEdit?'Guardar':'Añadir', kind:'primary', onClick:()=>{
      if(!draft.name.trim()){ toast('Pon un nombre'); return; }
      if(isEdit) Object.assign(edit, {...draft, name:draft.name.trim()});
      else state.work.shifts.push({...draft, name:draft.name.trim()});
      saveState(); closeModal(); render(); toast('Guardado');
    }}
  ]);
}

function modalRotation(){
  const rot = state.work.rotation;
  const draft = { startDate: rot.startDate, pattern: [...(rot.pattern||[])] };

  const body=el('div',{},[
    el('div',{class:'smallhelp', text:'Crea un patrón (ej: 3M-3T-3N-3L). Luego el calendario lo aplica automáticamente desde la fecha de inicio. Si quieres, lo dejas vacío y lo editas día a día.'}),
    fieldDate('Fecha inicio del patrón', draft.startDate, {onInput:v=>draft.startDate=v}),
    el('div',{class:'field'},[
      el('div',{class:'label', text:'Turnos disponibles'}),
      shiftChips(draft)
    ]),
    el('div',{class:'field'},[
      el('div',{class:'label', text:'Patrón actual'}),
      el('div',{id:'seq', class:'seq'})
    ]),
    el('div',{class:'smallhelp', text:'Pulsa un turno para añadirlo al patrón. En el patrón, pulsa × para quitar una pieza.'})
  ]);

  const seqEl = $('#seq', body);

  function renderSeq(){
    seqEl.innerHTML='';
    if(draft.pattern.length===0){
      seqEl.appendChild(el('div',{class:'smallhelp', text:'(Vacío)'}));
      return;
    }
    for(let i=0;i<draft.pattern.length;i++){
      const id = draft.pattern[i];
      const s = getShift(id);
      const piece=el('div',{class:'piece'},[
        el('span',{class:'dot', style:'background:'+(s?.color||'#bbb')}),
        el('span',{text:s?.name||'¿?'}),
        el('button',{text:'×', onclick:(e)=>{e.stopPropagation(); draft.pattern.splice(i,1); renderSeq();}})
      ]);
      seqEl.appendChild(piece);
    }
  }

  function shiftChips(draft){
    const box=el('div',{class:'chips'});
    for(const s of state.work.shifts){
      box.appendChild(el('div',{class:'chip', onclick:()=>{draft.pattern.push(s.id); renderSeq();}},[
        el('span',{class:'dot', style:'background:'+ (s.color||'#bbb')}),
        el('span',{text:s.name}),
      ]));
    }
    return box;
  }

  renderSeq();

  showModal('Rotación', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    {text:'Desactivar', kind:'ghost', onClick:()=>{
      if(!confirm('¿Desactivar patrón automático?')) return;
      state.work.rotation.pattern = [];
      saveState(); closeModal(); render(); toast('Rotación desactivada');
    }},
    {text:'Guardar', kind:'primary', onClick:()=>{
      state.work.rotation.startDate = draft.startDate || fmtISO(new Date());
      state.work.rotation.pattern = draft.pattern;
      saveState(); closeModal(); render(); toast('Rotación guardada');
    }},
  ]);
}

function modalWorkDay(iso){
  const day = getDayWork(iso);
  const auto = autoShiftForDate(iso);
  const effectiveShiftId = day.shiftId || auto;

  const draft = {...day};
  if(draft.shiftId==null && auto) draft.shiftId = auto; // prefill, but can change
  if(draft.hours==null){
    const s = effectiveShiftId ? getShift(effectiveShiftId) : null;
    draft.hours = s ? s.hours : 0;
  }

  const body=el('div',{},[
    el('div',{class:'hrow'},[
      el('h2',{text:iso}),
      el('div',{class:'hint', text:auto && !day.shiftId ? 'Auto (rotación)' : 'Manual'})
    ]),
    fieldSelect('Turno', draft.shiftId || '', [{value:'',label:'(Sin turno)'}].concat(
      state.work.shifts.map(s=>({value:s.id, label:s.name}))
    ), {onChange:v=>{draft.shiftId = v || null; const s=v?getShift(v):null; draft.hours = s? s.hours:0; rerenderPreview();}}),
    fieldNumber('Horas', draft.hours, {step:'0.5', onInput:v=>draft.hours=Number(v||0)}),
    el('hr',{class:'sep'}),
    el('div',{class:'hrow'},[
      el('h2',{text:'Extras'}),
      el('div',{class:'hint', text:'Opcional'})
    ]),
    fieldNumber('Horas extra', draft.extraHours||0, {step:'0.5', onInput:v=>draft.extraHours=Number(v||0)}),
    fieldNumber('€/hora extra', draft.extraRate||0, {step:'0.01', onInput:v=>draft.extraRate=Number(v||0)}),
    el('hr',{class:'sep'}),
    el('div',{class:'hrow'},[
      el('h2',{text:'Velada'}),
      el('div',{class:'hint', text:'Opcional'})
    ]),
    fieldNumber('Horas velada', draft.veladaHours||0, {step:'0.5', onInput:v=>draft.veladaHours=Number(v||0)}),
    fieldNumber('€/hora velada', draft.veladaRate||0, {step:'0.01', onInput:v=>draft.veladaRate=Number(v||0)}),
    el('hr',{class:'sep'}),
    el('div',{class:'field'},[
      el('div',{class:'label',text:'Nota'}),
      el('textarea',{class:'input', placeholder:'Opcional', oninput:(e)=>draft.note=e.target.value},[draft.note||''])
    ]),
    el('div',{class:'card pad', style:'background:rgba(246,247,251,.7)'},[
      el('div',{class:'label', text:'Resumen del día'}),
      el('div',{id:'preview', style:'font-weight:900; margin-top:6px; font-size:14px'})
    ])
  ]);

  const previewEl = $('#preview', body);
  function rerenderPreview(){
    const s = draft.shiftId ? getShift(draft.shiftId) : null;
    const base = s ? `${s.name} · ${draft.hours}h` : `Sin turno · ${draft.hours}h`;
    const extras = (draft.extraHours>0) ? ` · +${draft.extraHours}h extra` : '';
    const vel = (draft.veladaHours>0) ? ` · +${draft.veladaHours}h velada` : '';
    previewEl.textContent = base + extras + vel;
  }
  rerenderPreview();

  showModal('Trabajo — Editar día', body, [
    {text:'Cancelar', kind:'ghost', onClick:()=>closeModal()},
    {text:'Borrar día', kind:'ghost', onClick:()=>{
      if(!confirm('¿Borrar personalización de este día?')) return;
      delete state.work.days[iso];
      saveState(); closeModal(); render(); toast('Borrado');
    }},
    {text:'Guardar', kind:'primary', onClick:()=>{
      state.work.days[iso] = {
        shiftId: draft.shiftId || null,
        hours: Number(draft.hours||0),
        extraHours: Number(draft.extraHours||0),
        extraRate: Number(draft.extraRate||0),
        veladaHours: Number(draft.veladaHours||0),
        veladaRate: Number(draft.veladaRate||0),
        note: draft.note || ''
      };
      saveState(); closeModal(); render(); toast('Guardado');
    }},
  ]);
}

/* ------------- SETTINGS ------------- */

function modalSettings(){
  const body=el('div',{},[
    el('div',{class:'smallhelp', text:'Ajustes rápidos. Esto es local (tu navegador).'}),
    el('hr',{class:'sep'}),
    el('div',{class:'hrow'},[
      el('h2',{text:'Datos'}),
      el('div',{class:'hint', text:'Copia/pega para backup'})
    ]),
    el('button',{class:'btn', text:'Exportar datos (copiar)', onclick:()=>{
      const txt = JSON.stringify(state);
      navigator.clipboard.writeText(txt).then(()=>toast('Copiado')).catch(()=>toast('No se pudo copiar'));
    }}),
    el('div',{style:'height:10px'}),
    el('button',{class:'btn', text:'Importar datos (pegar)', onclick:()=>{
      const v = prompt('Pega aquí el JSON exportado:');
      if(!v) return;
      try{
        const obj=JSON.parse(v);
        state=obj;
        saveState();
        toast('Importado');
        closeModal();
        render();
      }catch(e){
        toast('JSON inválido');
      }
    }}),
    el('div',{style:'height:10px'}),
    el('button',{class:'btn', text:'Reset total (borrar todo)', onclick:()=>{
      if(!confirm('Esto borra TODO. ¿Seguro?')) return;
      localStorage.removeItem(KEY);
      state = defaultState();
      saveState();
      toast('Reset hecho');
      closeModal();
      render();
    }}),
    el('hr',{class:'sep'}),
    el('div',{class:'smallhelp', text:'Si GitHub Pages te hace cosas raras, prueba Ctrl+F5 o añade ?v=123 al final de la URL para saltarte caché.'})
  ]);

  showModal('Ajustes', body, [
    {text:'Cerrar', kind:'primary', onClick:()=>closeModal()}
  ]);
}

/* ====================== Render ====================== */

function render(){
  const main=$('#main');
  main.innerHTML='';
  const r = route;

  if(r===ROUTES.home()) main.appendChild(viewHome());
  else if(r===ROUTES.work()) main.appendChild(viewWork());
  else if(r===ROUTES.economy()) main.appendChild(viewEconomy());
  else if(r===ROUTES.agenda()) main.appendChild(viewAgenda());
  else if(r.startsWith('account:')) main.appendChild(viewAccount(r.split(':')[1]));
  else main.appendChild(viewHome());

  // update buttons actions
  $('#btnBack').onclick = ()=>back();
  $('#btnSettings').onclick = ()=>modalSettings();

  $('#btnAdd').onclick = ()=>{
    // context-sensitive add
    const ctx = state._addContext || {kind:'home'};
    if(route===ROUTES.economy()) return modalAddAccount();
    if(ctx.kind==='account'){
      const accId = ctx.accId;
      const tab = state._accountTab || 'mov';
      if(tab==='mov') return modalMovement(accId);
      if(tab==='card') return modalCard(accId);
      if(tab==='fix') return modalFixed(accId);
      if(tab==='cred') return modalCredit(accId);
      if(tab==='goal') return modalGoal(accId);
      return modalMovement(accId);
    }
    if(route===ROUTES.work()) return modalManageShifts();
    if(route===ROUTES.agenda()) return modalAgendaDay(fmtISO(new Date()));
    // fallback
    toast('Pulsa en un apartado y usa + ahí');
  };
}

function boot(){
  // Close modal behaviors
  $('#modalClose').addEventListener('click', closeModal);
  $('#overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') closeModal(); });

  // Escape
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && !$('#overlay').classList.contains('hidden')) closeModal(); });

  render();
}

document.addEventListener('DOMContentLoaded', boot);
