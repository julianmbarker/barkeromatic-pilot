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
  const def={
  "cycleWeeks":8,
  "rotaTitle":"",
  "consultants":[],
  "areas":[],
  "alloc":{},
  "currentWeek":1,
  "monFriOnly":false,
  "jobplans":{},
  "jobsShowWeekends":false
};
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

  function renderAll(){
  bindSetup();
  renderConsultants();
  renderAreas();
  renderWeekTabs();
  renderWeekTables();
  renderTitle();
  renderJobplans(); // NEW
}

  // ---- Seed demo data on first run
  if((state.consultants||[]).length===0 && (state.areas||[]).length===0){
    state.consultants=[{id:crypto.randomUUID(),name:"Demo Consultant",initials:"DC",color:"#0EA5E9"}];
    state.areas=[
      {id:crypto.randomUUID(),type:"DCC",name:"Cardiac Theatre 1",session:"am",pa:1,color:"#C084FC"},
      {id:crypto.randomUUID(),type:"DCC",name:"Cardiac Theatre 1",session:"pm",pa:1,color:"#C084FC"}
    ];
    save();
  }// ===== Jobplans MVP =====
function ensureJobplanFor(consultantId){
  if(!state.jobplans) state.jobplans={};
  if(!state.jobplans[consultantId]){
    state.jobplans[consultantId] = {
      targetPAsPerWeek: 0,
      dcc: [],
      nonDcc: [],
      oncall: { paPerWeek: 0 }
    };
  }
  return state.jobplans[consultantId];
}

function jpCalcPlanned(cId){
  const jp = ensureJobplanFor(cId);
  const sum = a => (a||[]).reduce((s,x)=> s + Number(x.pa||0), 0);
  const dcc = sum(jp.dcc);
  const ndc = sum(jp.nonDcc);
  const oc  = Number(jp.oncall?.paPerWeek||0);
  return { dcc, ndc, oc, total: dcc+ndc+oc, target: Number(jp.targetPAsPerWeek||0) };
}

function jpCalcActualFromRota(cId){
  if(!cId) return 0;
  const weeks = Math.max(1, Number(state.cycleWeeks||1));
  let sumWeeks = 0;
  for(let w=1; w<=weeks; w++){
    let weekTotal = 0;
    for(const a of state.areas){
      const pa = Number(a.pa||0);
      for(let d=1; d<=7; d++){
        const k = `${a.id}__week${w}__day${d}`;
        const val = state.alloc[k];
        if(val && val===cId){
          weekTotal += pa;
        }
      }
    }
    sumWeeks += weekTotal;
  }
  return sumWeeks / weeks; // avg per week over cycle
}

function jpConsultantOptions(selectEl){
  selectEl.innerHTML = "";
  const defOpt = new Option("Select consultant…", "");
  selectEl.appendChild(defOpt);
  state.consultants.forEach(c=>{
    const o = new Option((c.initials? (c.initials+" — "):"") + (c.name||""), c.id);
    selectEl.appendChild(o);
  });
}

function jpRenderSummary(cId){
  const plan = jpCalcPlanned(cId);
  const actual = jpCalcActualFromRota(cId);
  const delta = (plan.total - actual);
  const set = (id, txt)=>{ const el=document.getElementById(id); if(el) el.textContent=txt; };
  set("jpPlannedDCC", `Planned DCC: ${plan.dcc}`);
  set("jpPlannedNonDCC", `Planned Non-DCC: ${plan.ndc}`);
  set("jpPlannedOncall", `On-call: ${plan.oc}`);
  set("jpPlannedTotal", `Planned Total: ${plan.total}`);
  set("jpActualRota", `Actual rota (avg/week): ${Number(actual.toFixed(2))}`);
  const deltaEl = document.getElementById("jpDelta");
  if(deltaEl){
    deltaEl.textContent = `Δ (Planned − Actual): ${Number(delta.toFixed(2))}`;
    deltaEl.style.background = (Math.abs(delta) <= 0.25) ? "#ECFDF5" : (Math.abs(delta)<=0.5 ? "#FFFBEB" : "#FEF2F2");
  }
}

