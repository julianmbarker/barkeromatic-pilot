/* RiSE Systems: Barker-o-matic™ v0.9.0 — single-file app logic
   - Sticky rota header (in HTML/CSS)
   - Reliable clear-to-blank in rota cells
   - Jobplans header (pill + initials + name)
   - Jobplans week grid for selected consultant (DCC + Non-DCC)
   - Jobplans “Show weekends” toggle
*/

/* ---------- State ---------- */
const def={
  cycleWeeks:8,
  rotaTitle:"",
  consultants:[],        // [{id,name,initials,color}]
  areas:[],              // [{id,type:"DCC"|"NonDCC",name,color}]
  alloc:{},              // key: `${areaId}__week${w}__day${d}` => consultantId|"__ECL__"|null
  currentWeek:1,
  monFriOnly:false,
  jobplans:{},           // reserved for future
  jobsShowWeekends:false
};

let state = loadState() || structuredClone(def);

function saveState(){ try{ localStorage.setItem('rise.bom.state', JSON.stringify(state)); }catch(e){} }
function loadState(){ try{ const s=localStorage.getItem('rise.bom.state'); return s?JSON.parse(s):null; }catch(e){ return null; } }

/* Undo/redo (simple history) */
const hist=[]; let hi=-1;
function pushHistory(){
  const snap=JSON.stringify(state);
  if(hist[hi]===snap) return;
  hist.splice(hi+1);
  hist.push(snap); hi=hist.length-1;
  saveState();
}
function undo(){ if(hi>0){ hi--; state=JSON.parse(hist[hi]); renderAll(); } }
function redo(){ if(hi<hist.length-1){ hi++; state=JSON.parse(hist[hi]); renderAll(); } }

/* ---------- Helpers ---------- */
function byId(id){ return document.getElementById(id); }
function el(tag, attrs={}, ...kids){
  const n=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{ if(k==="class") n.className=v; else if(k==="style") n.setAttribute("style",v); else n[k]=v; });
  kids.forEach(k=>{ if(typeof k==="string") n.appendChild(document.createTextNode(k)); else if(k) n.appendChild(k); });
  return n;
}
function pillHTML(color, initials, name){
  return `<span class="pill"><span class="dot" style="background:${color||"#888"}"></span><span class="txt"><span class="init">${(initials||"").toUpperCase()}</span><span class="sep">—</span><span class="name">${name||""}</span></span></span>`;
}

/* ---------- Seed demo (only if totally empty) ---------- */
(function seed(){
  if((state.consultants||[]).length===0 && (state.areas||[]).length===0){
    state.consultants=[
      {id:"JMB",name:"Julian Barker",initials:"JMB",color:"#ef4444"},
      {id:"AND",name:"Andy Davies",initials:"AND",color:"#a855f7"},
      {id:"TH", name:"Tim Hayes",initials:"TH",color:"#f59e0b"},
      {id:"IF", name:"Igor Fedor",initials:"IF",color:"#3b82f6"}
    ];
    state.areas=[
      {id:"ctccu", type:"DCC",   name:"CTCCU & MRI SICU", color:"#fca5a5"},
      {id:"card1", type:"DCC",   name:"Cardiac Theatre 1", color:"#fde047"},
      {id:"thor",  type:"DCC",   name:"Thoracic Theatre", color:"#86efac"},
      {id:"teach", type:"NonDCC",name:"Teaching", color:"#c7d2fe"},
      {id:"mgmt",  type:"NonDCC",name:"Management", color:"#f5d0fe"}
    ];
    pushHistory();
  }
})();

/* ---------- UI binding (tabs) ---------- */
function bindTabs(){
  const S=byId('setup'), W=byId('week'), J=byId('jobplans'), D=byId('data');
  const bS=byId('tabSetup'), bW=byId('tabWeek'), bJ=byId('tabJob'), bD=byId('tabData');
  function show(which){
    [S,W,J,D].forEach(s=>s.style.display='none');
    if(which==="setup") S.style.display='';
    if(which==="week")  W.style.display='';
    if(which==="job")   J.style.display='';
    if(which==="data")  D.style.display='';
    [bS,bW,bJ,bD].forEach(b=>b.classList.remove('active'));
    ({setup:bS,week:bW,job:bJ,data:bD}[which]).classList.add('active');
  }
  bS.onclick=()=>show('setup');
  bW.onclick=()=>show('week');
  bJ.onclick=()=>show('job');
  bD.onclick=()=>show('data');
}

