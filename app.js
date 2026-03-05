
'use strict';

/* Personal Manager V4 — tema claro, sin SW, contratos con inicio/fin, rotación robusta (UTC) */

const $ = (s, el=document) => el.querySelector(s);
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const pad2 = (n) => String(n).padStart(2,'0');
const fmtISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseISO = (s) => {
  const [y,m,d] = String(s||'').split('-').map(Number);
  if(!y||!m||!d) return null;
  const dt = new Date(y, m-1, d);
  return isNaN(dt.getTime()) ? null : dt;
};
const dayNumUTC = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())/86400000);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const monthName = (m) => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];

function el(tag, attrs={}, children=[]){
  const n = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') n.className = v;
    else if(k==='text') n.textContent = v;
    else if(k==='html') n.innerHTML = v;
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2), v);
    else if(v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for(const c of (children||[])){
    if(c==null) continue;
    n.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
  }
  return n;
}

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._to);
  toast._to = setTimeout(()=>t.classList.add('hidden'), 1600);
}

/* Modal */
function openModal(title, bodyNodes=[], footNodes=[]){
  $('#modalTitle').textContent = title;
  const b = $('#modalBody'); b.innerHTML='';
  bodyNodes.forEach(n=>b.appendChild(n));
  const f = $('#modalFoot'); f.innerHTML='';
  footNodes.forEach(n=>f.appendChild(n));
  $('#overlay').classList.remove('hidden');
}
function closeModal(){ $('#overlay').classList.add('hidden'); }

/* Fields */
function fieldText(label, val, placeholder, onChange){
  const i = el('input',{class:'input', value: val ?? '', placeholder: placeholder ?? ''});
  i.addEventListener('input', ()=>onChange(i.value));
  return el('div',{class:'field'},[ el('div',{class:'label',text:label}), i ]);
}
function fieldNumber(label, val, placeholder, onChange, step='0.01'){
  const i = el('input',{class:'input', type:'number', value:(val ?? ''), placeholder: placeholder ?? '', step});
  i.addEventListener('input', ()=>{
    const v = i.value==='' ? null : Number(i.value);
    onChange(v);
  });
  return el('div',{class:'field'},[ el('div',{class:'label',text:label}), i ]);
}
function fieldDate(label, val, onChange){
  const i = el('input',{class:'input', type:'date', value: val ?? ''});
  i.addEventListener('input', ()=>onChange(i.value));
  return el('div',{class:'field'},[ el('div',{class:'label',text:label}), i ]);
}
function fieldSelect(label, val, options, onChange){
  const s = el('select',{class:'select'});
  options.forEach(o=>{
    const op = el('option',{value:o.value, text:o.label});
    if(String(o.value)===String(val)) op.selected = true;
    s.appendChild(op);
  });
  s.addEventListener('change', ()=>onChange(s.value));
  return el('div',{class:'field'},[ el('div',{class:'label',text:label}), s ]);
}
function btn(text, kind='', onClick=null){
  const b = el('button',{class:`btn ${kind}`.trim(), text});
  if(onClick) b.addEventListener('click', onClick);
  return b;
}

/* Storage */
const KEY = 'pm_v4_state';
const WELCOME_KEY = 'pm_v4_seen_welcome';
const DEFAULT = {
  ui: {
    workFocus: {year: (new Date()).getFullYear(), month:(new Date()).getMonth()},
    agendaFocus: {year:(new Date()).getFullYear(), month:(new Date()).getMonth()},
    economyFocus: {year:(new Date()).getFullYear(), month:(new Date()).getMonth()}
  },
  work: {
    hourly: 14.0,
    irpf: 12,
    extraRate: 15,
    watchRate: 18,
    shifts: [
      {id:'M', name:'Mañana', color:'#16a34a', hours:8, type:'work'},
      {id:'T', name:'Tarde',  color:'#2563eb', hours:8, type:'work'},
      {id:'N', name:'Noche',  color:'#7c3aed', hours:8, type:'work'},
      {id:'L', name:'Libre',  color:'#94a3b8', hours:0, type:'off'},
      {id:'V', name:'Velada', color:'#f59e0b', hours:0, type:'watch'}
    ],
    contracts: [],
    days: {}
  },
  economy: { accounts: [], movements: [] },
  agenda: { events: [] }
};

