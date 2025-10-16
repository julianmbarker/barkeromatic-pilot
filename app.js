/* RiSE Systems: Barker-o-matic™ — app.js  (v0.8.1 full) */

/* -------------------------------
   Boot banner + safe DOM helpers
---------------------------------*/
(function(){
  const boot = document.getElementById('boot');
  if (boot) {
    const t = new Date();
    const hh = String(t.getHours()).padStart(2,'0');
    const mm = String(t.getMinutes()).padStart(2,'0');
    const ss = String(t.getSeconds()).padStart(2,'0');
    boot.textContent = `JS OK @ ${hh}:${mm}:${ss}`;
    const bar = document.getElementById('bootbar');
    if (bar){ bar.classList.add('show'); bar.innerHTML = `Boot: all systems go ✅ @ ${hh}:${mm}:${ss}`; }
  }
})();

const qs  = (sel, root=document)=>root.querySelector(sel);
const qsa = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
const ce  = (tag, props={})=>Object.assign(document.createElement(tag), props);

/* -------------------------------
   State + persistence + history
---------------------------------*/
const KEY = 'rise-barkeromatic-v081';

const def = {
  cycleWeeks: 8,
  rotaTitle: '',
  consultants: [],        // [{id,name,initials,color}]
  areas: [],              // [{id,type:'DCC'|'NonDCC',name,session?,pa,color}]
  alloc: {},              // { [week]: { [areaId]: {Mon:'JMB'|'ECL'|'' , Tue:... } } }
  currentWeek: 1,
  monFriOnly: false,

  // Jobplans UI memory
  _jpSelectId: '',
  _jpShowWeekends: false
};

let state = load();
let undoStack = [];
let redoStack = [];

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(def));
  }catch(e){
    return JSON.parse(JSON.stringify(def));
  }
}
function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
}
function saved(){
  save();
  const b = qs('#savedBadge');
  if(b){ b.style.opacity = 1; setTimeout(()=>{ b.style.opacity = .6; }, 350); }
}
function pushHistory(){
  undoStack.push(JSON.stringify(state));
  if(undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
}
function undo(){
  if(!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop());
  save(); renderAll(); toast('Undone');
}
function redo(){
  if(!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop());
  save(); renderAll(); toast('Redone');
}
function toast(msg){
  const t = qs('#toast'); if(!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1400);
}

qs('#undoBtn')?.addEventListener('click', undo);
qs('#redoBtn')?.addEventListener('click', redo);

/* -------------------------------
   Tabs (header buttons)
---------------------------------*/
qsa('nav.tabs .tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    qsa('nav.tabs .tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    qsa('main > section').forEach(sec=>sec.style.display = sec.id===tab ? '' : 'none');
    // ensure jobplans redraw when switching to it
    if(tab==='jobs' || tab==='jobplans') renderJobplans();
    if(tab==='week') renderWeekTables();
  });
});

/* -------------------------------
   Setup: Rota title + cycle + wiring
---------------------------------*/
function bindSetup(){
  const title = qs('#rotaTitle');
  const weeks = qs('#weeks');

  if(title){
    title.value = state.rotaTitle || '';
    title.oninput = ()=>{ pushHistory(); state.rotaTitle = title.value; saved(); renderTitle(); };
  }

  if(weeks){
    weeks.innerHTML = '';
    for(let n=1;n<=15;n++){
      const opt = ce('option',{value:String(n),textContent:String(n)});
      weeks.appendChild(opt);
    }
    weeks.value = String(state.cycleWeeks || 8);
    weeks.onchange = ()=>{
      pushHistory();
      state.cycleWeeks = Number(weeks.value)||8;
      if(state.currentWeek>state.cycleWeeks) state.currentWeek = 1;
      saved(); renderWeekTabs(); renderWeekTables(); renderJobplans();
    };
  }

  // Export/Import at top bar
  qs('#exportTop')?.addEventListener('click', exportAllJSON);
  qs('#importTop')?.addEventListener('change', importAllJSON);
}

function renderTitle(){
  const t = qs('#titleLoz'); if(!t) return;
  t.textContent = state.rotaTitle || '';
}

