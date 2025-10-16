/* RiSE Systems: Barker-o-matic™ — app.js (v0.8.1 full)
   - Setup (consultants, DCC/Non-DCC with suggestions + reorder)
   - Rota (allocations with pills; Mon–Fri toggle; week tabs; sticky)
   - Jobplans viewer (consultant dropdown, weekends, week tabs, tables)
   - Import/Export (ALL JSON, Rota CSV, Consultants CSV/JSON)
   - Undo/Redo, localStorage; Boot banner
*/

(function(){
  "use strict";

  // Boot banner
  const boot = document.getElementById('boot');
  const t = new Date();
  const hh = String(t.getHours()).padStart(2,'0');
  const mm = String(t.getMinutes()).padStart(2,'0');
  const ss = String(t.getSeconds()).padStart(2,'0');
  if(boot){ boot.textContent = `JS OK @ ${hh}:${mm}:${ss}`; }
  const bootbar = document.getElementById('bootbar');
  if(bootbar){ bootbar.classList.add('show'); bootbar.textContent = `Boot: all systems go ✅ @ ${hh}:${mm}:${ss}`; }

  // Utilities
  const qs  = (s, r=document)=>r.querySelector(s);
  const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const ce  = (tag, props={})=>Object.assign(document.createElement(tag), props);
  const csvEscape = s => `"${String(s??'').replace(/"/g,'""')}"`;

  // State
  const KEY = 'rise-barkeromatic-v081';
  const def = {
    cycleWeeks: 8,
    rotaTitle: '',
    consultants: [],        // [{id,name,initials,color}]
    areas: [],              // [{id,type:'DCC'|'NonDCC',name,session?,pa,color}]
    alloc: {},              // { [week]: { [areaId]: {Mon:'JMB'|'ECL'|'' , Tue:... } } }
    currentWeek: 1,
    monFriOnly: false,
    // Jobplans UI
    _jpSelectId: '',
    _jpShowWeekends: false
  };
  let state = load();
  const undoStack = [];
  const redoStack = [];

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(def));
    }catch(e){ return JSON.parse(JSON.stringify(def)); }
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function saved(){ save(); const b=qs('#savedBadge'); if(b){ b.style.opacity=1; setTimeout(()=>b.style.opacity=.6, 350);} }
  function pushHistory(){ undoStack.push(JSON.stringify(state)); if(undoStack.length>200) undoStack.shift(); redoStack.length=0; }

  function toast(msg){ const t=qs('#toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1400); }
  function ensureId(prefix='id'){ return prefix+'_'+Math.random().toString(36).slice(2,9); }
  function dayKeys(){ return state.monFriOnly ? ['Mon','Tue','Wed','Thu','Fri'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; }
  function consultantKey(c){ return c.id || c.initials || c.name || ''; }

  // Tabs
  qsa('nav.tabs .tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      qsa('nav.tabs .tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab=btn.dataset.tab;
      qsa('main > section').forEach(sec=>sec.style.display = (sec.id===tab) ? '' : 'none');
      if(tab==='week'){ renderWeekTabs(); renderWeekTables(); renderTitle(); }
      if(tab==='jobplans'){ renderJobplans(); }
    });
  });

  // Undo/Redo
  qs('#undoBtn')?.addEventListener('click', ()=>{
    if(!undoStack.length) return;
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(undoStack.pop());
    save(); renderAll(); toast('Undone');
  });
  qs('#redoBtn')?.addEventListener('click', ()=>{
    if(!redoStack.length) return;
    undoStack.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    save(); renderAll(); toast('Redone');
  });

  // -------- Setup bindings
  function bindSetup(){
    const title = qs('#rotaTitle');
    const weeks = qs('#weeks');
    if(title){
      title.value = state.rotaTitle || '';
      title.oninput = ()=>{ pushHistory(); state.rotaTitle = title.value; saved(); renderTitle(); };
    }
    if(weeks){
      weeks.innerHTML=''; for(let i=1;i<=15;i++) weeks.appendChild(ce('option',{value:String(i),textContent:String(i)}));
      weeks.value = String(state.cycleWeeks||8);
      weeks.onchange = ()=>{ pushHistory(); state.cycleWeeks=Number(weeks.value)||8; if(state.currentWeek>state.cycleWeeks) state.currentWeek=1; saved(); renderWeekTabs(); renderWeekTables(); renderJobplans(); };
    }
    qs('#exportTop')?.addEventListener('click', exportAllJSON);
    qs('#importTop')?.addEventListener('change', importAllJSON);
  }

  // -------- Consultants table
  function renderConsultants(){
    const tbody = qs('#ctable tbody'); if(!tbody) return;
    tbody.innerHTML = '';
    (state.consultants||[]).forEach((c, idx)=>{
      if(!c.id) c.id = consultantKey(c) || ensureId('c');

      const tr = ce('tr');

      // # with six-dot look + Up/Down
      const td0 = ce('td',{className:'dragcell'});
      const dots = ce('span',{className:'dragdots',textContent:'••••••'});
      const up = ce('button',{className:'btn ghost',textContent:'↑',style:'padding:2px 8px;height:28px'});
      const dn = ce('button',{className:'btn ghost',textContent:'↓',style:'padding:2px 8px;height:28px;margin-left:4px'});
      up.onclick = ()=>{ if(idx>0){ pushHistory(); const [x]=state.consultants.splice(idx,1); state.consultants.splice(idx-1,0,x); saved(); renderConsultants(); renderWeekTables(); renderJobplans(); } };
      dn.onclick = ()=>{ if(idx<state.consultants.length-1){ pushHistory(); const [x]=state.consultants.splice(idx,1); state.consultants.splice(idx+1,0,x); saved(); renderConsultants(); renderWeekTables(); renderJobplans(); } };
      td0.append(dots, up, dn); tr.appendChild(td0);

      // Name
      const td1 = ce('td'); const inpN = ce('input',{value:c.name||'',placeholder:'Full name'});
      inpN.oninput = ()=>{ pushHistory(); c.name = inpN.value; saved(); renderWeekTables(); renderJobplans(); };
      td1.appendChild(inpN); tr.appendChild(td1);

      // Initials
      const td2 = ce('td'); const inpI = ce('input',{value:c.initials||'',placeholder:'ABC',maxLength:5});
      inpI.oninput = ()=>{ pushHistory(); c.initials = inpI.value; saved(); renderWeekTables(); renderJobplans(); };
      td2.appendChild(inpI); tr.appendChild(td2);

      // Colour
      const td3 = ce('td'); const inpC = ce('input',{type:'color',value:c.color||'#9CA3AF'});
      inpC.oninput = ()=>{ pushHistory(); c.color = inpC.value; saved(); renderWeekTables(); renderJobplans(); };
      td3.appendChild(inpC); tr.appendChild(td3);

      // Delete
      const td4 = ce('td'); const del = ce('button',{className:'btn ghost',textContent:'Delete'});
      del.onclick = ()=>{ pushHistory(); state.consultants.splice(idx,1); saved(); renderConsultants(); renderWeekTables(); renderJobplans(); };
      td4.appendChild(del); tr.appendChild(td4);

      tbody.appendChild(tr);
    });

    qs('#ccount')?.replaceChildren(ce('span',{textContent:`(${state.consultants?.length||0})`}));

    const add = qs('#addConsultant');
    if(add){ add.onclick = ()=>{ pushHistory(); (state.consultants ||= []).push({id:ensureId('c'),name:'',initials:'',color:'#9CA3AF'}); saved(); renderConsultants(); }; }
  }

  // -------- Areas tables (with suggestions + reorder)
  function buildNameDatalists(){
    const dccDL = qs('#dccNames'); const ndcDL = qs('#ndccNames');
    if(!dccDL || !ndcDL) return;
    const dnames = new Set(), ndnames = new Set();
    (state.areas||[]).forEach(a=>{ if(a.type==='DCC' && a.name) dnames.add(a.name); if(a.type!=='DCC' && a.name) ndnames.add(a.name); });
    dccDL.innerHTML=''; ndcDL.innerHTML='';
    dnames.forEach(n=>dccDL.appendChild(ce('option',{value:n})));
    ndnames.forEach(n=>ndcDL.appendChild(ce('option',{value:n})));
  }

  function renderAreas(){
    renderAreaTable('DCC', qs('#dcct tbody'), true);
    renderAreaTable('NonDCC', qs('#ndcct tbody'), false);
    buildNameDatalists();
  }

  function renderAreaTable(kind, tbody, isDCC){
    if(!tbody) return;
    const list = (state.areas||[]).filter(a=>a.type===kind);
    tbody.innerHTML='';
    list.forEach((a, idx)=>{
      if(!a.id) a.id = ensureId(isDCC?'d':'n');
      const tr = ce('tr');

      // # + Up/Down
      const td0 = ce('td',{className:'dragcell'});
      const dots = ce('span',{className:'dragdots',textContent:'••••••'});
      const up = ce('button',{className:'btn ghost',textContent:'↑',style:'padding:2px 8px;height:28px'});
      const dn = ce('button',{className:'btn ghost',textContent:'↓',style:'padding:2px 8px;height:28px;margin-left:4px'});
      up.onclick = ()=>{ const arr=(state.areas||[]).filter(x=>x.type===kind); const all=state.areas;
        const globalIdx = all.findIndex(x=>x===list[idx]); if(globalIdx<=0) return;
        pushHistory();
        // find prev SAME kind to swap with
        for(let j=globalIdx-1;j>=0;j--){
          if(all[j].type===kind){ const tmp=all[globalIdx]; all[globalIdx]=all[j]; all[j]=tmp; break; }
        }
        saved(); renderAreas(); renderWeekTables(); renderJobplans();
      };
      dn.onclick = ()=>{ const all=state.areas; const globalIdx = all.findIndex(x=>x===list[idx]); if(globalIdx<0) return;
        pushHistory();
        for(let j=globalIdx+1;j<all.length;j++){
          if(all[j].type===kind){ const tmp=all[globalIdx]; all[globalIdx]=all[j]; all[j]=tmp; break; }
        }
        saved(); renderAreas(); renderWeekTables(); renderJobplans();
      };
      td0.append(dots, up, dn); tr.appendChild(td0);

      // Name (with suggestions)
      const td1 = ce('td');
      const inpN = ce('input',{value:a.name||'', placeholder:isDCC?'Cardiac Theatre 1':'Teaching'});
      inpN.setAttribute('list', isDCC ? 'dccNames' : 'ndccNames');
      inpN.oninput = ()=>{ pushHistory(); a.name = inpN.value; saved(); buildNameDatalists(); renderWeekTables(); renderJobplans(); };
      td1.appendChild(inpN); tr.appendChild(td1);

      if(isDCC){
        // Session
        const tdS = ce('td'); const sel = ce('select');
        ['am','pm','eve'].forEach(s=>sel.appendChild(ce('option',{value:s,textContent:s})));
        sel.value = a.session || 'am';
        sel.onchange = ()=>{ pushHistory(); a.session = sel.value; saved(); };
        tdS.appendChild(sel); tr.appendChild(tdS);
      }

      // PA
      const tdP = ce('td'); const num = ce('input',{type:'number',step:'0.25',value: a.pa ?? (isDCC?1.0:0.5)});
      num.oninput = ()=>{ pushHistory(); a.pa = Number(num.value)||0; saved(); };
      tdP.appendChild(num); tr.appendChild(tdP);

      // Colour
      const tdC = ce('td'); const col = ce('input',{type:'color',value:a.color||'#E5E7EB'});
      col.oninput = ()=>{ pushHistory(); a.color=col.value; saved(); renderWeekTables(); renderJobplans(); };
      tdC.appendChild(col); tr.appendChild(tdC);

      // Delete
      const tdD = ce('td'); const del = ce('button',{className:'btn ghost',textContent:'Delete'});
      del.onclick = ()=>{ pushHistory(); state.areas = (state.areas||[]).filter(x=>x.id!==a.id);
        // clear any allocations for this area
        Object.keys(state.alloc||{}).forEach(w=>{ if(state.alloc[w]?.[a.id]) delete state.alloc[w][a.id]; });
        saved(); renderAreas(); renderWeekTables(); renderJobplans();
      };
      tdD.appendChild(del); tr.appendChild(tdD);

      tbody.appendChild(tr);
    });

    // Add buttons
    const addBtn = isDCC ? qs('#addDCC') : qs('#addNonDCC');
    if(addBtn){
      addBtn.onclick = ()=>{
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
      };
    }
  }

  // -------- Week tabs + title + Mon–Fri
  function renderWeekTabs(){
    const wrap = qs('#weekTabs'); if(!wrap) return;
    wrap.innerHTML = '';
    const max = Number(state.cycleWeeks||8);
    for(let w=1; w<=max; w++){
      const b = ce('button',{textContent:`week ${w}`});
      if(w===Number(state.currentWeek||1)) b.classList.add('active');
      b.onclick = ()=>{ pushHistory(); state.currentWeek = w; saved(); renderWeekTabs(); renderWeekTables(); renderJobplans(); };
      wrap.appendChild(b);
    }
    const mf = qs('#mfOnly');
    if(mf){ mf.checked = !!state.monFriOnly; mf.onchange = ()=>{ pushHistory(); state.monFriOnly = !!mf.checked; saved(); renderWeekTables(); renderJobplans(); }; }
  }
  function renderTitle(){
    const t = qs('#titleLoz'); if(!t) return;
    const title = state.rotaTitle || 'Rota';
    t.textContent = `${title} — week ${state.currentWeek}`;
  }

  // -------- Rota tables (editable)
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
      const chip = ce('span',{className:'areachip', textContent:a.name|| (isDCC?'DCC':'Non-DCC')});
      chip.style.background = a.color || '#eee'; chip.style.color = '#111';
      const td0 = ce('td'); td0.appendChild(chip); tr.appendChild(td0);

      dayKeys().forEach(d=>{
        const td = ce('td',{className:'rota-cell'});

        // Select
        const sel = ce('select');
        sel.appendChild(ce('option',{value:'',textContent:'— blank —'}));
        sel.appendChild(ce('option',{value:'ECL',textContent:'ECL'}));
        (state.consultants||[]).forEach(c=>{
          const v = consultantKey(c);
          sel.appendChild(ce('option',{value:v,textContent:`${(c.initials||'').toUpperCase()} — ${c.name||''}`}));
        });

        // Visible pill
        const pillwrap = ce('div',{className:'pillwrap'});
        const pill = ce('span',{className:'pill'});
        const dot = ce('span',{className:'dot'});
        const txt = ce('span',{className:'txt'});
        const init = ce('span',{className:'init'});
        const sep  = ce('span',{className:'sep',textContent:'—'});
        const name = ce('span',{className:'name'});
        txt.append(init, sep, name); pill.append(dot, txt); pillwrap.appendChild(pill);
        td.append(pillwrap, sel);

        // value hydrate
        const wkMap = state.alloc[week][a.id] ||= {};
        const cur = wkMap[d] || '';
        sel.value = cur;

        function paint(v){
          if(!v){ dot.style.background='#ddd'; init.textContent=''; name.textContent=''; sep.style.display='none'; pill.style.opacity=.6; return; }
          sep.style.display='';
          if(v==='ECL'){ dot.style.background='#d11'; init.textContent='ECL'; name.textContent='Unfilled session'; pill.style.opacity=1; return; }
          const c = (state.consultants||[]).find(x=>consultantKey(x)===v);
          if(c){ dot.style.background=c.color||'#888'; init.textContent=(c.initials||'').toUpperCase(); name.textContent=c.name||''; pill.style.opacity=1; }
          else { dot.style.background='#aaa'; init.textContent='?'; name.textContent=v; pill.style.opacity=1; }
        }
        paint(cur);

        sel.onchange = ()=>{
          pushHistory();
          const v = sel.value;
          state.alloc[week][a.id][d] = v;
          saved(); paint(v); renderJobplans(); // keep viewer in sync
        };

        tr.appendChild(td);
      });

      tb.appendChild(tr);
    });

    tbl.appendChild(tb);
    return tbl;
  }

  function renderWeekTables(){
    const dWrap = qs('#wD'); const nWrap = qs('#wN');
    if(dWrap){ const t=buildRotaTable(true); dWrap.innerHTML = t.innerHTML; }
    if(nWrap){ const t=buildRotaTable(false); nWrap.innerHTML = t.innerHTML; }
  }

  // -------- Data: Export / Import
  function exportAllJSON(){
    const dump = JSON.stringify(state,null,2);
    const a = ce('a',{href:'data:application/json;charset=utf-8,'+encodeURIComponent(dump),download:'barkeromatic-export.json'}); document.body.appendChild(a); a.click(); a.remove();
  }
  function importAllJSON(e){
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ try{
      pushHistory(); state = Object.assign({}, def, JSON.parse(String(r.result)));
      saved(); renderAll(); toast('Imported ALL (JSON)');
    }catch(err){ alert('Import failed: '+err.message); } };
    r.readAsText(f); e.target.value='';
  }
  qs('#exportAll')?.addEventListener('click', exportAllJSON);
  qs('#importAll')?.addEventListener('change', importAllJSON);
  qs('#resetApp')?.addEventListener('click', ()=>{ if(confirm('Reset app to defaults?')){ pushHistory(); state = JSON.parse(JSON.stringify(def)); saved(); renderAll(); } });

  // Consultants CSV/JSON
  qs('#exportConsultantsCSV')?.addEventListener('click', ()=>{
    const rows = [['name','initials','color']];
    (state.consultants||[]).forEach(c=>rows.push([c.name||'', c.initials||'', c.color||'']));
    const csv = rows.map(r=>r.map(csvEscape).join(',')).join('\n');
    const a=ce('a',{href:'data:text/csv;charset=utf-8,'+encodeURIComponent(csv),download:'consultants.csv'}); document.body.appendChild(a); a.click(); a.remove();
  });
  qs('#exportConsultantsJSON')?.addEventListener('click', ()=>{
    const dump = JSON.stringify(state.consultants||[], null, 2);
    const a=ce('a',{href:'data:application/json;charset=utf-8,'+encodeURIComponent(dump),download:'consultants.json'}); document.body.appendChild(a); a.click(); a.remove();
  });
  qs('#importConsultantsCSV')?.addEventListener('change', (e)=>{
    const f=e.target.files?.[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ try{
      pushHistory();
      const lines = String(r.result).trim().split(/\r?\n/);
      const hdr = (lines.shift()||'').split(',').map(s=>s.replace(/^"|"$/g,'').toLowerCase());
      const ni=hdr.indexOf('name'), ii=hdr.indexOf('initials'), ci=hdr.indexOf('color');
      const out=[];
      lines.forEach(line=>{
        const parts = line.match(/("([^"]|"")*"|[^,]+)/g)||[];
        const unq = s=>String(s||'').replace(/^"|"$/g,'').replace(/""/g,'"');
        const name=unq(parts[ni]||''); if(!name) return;
        out.push({id:ensureId('c'), name, initials:unq(parts[ii]||''), color:unq(parts[ci]||'#9CA3AF')});
      });
      state.consultants = out; saved(); renderConsultants(); renderWeekTables(); renderJobplans(); toast('Consultants CSV imported');
    }catch(err){ alert('Import failed: '+err.message); } };
    r.readAsText(f); e.target.value='';
  });
  qs('#importConsultantsJSON')?.addEventListener('change', (e)=>{
    const f=e.target.files?.[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ try{
      pushHistory();
      const arr = JSON.parse(String(r.result))||[];
      arr.forEach(c=>{ if(!c.id) c.id = consultantKey(c) || ensureId('c'); });
      state.consultants = arr; saved(); renderConsultants(); renderWeekTables(); renderJobplans(); toast('Consultants JSON imported');
    }catch(err){ alert('Import failed: '+err.message); } };
    r.readAsText(f); e.target.value='';
  });

  // Rota CSV
  qs('#exportCSV')?.addEventListener('click', ()=>{
    const rows = [['week','type','area','day','value']];
    const weeks = Number(state.cycleWeeks||8);
    for(let w=1; w<=weeks; w++){
      const map = state.alloc[String(w)]||{};
      (state.areas||[]).forEach(a=>{
        dayKeys().forEach(d=>{
          const v = map[a.id]?.[d] || '';
          rows.push([w, a.type, a.name, d, v]);
        });
      });
    }
    const csv = rows.map(r=>r.map(csvEscape).join(',')).join('\n');
    const a=ce('a',{href:'data:text/csv;charset=utf-8,'+encodeURIComponent(csv),download:'rota.csv'}); document.body.appendChild(a); a.click(); a.remove();
  });

  // -------- Jobplans viewer
  function jpSelectedConsultant(){
    const id = state._jpSelectId;
    return (state.consultants||[]).map(c=>({
      id: consultantKey(c),
      name: c.name||'',
      initials: (c.initials||'').toUpperCase(),
      color: c.color||'#888'
    })).find(x=>x.id===id) || null;
  }

  function renderJobplans(){
    const sel = qs('#jpConsultantSelect');
    const jpWE = qs('#jpWeekends');
    const tabs = qs('#jpWeekTabs');
    const title = qs('#jpTitle');
    const tD = qs('#jpWD'); const tN = qs('#jpWN');
    if(!sel || !jpWE || !tabs || !title || !tD || !tN) return;

    // Build dropdown
    const list = (state.consultants||[]).map((c,i)=>({ id: consultantKey(c) || String(i), name:c.name||'', initials:(c.initials||'').toUpperCase(), color:c.color||'#888' }));
    sel.innerHTML=''; list.forEach(c=> sel.appendChild(ce('option',{value:c.id,textContent:`${c.initials?c.initials+' — ':''}${c.name}`})) );
    if(!state._jpSelectId && list[0]) state._jpSelectId = list[0].id;
    if(state._jpSelectId && list.find(x=>x.id===state._jpSelectId)) sel.value = state._jpSelectId;
    sel.onchange = ()=>{ pushHistory(); state._jpSelectId = sel.value; saved(); renderJobplans(); };

    // Weekends toggle
    jpWE.checked = !!state._jpShowWeekends;
    jpWE.onchange = ()=>{ pushHistory(); state._jpShowWeekends = !!jpWE.checked; saved(); renderJobplans(); };

    // Week tabs
    const max = Number(state.cycleWeeks||8);
    tabs.innerHTML=''; for(let w=1; w<=max; w++){ const b=ce('button',{textContent:`week ${w}`}); if(w===Number(state.currentWeek||1)) b.classList.add('active'); b.onclick=()=>{ pushHistory(); state.currentWeek=w; saved(); renderJobplans(); }; tabs.appendChild(b); }

    // Title header
    const c = jpSelectedConsultant();
    title.innerHTML = c ? `
      <span class="pill">
        <span class="dot" style="background:${c.color}"></span>
        <span class="txt"><span class="init">${c.initials||''}</span><span class="sep">—</span><span class="name">Jobplan for ${c.name||'Consultant'}</span></span>
      </span>` : '';

    // Build tables
    const days = state._jpShowWeekends ? ['Area','Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : ['Area','Mon','Tue','Wed','Thu','Fri'];
    const headHTML = `<thead><tr>${days.map(d=>`<th>${d}</th>`).join('')}</tr></thead>`;

    function tableHTML(isDCC){
      const areas = (state.areas||[]).filter(a=>isDCC ? a.type==='DCC' : a.type!=='DCC');
      const wk = String(state.currentWeek||1);
      const map = state.alloc[wk]||{};
      const dKeys = days.slice(1);
      const rows = areas.map(a=>{
        const nameChip = `<span class="areachip" style="background:${a.color||'#eee'}">${a.name||''}</span>`;
        const tds = dKeys.map(d=>{
          const v = (map[a.id]||{})[d] || '';
          if(!c || !v) return '<td></td>';
          // match if value equals selected consultant key
          if(v === c.id){ 
            return `<td class="rota-cell"><div class="pillwrap"><span class="pill"><span class="dot" style="background:${c.color}"></span><span class="txt"><span class="init">${c.initials}</span><span class="sep">—</span><span class="name">${c.name}</span></span></span></div></td>`;
          }
          return '<td></td>';
        }).join('');
        return `<tr><td>${nameChip}</td>${tds}</tr>`;
      }).join('');
      return headHTML + `<tbody>${rows}</tbody>`;
    }

    tD.innerHTML = tableHTML(true);
    tN.innerHTML = tableHTML(false);
  }

  // -------- Render all
  function renderAll(){
    bindSetup();
    renderConsultants();
    renderAreas();
    renderWeekTabs();
    renderWeekTables();
    renderTitle();
    renderJobplans();
  }

  // Export/Import top-bar
  function exportAllJSON(){ const dump=JSON.stringify(state,null,2); const a=ce('a',{href:'data:application/json;charset=utf-8,'+encodeURIComponent(dump),download:'barkeromatic-export.json'}); document.body.appendChild(a); a.click(); a.remove(); }
  function importAllJSON(e){
    const f=e.target.files?.[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ try{ pushHistory(); state = Object.assign({}, def, JSON.parse(String(r.result))); saved(); renderAll(); toast('Imported.'); }catch(err){ alert('Import failed: '+err.message); } };
    r.readAsText(f); e.target.value='';
  }

  // Init
  renderAll();
})();