function deepMerge(a,b){
  if(b==null) return a;
  if(Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if(typeof a==='object' && typeof b==='object'){
    for(const k of Object.keys(b)){
      if(k in a) a[k] = deepMerge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  return (b===undefined) ? a : b;
}
function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(DEFAULT);
    return deepMerge(structuredClone(DEFAULT), JSON.parse(raw));
  }catch(e){
    console.warn(e);
    return structuredClone(DEFAULT);
  }
}
function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); }

let state = loadState();

function normalizeFocus(focus){
  const now = new Date();
  const y = Number(focus?.year);
  const m = Number(focus?.month);
  const okY = Number.isFinite(y) && y>=2000 && y<=2100;
  const okM = Number.isFinite(m) && m>=0 && m<=11;
  return { year: okY ? y : now.getFullYear(), month: okM ? m : now.getMonth() };
}
state.ui.workFocus = normalizeFocus(state.ui.workFocus);
state.ui.agendaFocus = normalizeFocus(state.ui.agendaFocus);
state.ui.economyFocus = normalizeFocus(state.ui.economyFocus);
saveState();

/* Router */
function getRoute(){ return (location.hash||'#home').slice(1) || 'home'; }
function go(route){ location.hash = `#${route}`; }

/* Calendar */
function renderCalendar(year, month, {onDayClick, getBadge}){
  const head = el('div',{class:'calHead'}, 'L M X J V S D'.split(' ').map(x=>el('div',{text:x})));
  const grid = el('div',{class:'calGrid'});

  const first = new Date(year, month, 1);
  const last = new Date(year, month+1, 0);
  const daysInMonth = last.getDate();
  const offset = (first.getDay()+6)%7;
  const prevLast = new Date(year, month, 0).getDate();

  for(let i=0;i<42;i++){
    const dayNum = i - offset + 1;
    let yy=year, mm=month, dd=dayNum;
    let muted=false;
    if(dayNum<=0){
      muted=true;
      mm = month-1; yy=year;
      if(mm<0){ mm=11; yy=year-1; }
      dd = prevLast + dayNum;
    } else if(dayNum>daysInMonth){
      muted=true;
      mm = month+1; yy=year;
      if(mm>11){ mm=0; yy=year+1; }
      dd = dayNum - daysInMonth;
    }
    const iso = `${yy}-${pad2(mm+1)}-${pad2(dd)}`;

    const badge = getBadge ? getBadge(iso, muted) : null;

    const cell = el('div',{class:`day ${muted?'muted':''}`},[
      el('div',{class:'dayTop'},[
        el('div',{text:String(dd)}),
        badge ? badge : el('div',{})
      ]),
      el('div',{class:'daySmall', text: badge?.dataset?.small || ''})
    ]);
    cell.addEventListener('click', ()=>onDayClick(iso));
    grid.appendChild(cell);
  }

  return el('div',{class:'calWrap'},[head, grid]);
}

/* Work helpers */
function shiftById(id){ return state.work.shifts.find(s=>s.id===id) || null; }

function contractForDate(iso){
  const d = parseISO(iso);
  if(!d) return null;
  const t = dayNumUTC(d);
  let best = null;
  for(const c of (state.work.contracts||[])){
    const s = parseISO(c.start); if(!s) continue;
    const e = c.end ? parseISO(c.end) : null;
    const ts = dayNumUTC(s);
    const te = e ? dayNumUTC(e) : 10**12;
    if(t>=ts && t<=te){
      if(!best) best=c;
      else if(ts >= dayNumUTC(parseISO(best.start))) best=c;
    }
  }
  return best;
}