/* -------------------------------
   Consultants table
---------------------------------*/
function ensureId(prefix='id'){
  return prefix + '_' + Math.random().toString(36).slice(2,9);
}
function renderConsultants(){
  const tbody = qs('#ctable tbody'); if(!tbody) return;
  const list = state.consultants || [];
  tbody.innerHTML = '';
  list.forEach((c,idx)=>{
    if(!c.id) c.id = c.code || c.initials || ensureId('c');
    const tr = ce('tr');
    const td0 = ce('td',{textContent: String(idx+1), className:'drag'}); tr.appendChild(td0);

    const name = ce('input',{value:c.name||'',placeholder:'Full name'});
    name.oninput = ()=>{ pushHistory(); c.name=name.value; saved(); renderJobplans(); };
    const td1 = ce('td'); td1.appendChild(name); tr.appendChild(td1);

    const init = ce('input',{value:c.initials||'',placeholder:'ABC',maxLength:5});
    init.oninput = ()=>{ pushHistory(); c.initials=init.value; saved(); renderWeekTables(); renderJobplans(); };
    const td2 = ce('td'); td2.appendChild(init); tr.appendChild(td2);

    const col = ce('input',{type:'color', value: c.color || '#9CA3AF'});
    col.oninput = ()=>{ pushHistory(); c.color=col.value; saved(); renderWeekTables(); renderJobplans(); };
    const td3 = ce('td'); td3.appendChild(col); tr.appendChild(td3);

    const del = ce('button',{textContent:'Delete',className:'btn ghost'});
    del.onclick = ()=>{ pushHistory(); state.consultants.splice(idx,1); saved(); renderConsultants(); renderWeekTables(); renderJobplans(); };
    const td4 = ce('td'); td4.appendChild(del); tr.appendChild(td4);

    tbody.appendChild(tr);
  });

  qs('#ccount')?.replaceChildren(ce('span',{textContent:`(${list.length})`}));

  qs('#addConsultant')?.addEventListener('click', ()=>{
    pushHistory();
    (state.consultants ||= []).push({ id:ensureId('c'), name:'', initials:'', color:'#9CA3AF' });
    saved(); renderConsultants();
  }, { once:true }); // re-bound every render
}

/* -------------------------------
   Areas tables (DCC & Non-DCC)
---------------------------------*/
function renderAreas(){
  renderAreaTable('DCC', qs('#dcct tbody'), true);
  renderAreaTable('NonDCC', qs('#ndcct tbody'), false);
}

function renderAreaTable(kind, tbody, isDCC){
  if(!tbody) return;
  const list = (state.areas || []).filter(a=>a.type===kind);
  tbody.innerHTML = '';
  list.forEach((a, idx)=>{
    if(!a.id) a.id = ensureId(isDCC?'d':'n');
    const tr = ce('tr');

    tr.appendChild(ce('td',{textContent:String(idx+1), className:'drag'}));

    const nm = ce('input',{value:a.name||'', placeholder:isDCC?'Cardiac Theatre 1':'Teaching'});
    nm.oninput = ()=>{ pushHistory(); a.name=nm.value; saved(); renderWeekTables(); renderJobplans(); };
    const td1 = ce('td'); td1.appendChild(nm); tr.appendChild(td1);

    if(isDCC){
      const sess = ce('select');
      ['am','pm','eve'].forEach(s=>sess.appendChild(ce('option',{value:s,textContent:s})));
      sess.value = a.session || 'am';
      sess.onchange = ()=>{ pushHistory(); a.session=sess.value; saved(); };
      const tdS = ce('td'); tdS.appendChild(sess); tr.appendChild(tdS);
    }

    const pa = ce('input',{type:'number', step:'0.25', value: a.pa ?? (isDCC?1.0:0.5)});
    pa.oninput = ()=>{ pushHistory(); a.pa = Number(pa.value)||0; saved(); };
    const tdP = ce('td'); tdP.appendChild(pa); tr.appendChild(tdP);

    const col = ce('input',{type:'color', value: a.color || '#E5E7EB'});
    col.oninput = ()=>{ pushHistory(); a.color = col.value; saved(); renderWeekTables(); renderJobplans(); };
    const tdC = ce('td'); tdC.appendChild(col); tr.appendChild(tdC);

    const del = ce('button',{textContent:'Delete',className:'btn ghost'});
    del.onclick = ()=>{ pushHistory(); 
      const i = state.areas.findIndex(x=>x.id===a.id); if(i>-1) state.areas.splice(i,1);
      saved(); renderAreas(); renderWeekTables(); renderJobplans();
    };
    const tdD = ce('td'); tdD.appendChild(del); tr.appendChild(tdD);

    tbody.appendChild(tr);
  });

  // Add button bindings (re-bind every render)
  const addBtn = isDCC ? qs('#addDCC') : qs('#addNonDCC');
  if(addBtn){
    addBtn.addEventListener('click', ()=>{
      pushHistory();
      (state.areas ||= []).push({
        id: ensureId(isDCC?'d':'n'),
        type: kind,
        name: isDCC ? 'Cardiac Theatre' : 'Teaching',
        session: isDCC ? 'am' : undefined,
        pa: isDCC ? 1.0 : 0.5,
        color: isDCC ? '#FFE58A' : '#E5E7EB'
      });
      saved(); renderAreas(); renderWeekTables(); renderJobplans();
    }, { once:true });
  }
}