/* ---------- Setup (placeholder host: keep your existing editor rendering) ---------- */
function bindSetup(){
  const host=byId('setupHost');
  host.innerHTML='';
  // Minimal summary; your existing editor JS can render richer inputs here.
  host.appendChild(el('div',{}, el('b',{},'Cycle: '), `${state.cycleWeeks} weeks`));
  host.appendChild(el('div',{}, el('b',{},'Consultants: '), String(state.consultants.length)));
  host.appendChild(el('div',{}, el('b',{},'Areas: '), String(state.areas.length)));
}

/* ---------- Week tabs + title ---------- */
function renderWeekTabs(){
  const wrap=byId('weekTabs'); if(!wrap) return; wrap.innerHTML='';
  const max=state.cycleWeeks||8;
  for(let w=1; w<=max; w++){
    const b=el('button',{},`week ${w}`);
    if(w===state.currentWeek) b.classList.add('active');
    b.onclick=()=>{ pushHistory(); state.currentWeek=w; renderWeekTables(); renderTitle(); };
    wrap.appendChild(b);
  }
  const mf=byId('mfOnly'); if(mf){ mf.checked=!!state.monFriOnly; mf.onchange=()=>{ pushHistory(); state.monFriOnly=mf.checked; renderWeekTables(); }; }
}
function renderTitle(){
  const t=byId('titleLoz'); if(!t) return;
  const name = state.rotaTitle ? `${state.rotaTitle} — week ${state.currentWeek}` : `week ${state.currentWeek}`;
  t.textContent = name;
}