function autoShiftForDate(iso){
  const c = contractForDate(iso);
  if(!c) return null;
  const rot = c.rotation || {enabled:false};
  if(!rot.enabled) return null;

  const start = parseISO(rot.startDate);
  const d = parseISO(iso);
  if(!start || !d) return null;

  const diffDays = dayNumUTC(d) - dayNumUTC(start);
  const pat = Array.isArray(rot.pattern) ? rot.pattern : [];
  if(!pat.length) return null;

  const idx = ((diffDays % pat.length) + pat.length) % pat.length;
  return pat[idx];
}

function dayEntry(iso){ return state.work.days?.[iso] || null; }

function effectiveShiftId(iso){
  const entry = dayEntry(iso);
  if(entry?.shiftId) return entry.shiftId;
  return autoShiftForDate(iso);
}

function calcMonthTotals(year, month){
  const start = new Date(year, month, 1);
  const end = new Date(year, month+1, 1);
  let base=0, extra=0, watch=0, gross=0;

  // manual entries
  for(const [iso, entry] of Object.entries(state.work.days||{})){
    const d = parseISO(iso);
    if(!d || d<start || d>=end) continue;

    const shId = entry.shiftId || autoShiftForDate(iso);
    const sh = shId ? shiftById(shId) : null;

    const h = Number(entry.hours ?? sh?.hours ?? 0);
    const exH = Number(entry.extraHours||0);
    const wh = Number(entry.watchHours||0);

    base += Math.max(0,h);
    extra += Math.max(0,exH);
    watch += Math.max(0,wh);

    const hr = Number(state.work.hourly||0);
    const exRate = Number(entry.extraRate||state.work.extraRate||0);
    const wRate = Number(entry.watchRate||state.work.watchRate||0);

    gross += (Math.max(0,h)*hr) + (Math.max(0,exH)*exRate) + (Math.max(0,wh)*wRate);
  }

  // auto days without manual entry
  for(let dd=1; dd<=31; dd++){
    const d = new Date(year, month, dd);
    if(d.getMonth()!==month) break;
    const iso = fmtISO(d);
    if(state.work.days?.[iso]) continue;
    const shId = autoShiftForDate(iso);
    const sh = shId ? shiftById(shId) : null;
    if(!sh) continue;
    const h = Number(sh.hours||0);
    base += Math.max(0,h);
    const hr = Number(state.work.hourly||0);
    gross += Math.max(0,h)*hr;
  }

  const net = gross * (1 - (Number(state.work.irpf||0)/100));
  return {base, extra, watch, net};
}

/* Month/Year selectors */
function monthYearSelectors(focusObj, onChange){
  const monthSel = el('select',{class:'select'});
  for(let i=0;i<12;i++){
    const op = el('option',{value:String(i), text:monthName(i)});
    if(i===focusObj.month) op.selected=true;
    monthSel.appendChild(op);
  }
  monthSel.addEventListener('change', ()=>{
    focusObj.month = clamp(Number(monthSel.value), 0, 11);
    onChange();
  });

  const yearSel = el('select',{class:'select'});
  const nowY = (new Date()).getFullYear();
  for(let y=nowY-10; y<=nowY+10; y++){
    const op = el('option',{value:String(y), text:String(y)});
    if(y===focusObj.year) op.selected=true;
    yearSel.appendChild(op);
  }
  yearSel.addEventListener('change', ()=>{
    focusObj.year = clamp(Number(yearSel.value), 2000, 2100);
    onChange();
  });

  return {monthSel, yearSel};
}

