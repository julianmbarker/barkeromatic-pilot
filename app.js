(function(){
  // ---- Boot marker so you can see JS actually ran
  window.addEventListener('DOMContentLoaded', function(){
    var b=document.getElementById('boot');
    if(b){ var t=new Date().toTimeString().split(' ')[0]; b.textContent='JS OK at '+t; }
    var bar=document.getElementById('bootbar'); if(bar){ bar.classList.add('show'); bar.textContent='Boot: all systems go ✅  @ '+(new Date().toLocaleTimeString()); }
  });

  // ---- Helpers: input behaviour & downloads
  function enhanceInput(input){
    if(!input) return;
    if(input.type==='number'){
      // stop accidental increments when scrolling over number inputs
      input.addEventListener('wheel', e=>{ e.preventDefault(); }, {passive:false});
    }
    // allow normal text selection without dragging rows
    input.addEventListener('mousedown', e=> e.stopPropagation());
  }

  function timestamp(){
    // Local time, zero-padded, safe for filenames
    const d = new Date();
    const z = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}-${z(d.getHours())}-${z(d.getMinutes())}`;
  }
  function safeName(s){
    return (s||'barkeromatic').replace(/[^a-z0-9\-\_ ]/gi,' ').trim().replace(/\s+/g,'-').toLowerCase();
  }
  function download(text, name, mime){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:mime})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }

  // ---- History (Undo/Redo)
  // NOTE: keep base KEY stable so your saved data works across versions
  const KEY="bom_pilot_state";
  // migrate from older keys if present
  (function migrate(){
    try{
      if(!localStorage.getItem(KEY)){
        const candidates = ["bom_pilot_state_v079","bom_pilot_state_v078","bom_pilot_state_v077"];
        for(const k of candidates){
          const v = localStorage.getItem(k);
          if(v){ localStorage.setItem(KEY, v); break; }
        }
      }
    }catch(_){}
  })();

  let historyStack=[], redoStack=[];
  function pushHistory(){ historyStack.push(JSON.stringify(state)); if(historyStack.length>100) historyStack.shift(); redoStack=[]; saved(); }
  function undo(){ if(historyStack.length===0) return; redoStack.push(JSON.stringify(state)); state=JSON.parse(historyStack.pop()); save(); renderAll(); saved(); }
  function redo(){ if(redoStack.length===0) return; historyStack.push(JSON.stringify(state)); state=JSON.parse(redoStack.pop()); save(); renderAll(); saved(); }
  document.addEventListener('DOMContentLoaded', function(){
    const u=document.getElementById('undoBtn'), r=document.getElementById('redoBtn');
    if(u) u.onclick=undo; if(r) r.onclick=redo;
  });

  // ---- State
  const def={"cycleWeeks":8,"rotaTitle":"","consultants":[],"areas":[],"alloc":{},"currentWeek":1,"monFriOnly":false,
"jobsShowWeekends":false,
"_jpSelectId":null};
  let state=load();
  function load(){ try{ const raw=localStorage.getItem(KEY); return raw?JSON.parse(raw):JSON.parse(JSON.stringify(def)); }catch(e){return JSON.parse(JSON.stringify(def));} }
  function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function toast(m){ const t=document.getElementById('toast'); if(!t) return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1100); }
  function saved(){ save(); const b=document.getElementById('savedBadge'); if(!b) return; b.style.opacity=.6; }

  // ---- Tabs
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.tab').forEach(b=> b.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
      document.querySelectorAll('main > section').forEach(s=> s.style.display='none'); document.getElementById(b.dataset.tab).style.display='block'; renderAll();
    }));
  });

  // ---- Reset
  document.addEventListener('DOMContentLoaded', function(){
    const btn=document.getElementById('resetApp');
    if(btn) btn.onclick=()=>{ if(confirm("Reset app and clear all data?")){ localStorage.removeItem(KEY); location.reload(); } };
  });

  // ---- Global import/export (ALL) with auto-named filename
  document.addEventListener('DOMContentLoaded', function(){
    const ex=document.getElementById('exportTop'), im=document.getElementById('importTop');
    if(ex) ex.onclick=()=> {
      const base = safeName(state.rotaTitle || 'barkeromatic');
      const name = `${base}-${timestamp()}.json`;
      download(JSON.stringify(state,null,2), name, "application/json");
    };
    if(im) im.onchange=(e)=>importAll(e.target.files[0]);
  });

  // ---- Setup bindings
  function bindSetup(){
    const weeksSel=document.getElementById('weeks');
    if(weeksSel && weeksSel.options.length===0){
      for(let i=1;i<=15;i++){ const o=document.createElement('option'); o.value=i; o.textContent=i; weeksSel.appendChild(o); }
    }
    const rt=document.getElementById('rotaTitle');
    if(rt){
      rt.value=state.rotaTitle||"";
      enhanceInput(rt);
      rt.oninput=(e)=>{ pushHistory(); state.rotaTitle=e.target.value; renderTitle(); };
    }
    if(weeksSel){
      weeksSel.value=state.cycleWeeks;
      weeksSel.onchange=()=>{ pushHistory(); state.cycleWeeks=Number(weeksSel.value); if(state.currentWeek>state.cycleWeeks) state.currentWeek=state.cycleWeeks; renderWeekTabs(); renderWeekTables(); renderTitle(); };
    }
  }

  // ---- Consultants table
  function renderConsultants(){
    const tb=document.querySelector('#ctable tbody'); if(!tb) return; tb.innerHTML="";
    const ccount=document.getElementById('ccount'); if(ccount) ccount.textContent=`(${state.consultants.length})`;
    state.consultants.forEach((c,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="drag" title="drag to reorder">⋮⋮</td>
                    <td><input value="${c.name||""}"></td>
                    <td><input value="${c.initials||""}"></td>
                    <td><input type="color" value="${c.color||"#0EA5E9"}"></td>
                    <td><button class="btn ghost">Remove</button></td>`;
      const handle=tr.children[0];
      const nm=tr.children[1].firstChild;
      const ins=tr.children[2].firstChild;
      const col=tr.children[3].firstChild;
      const rm=tr.children[4].firstChild;

      [nm,ins,col].forEach(inp=>{
        enhanceInput(inp);
        inp.addEventListener('focus', ()=> handle.draggable=false);
        inp.addEventListener('blur',  ()=> handle.draggable=true);
      });

      nm.oninput=()=>{ pushHistory(); c.name=nm.value; };
      ins.oninput=()=>{ pushHistory(); c.initials=ins.value; renderWeekTables(); };
      col.oninput=()=>{ pushHistory(); c.color=col.value; renderWeekTables(); };

      if(rm) rm.onclick=()=>{ pushHistory(); state.consultants.splice(i,1); Object.keys(state.alloc).forEach(k=>{ if(state.alloc[k]===c.id) state.alloc[k]=null; }); renderConsultants(); renderWeekTables(); };

      handle.draggable=true;
      handle.addEventListener('dragstart', ev=> ev.dataTransfer.setData("text/plain", i.toString()));
      tr.addEventListener('dragover', ev=>{ ev.preventDefault(); tr.style.outline="2px dashed var(--accent)"; });
      tr.addEventListener('dragleave', ()=>{ tr.style.outline=""; });
      tr.addEventListener('drop', ev=>{
        ev.preventDefault(); tr.style.outline="";
        const from=parseInt(ev.dataTransfer.getData("text/plain"));
        const to=i; if(Number.isNaN(from) || from===to) return;
        pushHistory(); const item=state.consultants.splice(from,1)[0]; state.consultants.splice(to,0,item);
        renderConsultants(); renderWeekTables();
      });

      tb.appendChild(tr);
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    const add=document.getElementById('addConsultant');
    if(add) add.onclick=()=>{ pushHistory(); state.consultants.push({id:crypto.randomUUID(),name:`Consultant ${state.consultants.length+1}`,initials:`C${state.consultants.length+1}`,color:"#0EA5E9"}); renderConsultants(); };
  });

  // ---- Areas (DCC / Non-DCC)
  function renderAreas(){
    const dT=document.querySelector('#dcct tbody'), nT=document.querySelector('#ndcct tbody'); if(dT) dT.innerHTML=""; if(nT) nT.innerHTML="";
    (state.areas||[]).filter(a=>a.type==="DCC").forEach((a,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="drag" title="drag to reorder">⋮⋮</td>
        <td><input value="${a.name||""}" placeholder="e.g. Cardiac Theatre 1"></td>
        <td><select><option>am</option><option>pm</option><option>eve</option></select></td>
        <td><input type="number" step="0.25" value="${a.pa||1}"></td>
        <td><input type="color" value="${a.color||"#E5E7EB"}"></td>
        <td><button class="btn ghost">Remove</button></td>`;
      const handle=tr.children[0];
      const nm=tr.children[1].firstChild, sess=tr.children[2].firstChild, pa=tr.children[3].firstChild, col=tr.children[4].firstChild, rm=tr.children[5].firstChild;
      [nm,pa,col].forEach(inp=>{
        enhanceInput(inp);
        inp.addEventListener('focus', ()=> handle.draggable=false);
        inp.addEventListener('blur',  ()=> handle.draggable=true);
      });
      sess.value=a.session||"am";
      nm.oninput=()=>{ pushHistory(); a.name=nm.value; renderWeekTables(); };
      sess.onchange=()=>{ pushHistory(); a.session=sess.value; renderWeekTables(); };
      pa.oninput=()=>{ pushHistory(); a.pa=Number(pa.value||0); };
      col.oninput=()=>{ pushHistory(); a.color=col.value; renderWeekTables(); };
      rm.onclick=()=>{ pushHistory(); Object.keys(state.alloc).forEach(k=>{ if(k.startsWith(a.id+"__")) delete state.alloc[k]; }); state.areas=state.areas.filter(x=>x!==a); renderAreas(); renderWeekTables(); };

      handle.draggable=true;
      handle.addEventListener('dragstart', ev=> ev.dataTransfer.setData("text/plain", "DCC:"+idx));
      tr.addEventListener('dragover', ev=>{ ev.preventDefault(); tr.style.outline="2px dashed var(--accent)"; });
      tr.addEventListener('dragleave', ()=>{ tr.style.outline=""; });
      tr.addEventListener('drop', ev=>{
        ev.preventDefault(); tr.style.outline="";
        const data=ev.dataTransfer.getData("text/plain"); if(!data.startsWith("DCC:")) return;
        const from=parseInt(data.split(":")[1]); const to=idx; if(from===to) return;
        pushHistory();
        const dcc=state.areas.filter(x=>x.type==="DCC"); const item=dcc.splice(from,1)[0]; dcc.splice(to,0,item);
        const nd=state.areas.filter(x=>x.type!=="DCC"); state.areas=[...dcc,...nd];
        renderAreas(); renderWeekTables();
      });
      dT.appendChild(tr);
    });
    (state.areas||[]).filter(a=>a.type!=="DCC").forEach((a,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="drag" title="drag to reorder">⋮⋮</td>
        <td><input value="${a.name||""}" placeholder="e.g. Teaching"></td>
        <td><input type="number" step="0.25" value="${a.pa||1}"></td>
        <td><input type="color" value="${a.color||"#FDE68A"}"></td>
        <td><button class="btn ghost">Remove</button></td>`;
      const handle=tr.children[0];
      const nm=tr.children[1].firstChild, pa=tr.children[2].firstChild, col=tr.children[3].firstChild, rm=tr.children[4].firstChild;
      [nm,pa,col].forEach(inp=>{
        enhanceInput(inp);
        inp.addEventListener('focus', ()=> handle.draggable=false);
        inp.addEventListener('blur',  ()=> handle.draggable=true);
      });
      nm.oninput=()=>{ pushHistory(); a.name=nm.value; renderWeekTables(); };
      pa.oninput=()=>{ pushHistory(); a.pa=Number(pa.value||0); };
      col.oninput=()=>{ pushHistory(); a.color=col.value; renderWeekTables(); };
      rm.onclick=()=>{ pushHistory(); Object.keys(state.alloc).forEach(k=>{ if(k.startsWith(a.id+"__")) delete state.alloc[k]; }); state.areas=state.areas.filter(x=>x!==a); renderAreas(); renderWeekTables(); };

      handle.draggable=true;
      handle.addEventListener('dragstart', ev=> ev.dataTransfer.setData("text/plain", "NDC:"+idx));
      tr.addEventListener('dragover', ev=>{ ev.preventDefault(); tr.style.outline="2px dashed var(--accent)"; });
      tr.addEventListener('dragleave', ()=>{ tr.style.outline=""; });
      tr.addEventListener('drop', ev=>{
        ev.preventDefault(); tr.style.outline="";
        const data=ev.dataTransfer.getData("text/plain"); if(!data.startsWith("NDC:")) return;
        const from=parseInt(data.split(":")[1]); const nd=state.areas.filter(x=>x.type!=="DCC"); const to=idx; if(from===to) return;
        pushHistory();
        const item=nd.splice(from,1)[0]; nd.splice(to,0,item);
        const dcc=state.areas.filter(x=>x.type==="DCC"); state.areas=[...dcc,...nd];
        renderAreas(); renderWeekTables();
      });
      nT.appendChild(tr);
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    const ad=document.getElementById('addDCC'), an=document.getElementById('addNonDCC');
    if(ad) ad.onclick=()=>{ pushHistory(); state.areas.push({id:crypto.randomUUID(),type:"DCC",name:`Theatre ${state.areas.filter(a=>a.type==="DCC").length+1}`,session:"am",pa:1,color:"#E5E7EB"}); renderAreas(); renderWeekTables(); };
    if(an) an.onclick=()=>{ pushHistory(); state.areas.push({id:crypto.randomUUID(),type:"NonDCC",name:`Non-DCC ${state.areas.filter(a=>a.type!=="DCC").length+1}`,pa:1,color:"#FDE68A"}); renderAreas(); renderWeekTables(); };
  });

  // ---- Allocation
  function ensureAlloc(){
    for(const a of state.areas){
      for(let w=1; w<=state.cycleWeeks; w++){
        for(let d=1; d<=7; d++){
          const k=`${a.id}__week${w}__day${d}`;
          if(!(k in state.alloc)) state.alloc[k]=null;
        }
      }
    }
    Object.keys(state.alloc).forEach(k=>{
      const aid=k.split("__")[0];
      if(!state.areas.find(a=>a.id===aid)) delete state.alloc[k];
    });
  }

  function renderWeekTabs(){
    ensureAlloc();
    const wrap=document.getElementById('weekTabs'); wrap.innerHTML="";
    wrap.style.gridTemplateColumns=`repeat(${Math.min(state.cycleWeeks,8)},1fr)`;
    for(let w=1; w<=state.cycleWeeks; w++){
      const b=document.createElement('button'); b.textContent="week "+w;
      if(w===state.currentWeek) b.classList.add('active');
      b.onclick=()=>{ pushHistory(); state.currentWeek=w; renderWeekTabs(); renderWeekTables(); renderTitle(); };
      wrap.appendChild(b);
    }
  }
  function renderTitle(){ const base=(state.rotaTitle||"rota"); const t=document.getElementById('titleLoz'); t.textContent=`${base} — week ${state.currentWeek}`; }

  // ---- Rota cells
  function pillHTML(color, initials, name){
    const safeInit=(initials||"").toUpperCase(); const safeName=name||"";
    return `<span class="pill"><span class="dot" style="background:${color}"></span><span class="txt"><span class="init">${safeInit}</span><span class="sep">—</span><span class="name">${safeName}</span></span></span>`;
  }
  function paintCell(td, val){
    td.innerHTML='';
    const sel=document.createElement('select');
    sel.appendChild(new Option("ECL (unfilled)","__ECL__"));
    sel.appendChild(new Option("—",""));
    state.consultants.forEach(c=>{
      const txt=(c.initials||"") + (c.name && c.name!==c.initials ? " — "+c.name : "");
      sel.appendChild(new Option(txt, c.id));
    });
    td.appendChild(sel);
    const pill=document.createElement('div'); pill.className='pillwrap'; td.appendChild(pill);
    if(val && val.startsWith && val.startsWith("__ECL__")){ pill.innerHTML=pillHTML("#DC2626","ECL","Unfilled"); sel.value="__ECL__"; return; }
    const c=state.consultants.find(x=>x.id===val);
    if(c){ pill.innerHTML=pillHTML(c.color||"#888", c.initials, c.name); sel.value=c.id; } else { pill.innerHTML=""; sel.value=""; }
  }
  function dayCell(area, d){
    const td=document.createElement('td'); td.className='rota-cell';
    const w=state.currentWeek; const key=`${area.id}__week${w}__day${d}`;
    paintCell(td, state.alloc[key]||"");
    const sel=td.querySelector('select');
    sel.onchange=()=>{
      pushHistory(); state.alloc[key]= sel.value||null;
      // auto-fill pm when am set for same named area
      if(area.type==="DCC" && String(area.session||"").toLowerCase()==="am"){
        const pm = state.areas.find(a=> a.type==="DCC" && String(a.session||"").toLowerCase()==="pm" && String(a.name||"").trim().toLowerCase()===String(area.name||"").trim().toLowerCase());
        if(pm){ const pmKey=`${pm.id}__week${w}__day${d}`; if(!state.alloc[pmKey]) state.alloc[pmKey]=sel.value||null; }
      }
      paintCell(td, state.alloc[key]||"");
    };
    td.addEventListener('click', ()=> sel.focus());
    return td;
  }
  function areaRow(area, type, table){
    const tr=document.createElement('tr'); const nameTd=document.createElement('td');
    const chip=document.createElement('span'); chip.className='areachip'; chip.textContent=area.name; chip.style.background=area.color||"#E5E7EB";
    const badge=document.createElement('span'); badge.className='session-badge'; if(type==="DCC") badge.textContent=(area.session||"am");
    const lwrap=document.createElement('div'); lwrap.className='labelwrap';
    const left=document.createElement('div'); left.appendChild(chip); if(type==="DCC"){ left.appendChild(document.createTextNode(" ")); left.appendChild(badge); }
    lwrap.appendChild(left); nameTd.appendChild(lwrap); tr.appendChild(nameTd);
    const days = state.monFriOnly ? [1,2,3,4,5] : [1,2,3,4,5,6,7];
    days.forEach(d=> tr.appendChild(dayCell(area, d)));
    table.appendChild(tr);
  }
  function renderWeekTables(){
    ensureAlloc();
    const mf=document.getElementById('mfOnly'); mf.checked=!!state.monFriOnly; mf.onchange=()=>{ state.monFriOnly=!!mf.checked; pushHistory(); renderWeekTables(); };
    const dHead=["Area"], nHead=["Area"]; const days = state.monFriOnly ? ["Mon","Tue","Wed","Thu","Fri"] : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    days.forEach(x=>{ dHead.push(x); nHead.push(x); });
    const wD=document.getElementById('wD'), wN=document.getElementById('wN'); wD.innerHTML=""; wN.innerHTML="";
    const thD=document.createElement('thead'); const trD=document.createElement('tr'); dHead.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trD.appendChild(th); }); thD.appendChild(trD); wD.appendChild(thD);
    const thN=document.createElement('thead'); const trN=document.createElement('tr'); nHead.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trN.appendChild(th); }); thN.appendChild(trN); wN.appendChild(thN);
    const tbD=document.createElement('tbody'); const tbN=document.createElement('tbody');
    state.areas.filter(a=>a.type==="DCC").forEach(a=> areaRow(a,"DCC",tbD));
    state.areas.filter(a=>a.type!=="DCC").forEach(a=> areaRow(a,"NonDCC",tbN));
    wD.appendChild(tbD); wN.appendChild(tbN);
  }

  // ---- Data tab (export/import) — auto-named full export + CSV
  document.addEventListener('DOMContentLoaded', function(){
    const expAll=document.getElementById('exportAll'), impAll=document.getElementById('importAll'), expCsv=document.getElementById('exportCSV');
    if(expAll) expAll.onclick=()=>{
      const base = safeName(state.rotaTitle || 'barkeromatic');
      const name = `${base}-${timestamp()}.json`;
      download(JSON.stringify(state,null,2), name, "application/json");
    };
    function importAll(file){
      if(!file) return; const r=new FileReader();
      r.onload=()=>{ try{ const next=JSON.parse(String(r.result)); pushHistory(); state=next; renderAll(); toast("Imported."); }catch(e){ alert("Import failed: "+e.message); } };
      r.readAsText(file);
    }
    if(impAll) impAll.onchange=(e)=> importAll(e.target.files[0]);
    if(expCsv) expCsv.onclick=()=>{
      const header = ["week","type","area","session","day","assigned","initials","name","color_hex"];
      const rows=[header];
      for(let w=1; w<=state.cycleWeeks; w++){
        state.areas.forEach(a=>{
          for(let d=1; d<=7; d++){
            const key=`${a.id}__week${w}__day${d}`;
            const val=state.alloc[key]||"";
            if(val && val.startsWith && val.startsWith("__ECL__")){
              rows.push([w, a.type, a.name, (a.session||""), ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][d-1], "ECL", "", "", ""]);
            }else{
              const c = state.consultants.find(x=>x.id===val);
              rows.push([w, a.type, a.name, (a.session||""), ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][d-1],
                         c? (c.initials||"") : "", c? (c.name||"") : "", c? String(c.color||"").replace("#","") : ""]);
            }
          }
        });
      }
      const csv = rows.map(r=>r.map(x=>{ x=(x==null)?"":String(x); return (/[,\n\"]/).test(x)? '\"'+x.replace(/\"/g,'\"\"')+'\"' : x; }).join(",")).join("\n");
      const base = safeName(state.rotaTitle || 'barkeromatic');
      download(csv, `${base}-rota-${timestamp()}.csv`, "text/csv");
    };
  });

  function renderAll(){ bindSetup(); renderConsultants(); renderAreas(); renderWeekTabs(); renderWeekTables(); renderTitle(); }

  // ---- Seed demo data on first run
  if((state.consultants||[]).length===0 && (state.areas||[]).length===0){
    state.consultants=[{id:crypto.randomUUID(),name:"Demo Consultant",initials:"DC",color:"#0EA5E9"}];
    state.areas=[
      {id:crypto.randomUUID(),type:"DCC",name:"Cardiac Theatre 1",session:"am",pa:1,color:"#C084FC"},
      {id:crypto.randomUUID(),type:"DCC",name:"Cardiac Theatre 1",session:"pm",pa:1,color:"#C084FC"}
    ];
    save();
  }
  // ===== JOBPLANS HELPERS =====
function jpEnsureConsultantSelect(){
  const sel = document.getElementById('jpConsultantSelect');
  if(!sel) return null;
  // populate
  const prev = state._jpSelectId;
  sel.innerHTML = '';
  (state.consultants||[]).forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.initials || ''} — ${c.name || ''}`;
    sel.appendChild(opt);
  });
  // keep selection or pick first
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value = prev;
  else if(sel.options.length) sel.value = sel.options[0].value;
  state._jpSelectId = sel.value || null;

  sel.onchange = ()=>{ state._jpSelectId = sel.value; pushHistory(); jpRenderHeader(); jpRenderWeekTabs(); jpRenderConsultantRota(); };
  return sel;
}

function jpRenderHeader(){
  const t= document.getElementById('jpTitle'); if(!t) return;
  const cid = state._jpSelectId;
  const c=(state.consultants||[]).find(x=>x.id===cid);
  t.innerHTML = c ? `
    <span class="pill"><span class="dot" style="background:${c.color||'#888'}"></span>
    <span class="txt"><span class="init">${(c.initials||'').toUpperCase()}</span>
    <span class="sep">—</span><span class="name">Jobplan for Dr ${c.name||''}</span></span></span>
  ` : '';
}

function jpRenderWeekTabs(){
  const wrap = document.getElementById('jpWeekTabs'); if(!wrap) return;
  wrap.innerHTML='';
  const max = state.cycleWeeks || 8;
  for(let w=1; w<=max; w++){
    const b=document.createElement('button');
    b.textContent = `week ${w}`;
    if(w===state.currentWeek) b.classList.add('active');
    b.onclick = ()=>{ pushHistory(); state.currentWeek = w; jpRenderConsultantRota(); jpRenderWeekTabs(); };
    wrap.appendChild(b);
  }
}

function jpRenderConsultantRota(){
  const wD = document.getElementById('jpWD'), wN = document.getElementById('jpWN');
  if(!wD || !wN) return;
  const cid = state._jpSelectId; if(!cid) { wD.innerHTML=''; wN.innerHTML=''; return; }

  const showWE = !!state.jobsShowWeekends;
  const daysIdx = showWE ? [1,2,3,4,5,6,7] : [1,2,3,4,5];
  const dayNames = ["Area","Mon","Tue","Wed","Thu","Fri","Sat","Sun"].slice(0, daysIdx.length+1);

  const mkHead = (tbl)=>{
    tbl.innerHTML='';
    const thead=document.createElement('thead'), tr=document.createElement('tr');
    dayNames.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.appendChild(th); });
    thead.appendChild(tr); tbl.appendChild(thead);
  };
  const mkBody = (tbl, areas)=>{
    const tbody=document.createElement('tbody');
    areas.forEach(a=>{
      const tr=document.createElement('tr');
      const nameTd=document.createElement('td');
      nameTd.innerHTML = `<span class="areachip" style="background:${a.color||'#eee'}">${a.name||''}</span>`;
      tr.appendChild(nameTd);

      daysIdx.forEach(d=>{
        const td=document.createElement('td'); td.className='rota-cell';
        const key=`${a.id}__week${state.currentWeek}__day${d}`;
        const v = state.alloc[key];
        if(v && v===cid){
          const c=(state.consultants||[]).find(x=>x.id===cid);
          td.innerHTML = c ? `<span class="pill"><span class="dot" style="background:${c.color||'#888'}"></span><span class="txt"><span class="init">${(c.initials||'').toUpperCase()}</span><span class="sep">—</span><span class="name">${c.name||''}</span></span></span>` : '';
        } else {
          td.innerHTML = '';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
  };

  mkHead(wD); mkHead(wN);
  const dcc = (state.areas||[]).filter(a=>a.type==="DCC");
  const ndc = (state.areas||[]).filter(a=>a.type!=="DCC");
  mkBody(wD, dcc);
  mkBody(wN, ndc);
  jpRenderHeader();
}

function renderJobplans(){
  const sel = jpEnsureConsultantSelect();
  const jpWE = document.getElementById('jpWeekends');
  if(jpWE){
    jpWE.checked = !!state.jobsShowWeekends;
    jpWE.onchange = ()=>{ pushHistory(); state.jobsShowWeekends = jpWE.checked; jpRenderConsultantRota(); };
  }
  if(sel && !state._jpSelectId && sel.value) state._jpSelectId = sel.value;
  jpRenderWeekTabs();
  jpRenderConsultantRota();
}
// ===== END JOBPLANS HELPERS =====
// ===== JOBPLANS HELPERS =====
function jpEnsureConsultantSelect(){
  const sel = document.getElementById('jpConsultantSelect');
  if(!sel) return null;
  const prev = state._jpSelectId;
  sel.innerHTML = '';
  (state.consultants||[]).forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.initials || ''} — ${c.name || ''}`;
    sel.appendChild(opt);
  });
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value = prev;
  else if(sel.options.length) sel.value = sel.options[0].value;
  state._jpSelectId = sel.value || null;
  sel.onchange = ()=>{ state._jpSelectId = sel.value; pushHistory(); jpRenderHeader(); jpRenderWeekTabs(); jpRenderConsultantRota(); };
  return sel;
}