/* -------------------------------
   Week tabs + toggle
---------------------------------*/
function renderWeekTabs(){
  const sec = qs('#week');
  if(!sec) return;
  const bar = sec.querySelector('.rota-sticky .weektabs') || qs('#weekTabs');
  const bar2 = sec.querySelector('.hstack .weektabs');
  const weeks = Number(state.cycleWeeks||8);
  const build = (wrap)=>{
    if(!wrap) return;
    wrap.innerHTML='';
    for(let w=1; w<=weeks; w++){
      const b = ce('button',{textContent:`week ${w}`});
      b.className = 'tab' + (w===Number(state.currentWeek||1)?' active':'');
      b.onclick = ()=>{ pushHistory(); state.currentWeek = w; saved(); renderWeekTabs(); renderWeekTables(); };
      wrap.appendChild(b);
    }
  };
  build(bar); build(bar2);

  const mf = qsa('#mfOnly', sec)[0] || qs('#mfOnly');
  if(mf){
    mf.checked = !!state.monFriOnly;
    mf.onchange = ()=>{ pushHistory(); state.monFriOnly = !!mf.checked; saved(); renderWeekTables(); };
  }
}

/* -------------------------------
   Rota tables (DCC / Non-DCC)
---------------------------------*/
function dayKeys(){
  return state.monFriOnly ? ['Mon','Tue','Wed','Thu','Fri'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
}
function buildRotaTable(isDCC){
  const tbl = ce('table',{className:'grid'});
  const thead = ce('thead'); const trh = ce('tr');
  trh.appendChild(ce('th',{textContent:'Area'}));
  dayKeys().forEach(d=>trh.appendChild(ce('th',{textContent:d})));
  thead.appendChild(trh); tbl.appendChild(thead);

  const tb = ce('tbody');
  const areas = (state.areas||[]).filter(a=>isDCC ? a.type==='DCC' : a.type==='NonDCC');

  const week = String(state.currentWeek||1);
  state.alloc[week] ||= {};

  areas.forEach(a=>{
    const tr = ce('tr');
    const chip = ce('span',{className:'areachip', textContent: a.name || (isDCC?'DCC':'Non-DCC')});
    chip.style.background = a.color || '#eee';
    chip.style.color = '#111';
    const td0 = ce('td'); td0.appendChild(chip); tr.appendChild(td0);

    dayKeys().forEach(d=>{
      const td = ce('td',{className:'rota-cell'});
      const pillwrap = ce('div',{className:'pillwrap'});
      const pill = ce('span',{className:'pill'});
      const dot = ce('span',{className:'dot'});
      const txt = ce('span',{className:'txt'});
      const init = ce('span',{className:'init'});
      const sep  = ce('span',{className:'sep', textContent:'—'});
      const name = ce('span',{className:'name'});
      txt.appendChild(init); txt.appendChild(sep); txt.appendChild(name);
      pill.appendChild(dot); pill.appendChild(txt); pillwrap.appendChild(pill); td.appendChild(pillwrap);

      const sel = ce('select');
      sel.appendChild(ce('option',{value:'',textContent:'— blank —'}));
      sel.appendChild(ce('option',{value:'ECL',textContent:'ECL'}));
      (state.consultants||[]).forEach(c=>{
        sel.appendChild(ce('option',{value: c.id || c.initials || c.code || c.name, textContent: `${c.initials||''}${c.initials?' — ':''}${c.name||''}`}));
      });

      const wkAlloc = state.alloc[week][a.id] ||= {};
      const val = wkAlloc[d] || '';
      sel.value = val;

      function paint(value){
        if(!value){
          dot.style.background = '#ddd';
          init.textContent=''; name.textContent=''; sep.style.display='none';
          pill.style.opacity=.6;
          return;
        }
        sep.style.display='';
        if(value==='ECL'){
          dot.style.background = '#d11';
          init.textContent='ECL'; name.textContent='Unfilled session';
          pill.style.opacity=1;
          return;
        }
        const c = (state.consultants||[]).find(x=>(x.id||x.initials||x.code||x.name)===value);
        if(c){
          dot.style.background = c.color || '#888';
          init.textContent = c.initials || '';
          name.textContent = c.name || '';
          pill.style.opacity=1;
        }else{
          dot.style.background = '#ddd';
          init.textContent='?'; name.textContent=value; pill.style.opacity=1;
        }
      }
      paint(val);

      sel.onchange = ()=>{
        pushHistory();
        const v = sel.value;
        state.alloc[week][a.id][d] = v;
        saved(); paint(v);
      };
      td.appendChild(sel);
      tr.appendChild(td);
    });

    tb.appendChild(tr);
  });

  tbl.appendChild(tb);
  return tbl;
}

function renderWeekTables(){
  const sec = qs('#week'); if(!sec) return;
  const dWrap = qs('#wD'); const nWrap = qs('#wN');
  if(dWrap){ dWrap.replaceWith((()=>{ const host = ce('table',{className:'grid', id:'wD'}); const t = buildRotaTable(true); host.innerHTML = t.innerHTML; return host; })()); }
  if(nWrap){ nWrap.replaceWith((()=>{ const host = ce('table',{className:'grid', id:'wN'}); const t = buildRotaTable(false); host.innerHTML = t.innerHTML; return host; })()); }
}

/* -------------------------------
   Data: Export / Import
---------------------------------*/
function download(filename, text){
  const a = ce('a',{href:'data:text/plain;charset=utf-8,'+encodeURIComponent(text), download:filename});
  document.body.appendChild(a); a.click(); a.remove();
}

function exportAllJSON(){
  const dump = JSON.stringify(state, null, 2);
  download('barkeromatic-export.json', dump);
}

function importAllJSON(e){
  const f = e.target.files?.[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      pushHistory();
      state = JSON.parse(String(r.result));
      save(); renderAll(); toast('Imported ALL (JSON)');
    }catch(err){ alert('Import failed: '+err.message); }
  };
  r.readAsText(f);
  e.target.value='';
}