/* Modals */
function openWorkSettings(){
  const model = {
    hourly: state.work.hourly,
    irpf: state.work.irpf,
    extraRate: state.work.extraRate,
    watchRate: state.work.watchRate
  };
  openModal('Ajustes trabajo', [
    fieldNumber('Salario hora (€)', model.hourly, '0,00', v=>model.hourly=Number(v||0)),
    fieldNumber('IRPF (%)', model.irpf, '0', v=>model.irpf=clamp(Number(v||0),0,60), '1'),
    fieldNumber('Tarifa extra €/h', model.extraRate, '0,00', v=>model.extraRate=Number(v||0)),
    fieldNumber('Tarifa velada €/h', model.watchRate, '0,00', v=>model.watchRate=Number(v||0)),
  ], [
    btn('Cancelar','ghost', closeModal),
    btn('Guardar','primary', ()=>{
      state.work.hourly = Number(model.hourly||0);
      state.work.irpf = clamp(Number(model.irpf||0),0,60);
      state.work.extraRate = Number(model.extraRate||0);
      state.work.watchRate = Number(model.watchRate||0);
      saveState(); closeModal(); render(); toast('Guardado');
    })
  ]);
}

function openContractModal(contract=null){
  const isEdit = !!contract;
  const model = contract ? JSON.parse(JSON.stringify(contract)) : {
    id: uid(),
    name: '',
    start: fmtISO(new Date()),
    end: '',
    rotation: { enabled:true, startDate: fmtISO(new Date()), pattern: ['M','M','M','M','M','M','L','T','T','T','T','T','T','L','N','N','N','N','N','N','L'] }
  };

  const pat = Array.isArray(model.rotation.pattern) ? model.rotation.pattern.slice() : [];

  const patBox = el('div',{class:'list'});
  const renderPat = ()=>{
    patBox.innerHTML='';
    const row = el('div',{class:'row'});
    pat.forEach((id, idx)=>{
      const sh = shiftById(id);
      const chip = el('span',{class:'badge'},[
        el('span',{class:'dot', style:`background:${sh?.color||'#cbd5e1'}`}),
        el('span',{text:sh?.name||id}),
        el('span',{text:'×', style:'margin-left:6px; opacity:.7; cursor:pointer;'})
      ]);
      chip.addEventListener('click', ()=>{ pat.splice(idx,1); renderPat(); });
      row.appendChild(chip);
    });
    patBox.appendChild(row);
    patBox.appendChild(el('div',{class:'help', text:'Pulsa un chip para quitarlo.'}));
  };
  renderPat();

  const addRow = el('div',{class:'row'});
  state.work.shifts.forEach(s=>{
    const b = el('button',{class:'btn ghost', text:s.name});
    b.addEventListener('click', ()=>{ pat.push(s.id); renderPat(); });
    addRow.appendChild(b);
  });
  const clearBtn = btn('Vaciar patrón','bad', ()=>{ pat.length=0; renderPat(); });

  const rotToggle = el('input',{type:'checkbox'});
  rotToggle.checked = !!model.rotation.enabled;
  rotToggle.addEventListener('change', ()=>{ model.rotation.enabled = rotToggle.checked; });

  openModal(isEdit?'Editar contrato':'Nuevo contrato', [
    fieldText('Nombre', model.name, 'Ej: Stellantis', v=>model.name=v),
    fieldDate('Inicio', model.start, v=>model.start=v),
    fieldDate('Fin (opcional)', model.end||'', v=>model.end=v),
    el('div',{class:'hr'}),
    el('div',{class:'row spread'},[
      el('div',{class:'card__title', text:'Rotación'}),
      el('label',{class:'row'},[ rotToggle, el('span',{text:'Activada', style:'font-weight:900'}) ])
    ]),
    fieldDate('Fecha inicio patrón', model.rotation.startDate, v=>model.rotation.startDate=v),
    el('div',{class:'help', text:'Construye el patrón tocando los botones (sin comas ni escribir letras).'}),
    addRow,
    clearBtn,
    patBox
  ], [
    btn('Cancelar','ghost', closeModal),
    btn(isEdit?'Guardar':'Crear','primary', ()=>{
      if(!model.name.trim()) return toast('Pon un nombre');
      if(!parseISO(model.start)) return toast('Inicio inválido');
      if(model.end && !parseISO(model.end)) return toast('Fin inválido');
      model.rotation.pattern = pat.slice();
      if(model.rotation.enabled && !model.rotation.pattern.length) return toast('Patrón vacío');

      if(isEdit){
        const i = state.work.contracts.findIndex(c=>c.id===contract.id);
        if(i>=0) state.work.contracts[i]=model;
      }else{
        state.work.contracts.push(model);
      }
      saveState(); closeModal(); render(); toast('Listo');
    })
  ]);
}