function jpBindRows(cId){
  const jp = ensureJobplanFor(cId);

  // DCC table
  const dBody = document.querySelector("#jpDCCT tbody");
  dBody.innerHTML = "";
  (jp.dcc||[]).forEach((row, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input value="${row.name||""}" placeholder="e.g. Cardiac Theatre"></td>
      <td>
        <select>
          <option>am</option><option>pm</option><option>eve</option><option>n/a</option>
        </select>
      </td>
      <td><input type="number" step="0.25" value="${Number(row.pa||0)}" style="width:100px"></td>
      <td><button class="btn ghost">Remove</button></td>
    `;
    const nm = tr.children[0].firstChild;
    const sess = tr.children[1].firstChild;
    const pa = tr.children[2].firstChild;
    const rm = tr.children[3].firstChild;
    [nm,pa,sess].forEach(enhanceInput);
    sess.value = row.session || "am";
    nm.oninput = ()=>{ pushHistory(); row.name = nm.value; jpRenderSummary(cId); };
    sess.onchange = ()=>{ pushHistory(); row.session = sess.value; jpRenderSummary(cId); };
    pa.oninput = ()=>{ pushHistory(); row.pa = Number(pa.value||0); jpRenderSummary(cId); };
    rm.onclick = ()=>{ pushHistory(); jp.dcc.splice(idx,1); jpBindRows(cId); jpRenderSummary(cId); };
    dBody.appendChild(tr);
  });

  // Non-DCC table
  const nBody = document.querySelector("#jpNDCCT tbody");
  nBody.innerHTML = "";
  (jp.nonDcc||[]).forEach((row, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input value="${row.name||""}" placeholder="e.g. SPA / Admin / Teaching"></td>
      <td><input type="number" step="0.25" value="${Number(row.pa||0)}" style="width:100px"></td>
      <td><button class="btn ghost">Remove</button></td>
    `;
    const nm = tr.children[0].firstChild;
    const pa = tr.children[1].firstChild;
    const rm = tr.children[2].firstChild;
    [nm,pa].forEach(enhanceInput);
    nm.oninput = ()=>{ pushHistory(); row.name = nm.value; jpRenderSummary(cId); };
    pa.oninput = ()=>{ pushHistory(); row.pa = Number(pa.value||0); jpRenderSummary(cId); };
    rm.onclick = ()=>{ pushHistory(); jp.nonDcc.splice(idx,1); jpBindRows(cId); jpRenderSummary(cId); };
    nBody.appendChild(tr);
  });

  // On-call
  const on = document.getElementById("jpOncallPA");
  if(on){
    on.value = Number(jp.oncall?.paPerWeek||0);
    enhanceInput(on);
    on.oninput = ()=>{ pushHistory(); jp.oncall.paPerWeek = Number(on.value||0); jpRenderSummary(cId); };
  }

  // Target
  const tgt = document.getElementById("jpTarget");
  if(tgt){
    tgt.value = Number(jp.targetPAsPerWeek||0);
    enhanceInput(tgt);
    tgt.oninput = ()=>{ pushHistory(); jp.targetPAsPerWeek = Number(tgt.value||0); };
  }
}