qs('#exportAll')?.addEventListener('click', exportAllJSON);
qs('#importAll')?.addEventListener('change', importAllJSON);
qs('#resetApp')?.addEventListener('click', ()=>{
  if(confirm('Reset app to defaults?')){ pushHistory(); state = JSON.parse(JSON.stringify(def)); save(); renderAll(); }
});

/* Consultants CSV / JSON */
qs('#exportConsultantsCSV')?.addEventListener('click', ()=>{
  const rows = [['name','initials','color']];
  (state.consultants||[]).forEach(c=>rows.push([c.name||'', c.initials||'', c.color||'']));
  const csv = rows.map(r=>r.map(s=>`"${String(s).replace(/"/g,'""')}"`).join(',')).join('\n');
  download('consultants.csv', csv);
});
qs('#exportConsultantsJSON')?.addEventListener('click', ()=>{
  download('consultants.json', JSON.stringify(state.consultants||[], null, 2));
});
qs('#importConsultantsCSV')?.addEventListener('change', (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      pushHistory();
      const lines = String(r.result).trim().split(/\r?\n/);
      const hdr = lines.shift()?.split(',').map(s=>s.replace(/^"|"$/g,'').trim().toLowerCase())||[];
      const nameIdx = hdr.indexOf('name'), initIdx = hdr.indexOf('initials'), colIdx = hdr.indexOf('color');
      const out = [];
      for(const line of lines){
        const parts = line.match(/("([^"]|"")*"|[^,]+)/g)||[];
        const val = s=>String(s||'').replace(/^"|"$/g,'').replace(/""/g,'"');
        out.push({
          id: ensureId('c'),
          name: val(parts[nameIdx]),
          initials: val(parts[initIdx]),
          color: val(parts[colIdx]||'#9CA3AF')
        });
      }
      state.consultants = out; saved(); renderConsultants(); renderWeekTables(); renderJobplans();
      toast('Consultants CSV imported');
    }catch(err){ alert('Import failed: '+err.message); }
  };
  r.readAsText(f); e.target.value='';
});
qs('#importConsultantsJSON')?.addEventListener('change', (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      pushHistory();
      const arr = JSON.parse(String(r.result));
      (arr||[]).forEach(c=>{ if(!c.id) c.id = c.initials || ensureId('c'); });
      state.consultants = arr; saved(); renderConsultants(); renderWeekTables(); renderJobplans();
      toast('Consultants JSON imported');
    }catch(err){ alert('Import failed: '+err.message); }
  };
  r.readAsText(f); e.target.value='';
});