function openWorkDayModal(iso){
  const existing = state.work.days?.[iso] ? {...state.work.days[iso]} : {};
  const autoShift = autoShiftForDate(iso);
  const autoS = autoShift ? shiftById(autoShift) : null;

  const model = {
    shiftId: existing.shiftId || (autoShift || ''),
    hours: existing.hours ?? (autoS?.hours ?? 0),
    extraHours: existing.extraHours ?? 0,
    extraRate: existing.extraRate ?? state.work.extraRate,
    watchHours: existing.watchHours ?? 0,
    watchRate: existing.watchRate ?? state.work.watchRate
  };

  openModal(`Día ${iso}`, [
    fieldSelect('Turno', model.shiftId, [{value:'',label:'(Auto)'}].concat(state.work.shifts.map(s=>({value:s.id,label:s.name}))), v=>{
      model.shiftId=v;
      const sh = shiftById(v);
      if(sh) model.hours = sh.hours;
    }),
    fieldNumber('Horas', model.hours, '0', v=>model.hours=Number(v||0), '0.25'),
    el('div',{class:'hr'}),
    fieldNumber('Horas extra', model.extraHours, '0', v=>model.extraHours=Number(v||0), '0.25'),
    fieldNumber('Tarifa extra €/h', model.extraRate, '0', v=>model.extraRate=Number(v||0), '0.01'),
    el('div',{class:'hr'}),
    fieldNumber('Horas velada', model.watchHours, '0', v=>model.watchHours=Number(v||0), '0.25'),
    fieldNumber('Tarifa velada €/h', model.watchRate, '0', v=>model.watchRate=Number(v||0), '0.01'),
    el('div',{class:'help', text:'(Auto) usa contrato/rotación. Si guardas aquí, sobrescribe solo este día.'})
  ], [
    btn('Borrar','bad', ()=>{
      if(confirm('¿Borrar cambios de este día?')){
        delete state.work.days[iso];
        saveState(); closeModal(); render();
      }
    }),
    btn('Cancelar','ghost', closeModal),
    btn('Guardar','primary', ()=>{
      state.work.days[iso] = {
        shiftId: model.shiftId || '',
        hours: Number(model.hours||0),
        extraHours: Number(model.extraHours||0),
        extraRate: Number(model.extraRate||0),
        watchHours: Number(model.watchHours||0),
        watchRate: Number(model.watchRate||0)
      };
      saveState(); closeModal(); render(); toast('Guardado');
    })
  ]);
}

/* Views */
function setTop(title){ $('#topTitle').textContent = title; }


function viewWelcome(){
  setTop('Bienvenido');
  const main = $('#main'); main.innerHTML='';
  const logo = el('div',{class:'welcomeLogo'},[
    el('span',{text:'▦', style:'font-size:34px; font-weight:950; color:var(--accent);'})
  ]);

  const card = el('div',{class:'welcomeCard'},[
    logo,
    el('div',{class:'welcomeTitle', text:'Tu gestor personal'}),
    el('div',{class:'welcomeSub', text:'Trabajo, economía y agenda en un solo sitio. Simple, limpio y rápido.'}),
    el('div',{class:'welcomeActions'},[
      btn('Empezar','primary', ()=>{
        localStorage.setItem(WELCOME_KEY, '1');
        go('home');
      }),
      btn('Resetear datos','bad', ()=>{
        if(confirm('¿Borrar TODOS los datos de la app?')){
          localStorage.removeItem(KEY);
          localStorage.removeItem(WELCOME_KEY);
          state = loadState();
          state.ui.workFocus = normalizeFocus(state.ui.workFocus);
          state.ui.agendaFocus = normalizeFocus(state.ui.agendaFocus);
          state.ui.economyFocus = normalizeFocus(state.ui.economyFocus);
          saveState();
          toast('Datos borrados');
        }
      })
    ])
  ]);

  main.appendChild(el('div',{class:'welcome'},[card]));
}