/* ---------- Rota tables ---------- */
function renderWeekTables(){
  const wD=byId('wD'), wN=byId('wN'); if(!wD||!wN) return;
  const days=state.monFriOnly?[1,2,3,4,5]:[1,2,3,4,5,6,7];
  const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].slice(0,days.length);

  function buildHead(table){
    const thead=el('thead'), tr=el('tr');
    ["Area", ...names].forEach(h=> tr.appendChild(el('th',{},h)));
    thead.appendChild(tr); table.appendChild(thead);
  }
  function buildBody(table, areas){
    const tbody=el('tbody');
    areas.forEach(a=>{
      const tr=el('tr');
      const nameTd=el('td'); nameTd.appendChild(el('span',{class:'areachip',style:`background:${a.color||'#eee'}`}, a.name)); tr.appendChild(nameTd);
      days.forEach(d=>{
        const td=el('td', {class:'rota-cell'});
        const key=`${a.id}__week${state.currentWeek}__day${d}`;
        td.dataset.key=key;
        paintCell(td, state.alloc[key]||"");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  wD.innerHTML=''; wN.innerHTML='';
  buildHead(wD); buildBody(wD, state.areas.filter(a=>a.type==="DCC"));
  buildHead(wN); buildBody(wN, state.areas.filter(a=>a.type!=="DCC"));
}

/* Paint a rota cell with select + pill, with reliable clear-to-blank */
function paintCell(td, val){
  td.innerHTML='';
  const sel=document.createElement('select');

  // explicit blank always first
  sel.appendChild(new Option("— blank —",""));

  // ECL + consultants
  sel.appendChild(new Option("ECL (unfilled)","__ECL__"));
  state.consultants.forEach(c=>{
    const txt=(c.initials||"") + (c.name && c.name!==c.initials ? " — "+c.name : "");
    sel.appendChild(new Option(txt, c.id));
  });

  td.appendChild(sel);
  const pill=document.createElement('div'); pill.className='pillwrap'; td.appendChild(pill);

  const show = (v)=>{
    if(!v){ sel.value=""; pill.innerHTML=""; return; }
    if(v==="__ECL__"){ sel.value="__ECL__"; pill.innerHTML=pillHTML("#DC2626","ECL","Unfilled"); return; }
    const c=state.consultants.find(x=>x.id===v);
    if(c){ sel.value=c.id; pill.innerHTML=pillHTML(c.color||"#888", c.initials, c.name); }
    else { sel.value=""; pill.innerHTML=""; }
  };
  show(val);

  sel.onchange=()=>{
    const chosen = sel.value;
    const key = td.dataset.key;
    pushHistory();
    state.alloc[key] = chosen ? chosen : null;  // blank => null
    show(state.alloc[key]);
  };

  // click the pill to clear
  pill.addEventListener('click', ()=>{
    const key=td.dataset.key;
    pushHistory();
    state.alloc[key]=null;
    sel.value="";
    pill.innerHTML="";
  });
}

/* ---------- Jobplans ---------- */
function jpRenderHeader(cId){
  const t = byId('jpTitle'); if(!t) return;
  const c = state.consultants.find(x=>x.id===cId);
  if(!c){ t.textContent=""; return; }
  t.innerHTML = `
    <span class="pill">
      <span class="dot" style="background:${c.color||'#999'}"></span>
      <span class="txt"><span class="init">${(c.initials||'').toUpperCase()}</span></span>
    </span>
    <span style="margin-left:8px">Jobplan for <strong>Dr ${c.name||''}</strong></span>
  `;
}

function jpRenderWeekTabs(){
  const wrap=byId('jpWeekTabs'); if(!wrap) return; wrap.innerHTML="";
  wrap.style.display='grid';
  wrap.style.gridTemplateColumns=`repeat(${Math.min(state.cycleWeeks,8)},1fr)`;
  for(let w=1; w<=state.cycleWeeks; w++){
    const b=el('button',{},`week ${w}`);
    if(w===state.currentWeek) b.classList.add('active');
    b.onclick=()=>{ pushHistory(); state.currentWeek=w; jpRenderConsultantRota(); jpRenderWeekTabs(); };
    wrap.appendChild(b);
  }
}

function jpRenderConsultantRota(){
  const selId = state._jpSelectId || state.consultants[0]?.id || "";
  const wD=byId('jpWD'), wN=byId('jpWN'); if(!wD||!wN) return;
  wD.innerHTML=""; wN.innerHTML="";
  const showWE = !!state.jobsShowWeekends;
  const days = showWE ? [1,2,3,4,5,6,7] : [1,2,3,4,5];
  const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].slice(0,days.length);

  const mkHead = (table)=>{
    const thead=el('thead'); const tr=el('tr');
    ["Area", ...names].forEach(h=>tr.appendChild(el('th',{},h)));
    thead.appendChild(tr); table.appendChild(thead);
  };
  mkHead(wD); mkHead(wN);

  const week=state.currentWeek;
  const mkRow=(a,table)=>{
    const tr=el('tr');
    const nameTd=el('td'); nameTd.appendChild(el('span',{class:'areachip',style:`background:${a.color||'#eee'}`}, a.name)); tr.appendChild(nameTd);
    days.forEach(d=>{
      const td=el('td',{class:'rota-cell'});
      const key=`${a.id}__week${week}__day${d}`;
      const v=state.alloc[key];
      if(v && v===selId){
        const c = state.consultants.find(x=>x.id===selId);
        td.innerHTML = pillHTML(c?.color||"#888", c?.initials||"", c?.name||"");
      } else {
        td.innerHTML = "";
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  };

  state.areas.filter(a=>a.type==="DCC").forEach(a=> mkRow(a,wD));
  state.areas.filter(a=>a.type!=="DCC").forEach(a=> mkRow(a,wN));

  jpRenderHeader(selId);
}

/* ----- renderJobplans shell (keeps your existing selector if present) ----- */
function renderJobplans(){
  // If your build renders a Consultant dropdown, listen for it here:
  // We’ll remember the chosen consultant id in state._jpSelectId
  const sel = document.querySelector('#jobplans select[data-role="jp-consultant"]');
  if(sel){
    if(state._jpSelectId) sel.value = state._jpSelectId;
    sel.onchange = ()=>{ state._jpSelectId = sel.value; pushHistory(); jpRenderHeader(sel.value); jpRenderWeekTabs(); jpRenderConsultantRota(); };
    if(!state._jpSelectId && sel.value) state._jpSelectId = sel.value;
  }else{
    // fallback: pick first consultant if none selected
    if(!state._jpSelectId && state.consultants[0]) state._jpSelectId = state.consultants[0].id;
  }

  // bind weekends toggle
  const jpWE = byId('jpWeekends');
  if(jpWE){
    jpWE.checked = !!state.jobsShowWeekends;
    jpWE.onchange = ()=>{ pushHistory(); state.jobsShowWeekends = jpWE.checked; jpRenderConsultantRota(); };
  }

  jpRenderWeekTabs();
  jpRenderConsultantRota();
}

/* ---------- Full render ---------- */
function renderConsultants(){ /* keep your existing UI; summary only to avoid breaking */ }
function renderAreas(){ /* keep your existing UI; summary only to avoid breaking */ }

function renderAll(){
  bindTabs();
  bindSetup();
  renderConsultants();
  renderAreas();
  renderWeekTabs();
  renderWeekTables();
  renderTitle();
  renderJobplans();
}

/* ---------- Startup ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  pushHistory();       // capture initial
  renderAll();
});
