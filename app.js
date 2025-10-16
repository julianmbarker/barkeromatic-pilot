/* RiSE Systems: Barker-o-matic™ — app.js (v0.8.1 full replacement)
   - Rota editor (DCC / Non-DCC)
   - Jobplans (consultant view, weekends toggle)
   - Import/Export JSON & CSV
   - Undo/Redo, persisted state (localStorage)
*/

(function(){
  "use strict";

  // -------- Boot badge ----------
  const boot = document.getElementById('boot');
  const stamp = new Date().toTimeString().slice(0,8);
  if (boot) { boot.textContent = `JS OK @ ${stamp}`; }
  const bootbar = document.getElementById('bootbar');
  if (bootbar) {
    bootbar.classList.add('show');
    bootbar.textContent = `Boot: all systems go ✅ @ ${stamp}`;
  }

  // -------- Local state ----------
  const KEY = "rise-barkeromatic-v081";
  const def = {
    cycleWeeks: 8,
    rotaTitle: "",
    consultants: [],
    areas: [],
    alloc: {},            // keys: `${areaId}__week${n}__day${d}` -> consultantKey (id|initials|name) or "ECL"
    currentWeek: 1,
    monFriOnly: false,
    // Jobplans extras:
    jobsShowWeekends: false,
    _jpSelectId: null
  };

  let state = load();
  const undoStack = [];
  const redoStack = [];

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
  function pushHistory(){
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    save();
    saved();
  }
  function saved(){
    save();
    const b = document.getElementById('savedBadge');
    if (b){ b.style.opacity = .6; setTimeout(()=>{ b.style.opacity = .6; }, 150); }
  }
  function toast(msg){
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 1500);
  }
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function cKey(c){ return String((c.id || c.initials || c.name || "")).trim(); }

  // -------- Bind header tabs / actions ----------
  function bindSetup(){
    // Tabs
    document.querySelectorAll('.tab').forEach(btn=>{
      btn.onclick = ()=>{
        document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        ['setup','week','jobs','data'].forEach(id=>{
          const sec = document.getElementById(id);
          if (sec) sec.style.display = (btn.dataset.tab === id || (btn.dataset.tab==='week' && id==='week') || (btn.dataset.tab==='jobs' && id==='jobs')) ? '' : 'none';
        });
      };
    });

    // Undo/Redo
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if(undoBtn) undoBtn.onclick = ()=>{
      if (!undoStack.length) return;
      redoStack.push(JSON.stringify(state));
      state = JSON.parse(undoStack.pop());
      save(); renderAll(); renderJobplans();
    };
    if(redoBtn) redoBtn.onclick = ()=>{
      if (!redoStack.length) return;
      undoStack.push(JSON.stringify(state));
      state = JSON.parse(redoStack.pop());
      save(); renderAll(); renderJobplans();
    };

    // Top Export / Import (full)
    const exportTop = document.getElementById('exportTop');
    const importTop = document.getElementById('importTop');
    if(exportTop) exportTop.onclick = ()=>downloadJSON(state, 'barkeromatic-all.json');
    if(importTop) importTop.onchange = e=>{
      const f = e.target.files[0]; if(!f) return;
      const r = new FileReader();
      r.onload = ()=>{
        try{
          pushHistory();
          const incoming = JSON.parse(String(r.result));
          state = Object.assign({}, def, incoming);
          save(); renderAll(); renderJobplans();
          toast('Imported.');
        }catch(err){ alert('Import failed: '+err.message); }
      };
      r.readAsText(f);
      e.target.value = "";
    };

    // Weeks selector + title on Setup
    const weeksSel = document.getElementById('weeks');
    if(weeksSel){
      weeksSel.innerHTML = "";
      for(let i=1;i<=15;i++){
        const o = document.createElement('option');
        o.value = i; o.textContent = i;
        if(i===Number(state.cycleWeeks||8)) o.selected = true;
        weeksSel.appendChild(o);
      }
      weeksSel.onchange = ()=>{
        pushHistory();
        state.cycleWeeks = Number(weeksSel.value||8);
        // Clamp currentWeek
        if(state.currentWeek > state.cycleWeeks) state.currentWeek = state.cycleWeeks;
        renderWeekTabs(); renderWeekTables();
        renderJobplans();
      };
    }
    const titleInput = document.getElementById('rotaTitle');
    if(titleInput){
      titleInput.value = state.rotaTitle || "";
      titleInput.oninput = ()=>{
        state.rotaTitle = titleInput.value;
        save();
        renderTitle();
      };
    }
  }

  // -------- Consultants ----------
  function renderConsultants(){
    const tbody = document.querySelector('#ctable tbody');
    const count = document.getElementById('ccount');
    if(!tbody) return;
    tbody.innerHTML = "";
    (state.consultants||[]).forEach((c, idx)=>{
      const tr = document.createElement('tr');

      // #
      const tdHash = document.createElement('td'); tdHash.textContent = String(idx+1);
      tr.appendChild(tdHash);

      // Name
      const tdN = document.createElement('td');
      const inpN = document.createElement('input'); inpN.value = c.name || "";
      inpN.oninput = ()=>{ c.name = inpN.value; save(); renderWeekTables(); renderJobplans(); };
      tdN.appendChild(inpN);
      tr.appendChild(tdN);

      // Initials
      const tdI = document.createElement('td');
      const inpI = document.createElement('input'); inpI.value = c.initials || "";
      inpI.oninput = ()=>{ c.initials = inpI.value; save(); renderWeekTables(); renderJobplans(); };
      tdI.appendChild(inpI);
      tr.appendChild(tdI);

      // Colour
      const tdC = document.createElement('td');
      const inpC = document.createElement('input'); inpC.type = "color"; inpC.value = c.color || "#888888";
      inpC.oninput = ()=>{ c.color = inpC.value; save(); renderWeekTables(); renderJobplans(); };
      tdC.appendChild(inpC);
      tr.appendChild(tdC);

      // Delete
      const tdDel = document.createElement('td');
      const btnDel = document.createElement('button');
      btnDel.className="btn ghost"; btnDel.textContent = "Delete";
      btnDel.onclick = ()=>{
        pushHistory();
        state.consultants.splice(idx,1);
        save(); renderConsultants(); renderWeekTables(); renderJobplans();
      };
      tdDel.appendChild(btnDel);
      tr.appendChild(tdDel);

      tbody.appendChild(tr);

      // Ensure a stable key
      if(!c.id) c.id = `c-${uid()}`;
    });

    if(count) count.textContent = `(${state.consultants.length})`;

    const add = document.getElementById('addConsultant');
    if(add){
      add.onclick = ()=>{
        pushHistory();
        state.consultants.push({ id:`c-${uid()}`, name:"", initials:"", color:"#888888" });
        save(); renderConsultants(); renderJobplans();
      };
    }

    // Export/Import (Consultants)
    const exJ = document.getElementById('exportConsultantsJSON');
    const exC = document.getElementById('exportConsultantsCSV');
    const imJ = document.getElementById('importConsultantsJSON');
    const imC = document.getElementById('importConsultantsCSV');
    if(exJ) exJ.onclick = ()=>downloadJSON(state.consultants||[], 'consultants.json');
    if(exC) exC.onclick = ()=>{
      const rows = [["name","initials","color"]];
      (state.consultants||[]).forEach(c=>rows.push([c.name||"", c.initials||"", c.color||""]));
      downloadText(csv(rows), 'consultants.csv', 'text/csv');
    };
    if(imJ) imJ.onchange = e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader();
      r.onload=()=>{ try{
        pushHistory();
        const arr = JSON.parse(String(r.result));
        (arr||[]).forEach(x=>{ if(!x.id) x.id=`c-${uid()}`; });
        state.consultants = arr||[];
        save(); renderConsultants(); renderWeekTables(); renderJobplans();
      }catch(err){ alert('Consultants JSON import failed: '+err.message); } };
      r.readAsText(f); e.target.value="";
    };
    if(imC) imC.onchange = e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader();
      r.onload=()=>{ try{
        pushHistory();
        const rows = parseCSV(String(r.result));
        const out=[];
        for(let i=1;i<rows.length;i++){
          const [name,initials,color] = rows[i];
          if((name||"").trim().length===0) continue;
          out.push({id:`c-${uid()}`, name, initials, color: color||"#888888"});
        }
        state.consultants = out;
        save(); renderConsultants(); renderWeekTables(); renderJobplans();
      }catch(err){ alert('Consultants CSV import failed: '+err.message); } };
      r.readAsText(f); e.target.value="";
    };
  }

  // -------- Areas ----------
  function renderAreas(){
    const dBody = document.querySelector('#dcct tbody');
    const nBody = document.querySelector('#ndcct tbody');
    if(dBody) dBody.innerHTML = "";
    if(nBody) nBody.innerHTML = "";
    const dcc = (state.areas||[]).filter(a=>a.type==="DCC");
    const ndc = (state.areas||[]).filter(a=>a.type!=="DCC");

    function rowFor(area, idx, body, isDCC){
      const tr = document.createElement('tr');

      // #
      const tdH = document.createElement('td'); tdH.textContent = String(idx+1); tr.appendChild(tdH);

      // Name
      const tdN = document.createElement('td');
      const inpN = document.createElement('input'); inpN.value = area.name||"";
      inpN.oninput = ()=>{ area.name = inpN.value; save(); renderWeekTables(); };
      tdN.appendChild(inpN); tr.appendChild(tdN);

      if(isDCC){
        // Session
        const tdS = document.createElement('td');
        const sel = document.createElement('select');
        ["am","pm","eve"].forEach(s=>{
          const o=document.createElement('option'); o.value=s; o.textContent=s; if((area.session||"am")===s) o.selected=true; sel.appendChild(o);
        });
        sel.onchange = ()=>{ area.session=sel.value; save(); };
        tdS.appendChild(sel);
        tr.appendChild(tdS);
      }

      // PA
      const tdP = document.createElement('td');
      const num = document.createElement('input'); num.type="number"; num.step="0.25"; num.value = area.pa==null?1:area.pa;
      num.oninput = ()=>{ area.pa = Number(num.value||0); save(); };
      tdP.appendChild(num); tr.appendChild(tdP);

      // Colour
      const tdC = document.createElement('td');
      const col = document.createElement('input'); col.type="color"; col.value = area.color || "#eaeaea";
      col.oninput = ()=>{ area.color = col.value; save(); renderWeekTables(); renderJobplans(); };
      tdC.appendChild(col); tr.appendChild(tdC);

      // Delete
      const tdD = document.createElement('td');
      const del = document.createElement('button'); del.className="btn ghost"; del.textContent="Delete";
      del.onclick = ()=>{
        pushHistory();
        state.areas = state.areas.filter(a=>a.id!==area.id);
        // also clear any allocations for this area
        Object.keys(state.alloc).forEach(k=>{ if(k.startsWith(area.id+"__")) delete state.alloc[k]; });
        save(); renderAreas(); renderWeekTables(); renderJobplans();
      };
      tdD.appendChild(del); tr.appendChild(tdD);

      body.appendChild(tr);
    }

    dcc.forEach((a,i)=>rowFor(a,i,dBody,true));
    ndc.forEach((a,i)=>rowFor(a,i,nBody,false));

    const addD = document.getElementById('addDCC');
    const addN = document.getElementById('addNonDCC');
    if(addD) addD.onclick = ()=>{
      pushHistory();
      state.areas.push({ id:`dcc-${uid()}`, type:"DCC", name:"", session:"am", pa:1, color:"#eee" });
      save(); renderAreas(); renderWeekTables(); renderJobplans();
    };
    if(addN) addN.onclick = ()=>{
      pushHistory();
      state.areas.push({ id:`ndcc-${uid()}`, type:"NonDCC", name:"", pa:1, color:"#eee" });
      save(); renderAreas(); renderWeekTables(); renderJobplans();
    };
  }

  // -------- Week tabs & title ----------
  function renderWeekTabs(){
    const wraps = document.querySelectorAll('#weekTabs');
    wraps.forEach(wrap=>{
      wrap.innerHTML = "";
      const max = Number(state.cycleWeeks||8);
      for(let w=1; w<=max; w++){
        const b=document.createElement('button');
        b.textContent = `week ${w}`;
        if(w===Number(state.currentWeek||1)) b.classList.add('active');
        b.onclick = ()=>{ pushHistory(); state.currentWeek = w; save(); renderWeekTabs(); renderWeekTables(); renderJobplans(); };
        wrap.appendChild(b);
      }
    });
  }
  function renderTitle(){
    const t = document.getElementById('titleLoz');
    if(t){
      const title = state.rotaTitle || "Rota";
      t.textContent = `${title} — week ${state.currentWeek}`;
    }
  }

  // -------- Rota tables (week editor) ----------
  function dayNames(){
    return state.monFriOnly ? ["Area","Mon","Tue","Wed","Thu","Fri"] : ["Area","Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  }
  function dayIndices(){
    return state.monFriOnly ? [1,2,3,4,5] : [1,2,3,4,5,6,7];
    // Monday=1 .. Sunday=7
  }
  function consultantOptions(){
    const opts = [{value:"", label:"— blank —"}];
    opts.push({value:"ECL", label:"ECL"});
    (state.consultants||[]).forEach(c=>{
      const v = cKey(c);
      const label = `${(c.initials||"").toUpperCase()} — ${c.name||""}`.trim();
      opts.push({value:v, label});
    });
    return opts;
  }
  function pillHTML(val){
    if(!val) return `<span class="smallpill">— blank —</span>`;
    if(val==="ECL") return `<Paste-over app.js>`