function viewHome(){
  setTop('Personal Manager');
  const main = $('#main'); main.innerHTML='';
  main.appendChild(el('div',{class:'card'},[
    el('div',{class:'card__body'},[
      el('div',{class:'grid3'},[
        el('div',{class:'tile', onClick:()=>go('work')},[
          el('div',{class:'tile__title',text:'Trabajo'}),
          el('div',{class:'tile__icon',text:'🗓'})
        ]),
        el('div',{class:'tile', onClick:()=>go('economy')},[
          el('div',{class:'tile__title',text:'Economía'}),
          el('div',{class:'tile__icon',text:'💳'})
        ]),
        el('div',{class:'tile', onClick:()=>go('agenda')},[
          el('div',{class:'tile__title',text:'Agenda'}),
          el('div',{class:'tile__icon',text:'📌'})
        ])
      ])
    ])
  ]));
}

function viewWork(){
  setTop('Trabajo');
  const main = $('#main'); main.innerHTML='';

  const focus = state.ui.workFocus = normalizeFocus(state.ui.workFocus);
  const totals = calcMonthTotals(focus.year, focus.month);
  const {monthSel, yearSel} = monthYearSelectors(focus, ()=>{
    state.ui.workFocus = normalizeFocus(focus);
    saveState(); render();
  });

  main.appendChild(el('div',{class:'card'},[
    el('div',{class:'card__body'},[
      el('div',{class:'kpis'},[
        el('div',{class:'kpi'},[ el('div',{class:'kpi__label',text:'Horas'}), el('div',{class:'kpi__value',text:totals.base.toFixed(2)}) ]),
        el('div',{class:'kpi'},[ el('div',{class:'kpi__label',text:'Extras'}), el('div',{class:'kpi__value',text:totals.extra.toFixed(2)}) ]),
        el('div',{class:'kpi'},[ el('div',{class:'kpi__label',text:'Veladas'}), el('div',{class:'kpi__value',text:totals.watch.toFixed(2)}) ]),
        el('div',{class:'kpi'},[ el('div',{class:'kpi__label',text:'Cash neto'}), el('div',{class:'kpi__value',text:totals.net.toFixed(2)+' €'}) ]),
      ]),
      el('div',{class:'hr'}),
      el('div',{class:'row spread'},[
        el('div',{class:'row'},[
          el('div',{},[el('div',{class:'label',text:'Mes'}), monthSel]),
          el('div',{},[el('div',{class:'label',text:'Año'}), yearSel]),
        ]),
        el('div',{class:'row'},[
          btn('Contratos','ghost', ()=>go('work_contracts')),
          btn('Ajustes','ghost', ()=>openWorkSettings())
        ])
      ])
    ])
  ]));

  const cal = renderCalendar(focus.year, focus.month, {
    onDayClick: (iso)=>openWorkDayModal(iso),
    getBadge: (iso, muted)=>{
      const shId = effectiveShiftId(iso);
      const sh = shId ? shiftById(shId) : null;
      if(!sh) return null;
      const b = el('div',{class:'dayBadge'});
      b.appendChild(el('span',{class:'dot', style:`background:${sh.color}`}));
      b.appendChild(el('span',{text:sh.name}));
      const entry = state.work.days?.[iso] || null;
      const h = Number(entry?.hours ?? sh.hours ?? 0);
      b.dataset.small = h ? `${h}h` : '';
      return b;
    }
  });

  main.appendChild(el('div',{class:'card'},[ el('div',{class:'card__body'},[ cal ]) ]));
}