/* Rota CSV (simple) */
qs('#exportCSV')?.addEventListener('click', ()=>{
  const weeks = Number(state.cycleWeeks||8);
  const daysAll = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const rows = [['week','type','area','day','value']];
  for(let w=1; w<=weeks; w++){
    const map = state.alloc[String(w)]||{};
    (state.areas||[]).forEach(a=>{
      const days = state.monFriOnly ? daysAll.slice(0,5) : daysAll;
      days.forEach(d=>{
        const v = map[a.id]?.[d] || '';
        rows.push([w, a.type, a.name, d, v]);
      });
    });
  }
  const csv = rows.map(r=>r.map(s=>`"${String(s).replace(/"/g,'""')}"`).join(',')).join('\n');
  download('rota.csv', csv);
});

/* -------------------------------
   Jobplans (MVP – header + controls)
---------------------------------*/
function renderJobplans(){
  // Accept either #jobs (your current tab) or #jobplans (older duplicate)
  const host = qs('#jobs') || qs('#jobplans'); if(!host) return;

  const sel = qs('#jpConsultantSelect', host);
  const weekend = qs('#jpWeekends', host);
  const wkTabs = qs('#jpWeekTabs', host);
  const title = qs('#jpTitle', host);

  if(!sel || !weekend || !wkTabs || !title) return;

  // Build dropdown
  const list = (state.consultants||[]).map((c,i)=>({
    id: c.id || c.initials || `c${i}`,
    name: c.name||'',
    initials: c.initials||'',
    color: c.color||'#888'
  }));
  sel.innerHTML = '';
  list.forEach(c=>{
    sel.appendChild(ce('option',{value:c.id, textContent: `${c.initials?c.initials+' — ':''}${c.name}`}));
  });

  // Remembered selection
  if(!state._jpSelectId && list[0]) state._jpSelectId = list[0].id;
  if(state._jpSelectId && list.find(x=>x.id===state._jpSelectId)) sel.value = state._jpSelectId;
  sel.onchange = ()=>{ pushHistory(); state._jpSelectId = sel.value; saved(); renderJobplans(); };

  // Weekends
  weekend.checked = !!state._jpShowWeekends;
  weekend.onchange = ()=>{ pushHistory(); state._jpShowWeekends = !!weekend.checked; saved(); renderJobplans(); };

  // Title
  const c = list.find(x=>x.id===state._jpSelectId);
  title.innerHTML = c ? `
    <span class="pill">
      <span class="dot" style="background:${c.color}"></span>
      <span class="txt">
        <span class="init">${c.initials}</span>
        <span class="sep">—</span>
        <span class="name">Jobplan for ${c.name}</span>
      </span>
    </span>` : '';

  // Week tabs mirror rota
  const weeks = Number(state.cycleWeeks||8);
  wkTabs.innerHTML = '';
  for(let w=1; w<=weeks; w++){
    const b = ce('button',{textContent:`week ${w}`});
    b.className = 'tab' + (w===Number(state.currentWeek||1)?' active':'');
    b.onclick = ()=>{ pushHistory(); state.currentWeek = w; saved(); renderJobplans(); };
    wkTabs.appendChild(b);
  }

  // Placeholders for the two tables (we’ll populate with real data in next step)
  qs('#jpWD')?.replaceChildren(); qs('#jpWN')?.replaceChildren();
}

/* -------------------------------
   Initial boot render
---------------------------------*/
function renderAll(){
  bindSetup();
  renderConsultants();
  renderAreas();
  renderWeekTabs();
  renderWeekTables();
  renderTitle();
  renderJobplans();
}

// kick off
renderAll();