function renderJobplans(){
  const sel = document.getElementById("jpConsultantSelect");
  if(!sel) return; // tab not visible in DOM
  jpConsultantOptions(sel);

  // If no selection yet, try pick first consultant
  if(!sel.value){
    if(state.consultants.length>0){
      sel.value = state.consultants[0].id;
    } else {
      sel.value = "";
    }
  }

  const selectHandler = ()=>{
    const cId = sel.value;
    if(!cId){ // nothing selected, clear tables and summary
      ["jpDCCT","jpNDCCT"].forEach(id=>{ const tb=document.querySelector(`#${id} tbody`); if(tb) tb.innerHTML=""; });
      ["jpPlannedDCC","jpPlannedNonDCC","jpPlannedOncall","jpPlannedTotal","jpActualRota","jpDelta"].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=""; });
      const on=document.getElementById("jpOncallPA"); if(on) on.value="";
      const tgt=document.getElementById("jpTarget"); if(tgt) tgt.value="";
      return;
    }
    ensureJobplanFor(cId);
    jpBindRows(cId);
    jpRenderSummary(cId);
  };

  sel.onchange = selectHandler;
  selectHandler(); // render immediately for current selection

  // Add row buttons
  const addD = document.getElementById("jpAddDCC");
  const addN = document.getElementById("jpAddNonDCC");
  if(addD) addD.onclick = ()=>{
    if(!sel.value) return alert("Choose a consultant first.");
    const jp = ensureJobplanFor(sel.value);
    pushHistory();
    jp.dcc.push({ name:"", session:"am", pa:1 });
    jpBindRows(sel.value); jpRenderSummary(sel.value);
  };
  if(addN) addN.onclick = ()=>{
    if(!sel.value) return alert("Choose a consultant first.");
    const jp = ensureJobplanFor(sel.value);
    pushHistory();
    jp.nonDcc.push({ name:"", pa:0.5 });
    jpBindRows(sel.value); jpRenderSummary(sel.value);
  };

  // Jobplans import/export
  const exJ = document.getElementById("exportJobplansJSON");
  const imJ = document.getElementById("importJobplansJSON");
  const exC = document.getElementById("exportJobplansCSV");
  const exS = document.getElementById("exportJobplanSummaryCSV");

  if(exJ) exJ.onclick = ()=>{
    const base = safeName(state.rotaTitle || "barkeromatic");
    download(JSON.stringify(state.jobplans||{}, null, 2), `${base}-jobplans-${timestamp()}.json`, "application/json");
  };
  if(imJ) imJ.onchange = (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = ()=>{
      try{
        const jp = JSON.parse(String(r.result));
        pushHistory();
        state.jobplans = jp || {};
        renderJobplans();
        toast("Jobplans imported.");
      }catch(err){ alert("Import failed: "+err.message); }
    };
    r.readAsText(file);
  };

  if(exC) exC.onclick = ()=>{
    const rows = [["consultant","category","name","session","pa_per_week"]];
    state.consultants.forEach(c=>{
      const jp = ensureJobplanFor(c.id);
      (jp.dcc||[]).forEach(r=> rows.push([c.name||"", "DCC", r.name||"", r.session||"", Number(r.pa||0)]));
      (jp.nonDcc||[]).forEach(r=> rows.push([c.name||"", "NonDCC", r.name||"", "", Number(r.pa||0)]));
      rows.push([c.name||"", "OnCall", "", "", Number(jp.oncall?.paPerWeek||0)]);
    });
    const csv = rows.map(r=>r.map(x=>{ x=(x==null)?"":String(x); return (/[,\n\"]/).test(x)? '\"'+x.replace(/\"/g,'\"\"')+'\"' : x; }).join(",")).join("\n");
    const base = safeName(state.rotaTitle || 'barkeromatic');
    download(csv, `${base}-jobplans-${timestamp()}.csv`, "text/csv");
  };

  if(exS) exS.onclick = ()=>{
    const rows = [["consultant","planned_dcc","planned_nondcc","planned_oncall","planned_total","actual_rota","delta"]];
    state.consultants.forEach(c=>{
      const p = jpCalcPlanned(c.id);
      const a = jpCalcActualFromRota(c.id);
      const d = Number((p.total - a).toFixed(2));
      rows.push([c.name||"", p.dcc, p.ndc, p.oc, p.total, Number(a.toFixed(2)), d]);
    });
    const csv = rows.map(r=>r.map(x=>{ x=(x==null)?"":String(x); return (/[,\n\"]/).test(x)? '\"'+x.replace(/\"/g,'\"\"')+'\"' : x; }).join(",")).join("\n");
    const base = safeName(state.rotaTitle || 'barkeromatic');
    download(csv, `${base}-jobplan-summary-${timestamp()}.csv`, "text/csv");
  };
}// --- Jobplans weekend toggle ---
document.addEventListener('DOMContentLoaded', ()=>{
const jpWE = document.getElementById('jpWeekends');
if(jpWE){
  jpWE.checked = !!state.jobsShowWeekends;
  jpWE.onchange = ()=>{ pushHistory(); state.jobsShowWeekends = jpWE.checked; jpRenderConsultantRota(); };
}
    // === Jobplans: week tabs + per-consultant grid ===
function jpRenderWeekTabs(){
  const wrap=document.getElementById('jpWeekTabs');
  if(!wrap) return;
  wrap.innerHTML="";
  wrap.style.display='grid';
  wrap.style.gridTemplateColumns=`repeat(${Math.min(state.cycleWeeks,8)},1fr)`;

  for(let w=1; w<=state.cycleWeeks; w++){
    const b=document.createElement('button');
    b.textContent="week "+w;
    if(w===state.currentWeek) b.classList.add('active');
    b.onclick=()=>{ pushHistory(); state.currentWeek=w; jpRenderConsultantRota(); jpRenderWeekTabs(); };
    wrap.appendChild(b);
  }
}

function jpRenderConsultantRota(){
  const sel = document.getElementById('jpConsultantSelect');
  const cId = sel ? sel.value : "";
  const wD=document.getElementById('jpWD'), wN=document.getElementById('jpWN');
  if(!wD || !wN) return;
  wD.innerHTML=""; wN.innerHTML="";

  const showWE = !!state.jobsShowWeekends;
  const dayIdx = showWE ? [1,2,3,4,5,6,7] : [1,2,3,4,5];
  const dayNames = showWE ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] : ["Mon","Tue","Wed","Thu","Fri"];

  // table headers
  const mkHead = (table)=>{
    const thead=document.createElement('thead');
    const tr=document.createElement('tr');
    ["Area", ...dayNames].forEach(h=>{
      const th=document.createElement('th'); th.textContent=h; tr.appendChild(th);
    });
    thead.appendChild(tr); table.appendChild(thead);
  };
  mkHead(wD); mkHead(wN);

  // one row helper
  const week=state.currentWeek;
  const mkRow=(a,table)=>{
    const tr=document.createElement('tr');

    const nameTd=document.createElement('td');
    const chip=document.createElement('span'); chip.className='areachip'; chip.textContent=a.name; chip.style.background=a.color||"#E5E7EB";
    nameTd.appendChild(chip);
    tr.appendChild(nameTd);

    dayIdx.forEach((d)=>{
      const td=document.createElement('td'); td.className='rota-cell';
      const key=`${a.id}__week${week}__day${d}`;
      const v=state.alloc[key];
      if(v && v===cId){
        const c = state.consultants.find(x=>x.id===cId);
        if(c){
          // same pill style as main rota: dot + initials + name, truncates nicely
          td.innerHTML = `<span class="pill"><span class="dot" style="background:${c.color||"#888"}"></span><span class="txt"><span class="init">${(c.initials||"").toUpperCase()}</span><span class="sep">—</span><span class="name">${c.name||""}</span></span></span>`;
        }
      } else {
        td.innerHTML = "";
      }
      tr.appendChild(td);
    });

    table.appendChild(tr);
  };

  // build DCC then Non-DCC
  state.areas.filter(a=>a.type==="DCC").forEach(a=> mkRow(a,wD));
  state.areas.filter(a=>a.type!=="DCC").forEach(a=> mkRow(a,wN));
}
    renderAll();
  });
});
  renderAll();
})();