function jpRenderHeader(){
  const t= document.getElementById('jpTitle'); if(!t) return;
  const cid = state._jpSelectId;
  const c=(state.consultants||[]).find(x=>x.id===cid);
  t.innerHTML = c ? `
    <span class="pill"><span class="dot" style="background:${c.color||'#888'}"></span>
    <span class="txt"><span class="init">${(c.initials||'').toUpperCase()}</span>
    <span class="sep">—</span><span class="name">Jobplan for Dr ${c.name||''}</span></span></span>
  ` : '';
}

function jpRenderWeekTabs(){
  const wrap = document.getElementById('jpWeekTabs'); if(!wrap) return;
  wrap.innerHTML='';
  const max = state.cycleWeeks || 8;
  for(let w=1; w<=max; w++){
    const b=document.createElement('button');
    b.textContent = `week ${w}`;
    if(w===state.currentWeek) b.classList.add('active');
    b.onclick = ()=>{ pushHistory(); state.currentWeek = w; jpRenderConsultantRota(); jpRenderWeekTabs(); };
    wrap.appendChild(b);
  }
}

function jpRenderConsultantRota(){
  const wD = document.getElementById('jpWD'), wN = document.getElementById('jpWN');
  if(!wD || !wN) return;
  const cid = state._jpSelectId; if(!cid) { wD.innerHTML=''; wN.innerHTML=''; return; }
  const showWE = !!state.jobsShowWeekends;
  const daysIdx = showWE ? [1,2,3,4,5,6,7] : [1,2,3,4,5];
  const dayNames = ["Area","Mon","Tue","Wed","Thu","Fri","Sat","Sun"].slice(0, daysIdx.length+1);
  const mkHead = (tbl)=>{
    tbl.innerHTML='';
    const thead=document.createElement('thead'), tr=document.createElement('tr');
    dayNames.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.appendChild(th); });
    thead.appendChild(tr); tbl.appendChild(thead);
  };
  const mkBody = (tbl, areas)=>{
    const tbody=document.createElement('tbody');
    areas.forEach(a=>{
      const tr=document.createElement('tr');
      const nameTd=document.createElement('td');
      nameTd.innerHTML = `<span class="areachip" style="background:${a.color||'#eee'}">${a.name||''}</span>`;
      tr.appendChild(nameTd);
      daysIdx.forEach(d=>{
        const td=document.createElement('td'); td.className='rota-cell';
        const key=`${a.id}__week${state.currentWeek}__day${d}`;
        const v = state.alloc[key];
        if(v && v===cid){
          const c=(state.consultants||[]).find(x=>x.id===cid);
          td.innerHTML = c ? `<span class="pill"><span class="dot" style="background:${c.color||'#888'}"></span><span class="txt"><span class="init">${(c.initials||'').toUpperCase()}</span><span class="sep">—</span><span class="name">${c.name||''}</span></span></span>` : '';
        } else {
          td.innerHTML = '';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
  };
  mkHead(wD); mkHead(wN);
  const dcc = (state.areas||[]).filter(a=>a.type==="DCC");
  const ndc = (state.areas||[]).filter(a=>a.type!=="DCC");
  mkBody(wD, dcc);
  mkBody(wN, ndc);
  jpRenderHeader();
}

function renderJobplans(){
  const sel = jpEnsureConsultantSelect();
  const jpWE = document.getElementById('jpWeekends');
  if(jpWE){
    jpWE.checked = !!state.jobsShowWeekends;
    jpWE.onchange = ()=>{ pushHistory(); state.jobsShowWeekends = jpWE.checked; jpRenderConsultantRota(); };
  }
  if(sel && !state._jpSelectId && sel.value) state._jpSelectId = sel.value;
  jpRenderWeekTabs();
  jpRenderConsultantRota();
}
// ===== END JOBPLANS HELPERS ===== 
  renderAll();
})();
renderJobplans();