function viewWorkContracts(){
  setTop('Contratos');
  const main = $('#main'); main.innerHTML='';

  const list = el('div',{class:'list'});
  (state.work.contracts||[]).sort((a,b)=>String(b.start).localeCompare(String(a.start))).forEach(c=>{
    const meta = `${c.start}${c.end?(' → '+c.end):''}`;
    list.appendChild(el('div',{class:'item'},[
      el('div',{class:'item__main'},[
        el('div',{class:'item__title',text:c.name}),
        el('div',{class:'item__meta',text:meta})
      ]),
      el('div',{class:'item__right'},[
        btn('Editar','ghost', ()=>openContractModal(c)),
        btn('Borrar','bad', ()=>{
          if(confirm('¿Borrar contrato?')){
            state.work.contracts = state.work.contracts.filter(x=>x.id!==c.id);
            saveState(); render();
          }
        })
      ])
    ]));
  });

  main.appendChild(el('div',{class:'card'},[
    el('div',{class:'card__body'},[
      el('div',{class:'row spread'},[
        el('div',{class:'card__title',text:'Contratos'}),
        btn('Nuevo','primary', ()=>openContractModal())
      ]),
      list.children.length ? list : el('div',{class:'help', text:'Crea un contrato para guardar rotaciones distintas por fecha.'})
    ])
  ]));
}

function viewEconomy(){
  setTop('Economía');
  const main = $('#main'); main.innerHTML='';
  main.appendChild(el('div',{class:'card'},[ el('div',{class:'card__body'},[
    el('div',{class:'card__title',text:'Economía'}),
    el('div',{class:'help',text:'En el siguiente paso metemos: cuentas, movimientos, fijos, créditos y metas.'})
  ])]));
}

function viewAgenda(){
  setTop('Agenda');
  const main = $('#main'); main.innerHTML='';
  main.appendChild(el('div',{class:'card'},[ el('div',{class:'card__body'},[
    el('div',{class:'card__title',text:'Agenda'}),
    el('div',{class:'help',text:'En el siguiente paso metemos calendario con eventos.'})
  ])]));
}

/* Render */
function render(){
  const r = getRoute();

  $('#btnBack').style.visibility = (r==='home' || r==='welcome') ? 'hidden' : 'visible';
  $('#btnAdd').style.visibility = (r==='work_contracts') ? 'visible' : 'hidden';

  if(r==='welcome') return viewWelcome();
  if(r==='home') return viewHome();
  if(r==='work') return viewWork();
  if(r==='work_contracts') return viewWorkContracts();
  if(r==='economy') return viewEconomy();
  if(r==='agenda') return viewAgenda();

  return go('home');
}

/* Init */
function bind(){
  $('#btnBack').addEventListener('click', ()=>history.length>1 ? history.back() : go('home'));
  $('#btnSettings').addEventListener('click', ()=>{
    openModal('Ajustes', [
      el('div',{class:'help', text:'Si algo se queda raro, aquí puedes resetear datos.'}),
      btn('Resetear datos','bad', ()=>{
        if(confirm('¿Borrar TODOS los datos de la app?')){
          localStorage.removeItem(KEY);
          state = loadState();
          state.ui.workFocus = normalizeFocus(state.ui.workFocus);
          state.ui.agendaFocus = normalizeFocus(state.ui.agendaFocus);
          state.ui.economyFocus = normalizeFocus(state.ui.economyFocus);
          saveState();
          closeModal();
          render();
          toast('Datos borrados');
        }
      })
    ], [btn('Cerrar','primary', closeModal)]);
  });
  $('#btnAdd').addEventListener('click', ()=>{
    const r = getRoute();
    if(r==='work_contracts') openContractModal();
  });
  $('#modalClose').addEventListener('click', closeModal);
  $('#overlay').addEventListener('click', (e)=>{ if(e.target===$('#overlay')) closeModal(); });
  window.addEventListener('hashchange', render);
}

document.addEventListener('DOMContentLoaded', ()=>{
  bind();
  const seen = localStorage.getItem(WELCOME_KEY)==='1';
  if(!location.hash){
    go(seen ? 'home' : 'welcome');
  } else {
    // si aún no vio la bienvenida, forzamos welcome salvo que esté en welcome ya
    const r = getRoute();
    if(!seen && r!=='welcome') go('welcome');
    else render();
  }
});
