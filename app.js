/* RiSE Systems: Barker-o-matic™ v0.9.1
   - Setup page = simple editor (cycle, consultants, areas)
   - Rota area chips fixed (pills)
   - Rota cell clear-to-blank reliable
   - Jobplans grid + weekends toggle
*/

const def={
  cycleWeeks:8,
  rotaTitle:"",
  consultants:[],           // [{id,name,initials,color}]
  areas:[],                 // [{id,type:"DCC"|"NonDCC",name,color}]
  alloc:{},                 // key: areaId__weekW__dayD => consultantId|"__ECL__"|null
  currentWeek:1,
  monFriOnly:false,
  jobplans:{},
  jobsShowWeekends:false,
  _jpSelectId:null
};

let state = loadState() || structuredClone(def);
function saveState(){ try{ localStorage.setItem('rise.bom.state', JSON.stringify(state)); }catch(e){} }
function loadState(){ try{ const s=localStorage.getItem('rise.bom.state'); return s?JSON.parse(s):null; }catch(e){ return null; } }

/* history */
const hist=[]; let hi=-1;
function pushHistory(){ const s=JSON.stringify(state); if(hist[hi]===s) return; hist.splice(hi+1); hist.push(s); hi=hist.length-1; saveState(); }
function undo(){ if(hi>0){ hi--; state=JSON.parse(hist[hi]); renderAll(); } }
function redo(){ if(hi<hist.length-1){ hi++; state=JSON.parse(hist[hi]); renderAll(); } }

/* helpers */
const byId=(id)=>document.getElementById(id);
function el(tag, attrs={}, ...kids){
  const n=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{ if(k==="class") n.className=v; else if(k==="style") n.setAttribute("style",v); else n[k]=v; });
  kids.forEach(k=>{ if(typeof k==="string") n.appendChild(document.createTextNode(k)); else if(k) n.appendChild(k); });
  return n;
}
const pillHTML=(color, initials, name)=>`
  <span class="pill"><span class="dot" style="background:${color||"#888"}"></span>
  <span class="txt"><span class="init">${(initials||"").toUpperCase()}</span><span class="sep">—</span><span class="name">${name||""}</span></span></span>`;

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
  }
})();

/* ---------- Setup editor ---------- */
function bindTabs(){
  const S=byId('setup'), W=byId('week'), J=byId('jobplans'), D=byId('data');
  const bS=byId('tabSetup'), bW=byId('tabWeek'), bJ=byId('tabJob'), bD=byId('tabData');
  const show=(which)=>{
    [S,W,J,D].forEach(x=>x.style.display='none');
    ({setup:S,week:W,job:J,data:D}[which].style.display='');
    [bS,bW,bJ,bD].forEach(b=>b.classList.remove('active'));
    ({setup:bS,week:bW,job:bJ,data:bD}[which]).classList.add('active');
  };
  bS.onclick=()=>show('setup');
  bW.onclick=()=>show('week');
  bJ.onclick=()=>show('job');
  bD.onclick=()=>show('data');
}

function renderSetup(){
  const host=byId('setupHost'); host.innerHTML='';
  /* Cycle */
  const cyc=el('div',{}, el('b',{},'Cycle (weeks): '),
    Object.assign(el('input',{type:'number',min:1,max:15,value:state.cycleWeeks}),{
      oninput:(e)=>{ pushHistory(); state.cycleWeeks=parseInt(e.target.value||'8',10); renderWeekTabs(); renderTitle(); }
    })
  );
  host.appendChild(cyc);

  /* Consultants editor */
  host.appendChild(el('h3',{},'Consultants'));
  const cTable=el('table',{class:'grid'});
  cTable.appendChild(el('thead',{}, el('tr',{}, el('th',{},'#'), el('th',{},'Name'), el('th',{},'Initials'), el('th',{},'Colour'), el('th',{},'') )));
  const cBody=el('tbody');
  (state.consultants||[]).forEach((c,i)=>{
    const tr=el('tr',{},
      el('td',{},String(i+1)),
      el('td',{}, Object.assign(el('input',{type:'text',value:c.name}), {oninput:(e)=>{c.name=e.target.value; pushHistory();}})),
      el('td',{}, Object.assign(el('input',{type:'text',value:c.initials}), {oninput:(e)=>{c.initials=e.target.value; pushHistory();}})),
      el('td',{}, Object.assign(el('input',{type:'color',value:c.color||'#888888'}), {oninput:(e)=>{c.color=e.target.value; pushHistory(); renderWeekTables(); jpRenderConsultantRota();}})),
      el('td',{}, Object.assign(el('button',{class:'miniBtn'},'Delete'), {onclick:()=>{ pushHistory(); state.consultants.splice(i,1); renderSetup(); renderWeekTables(); jpRenderConsultantRota(); }}) )
    );
    cBody.appendChild(tr);
  });
  cTable.appendChild(cBody);
  host.appendChild(cTable);
  host.appendChild(Object.assign(el('button',{class:'btn'},'+ Add consultant'),{
    onclick:()=>{ pushHistory(); state.consultants.push({id:genId(),name:'New Consultant',initials:'XX',color:'#888888'}); renderSetup(); }
  }));

  /* Areas editor */
  host.appendChild(el('h3',{},'Areas'));
  const aTable=el('table',{class:'grid'});
  aTable.appendChild(el('thead',{}, el('tr',{}, el('th',{},'#'), el('th',{},'Type'), el('th',{},'Area name'), el('th',{},'Colour'), el('th',{},''))));
  const aBody=el('tbody');
  (state.areas||[]).forEach((a,i)=>{
    const tr=el('tr',{},
      el('td',{},String(i+1)),
      el('td',{}, (()=>{
        const s=el('select',{}, el('option',{},'DCC'), el('option',{},'NonDCC'));
        s.value=a.type; s.onchange=(e)=>{ a.type=e.target.value; pushHistory(); renderWeekTables(); }; return s;
      })()),
      el('td',{}, Object.assign(el('input',{type:'text',value:a.name}), {oninput:(e)=>{a.name=e.target.value; pushHistory(); renderWeekTables();}})),
      el('td',{}, Object.assign(el('input',{type:'color',value:a.color||'#eeeeee'}), {oninput:(e)=>{a.color=e.target.value; pushHistory(); renderWeekTables(); jpRenderConsultantRota();}})),
      el('td',{}, Object.assign(el('button',{class:'miniBtn'},'Delete'), {onclick:()=>{ pushHistory(); state.areas.splice(i,1); renderSetup(); renderWeekTables(); jpRenderConsultantRota(); }}) )
    );
    aBody.appendChild(tr);
  });
  aTable.appendChild(aBody);
  host.appendChild(aTable);
  host.appendChild(Object.assign(el('button',{class:'btn'},'+ Add area'),{
    onclick:()=>{ pushHistory(); state.areas.push({id:genId(),type:'DCC',name:'New area',color:'#eeeeee'}); renderSetup(); renderWeekTables(); }
  }));
}
const genId=()=>Math.random().toString(36).slice(2,7).toUpperCase();

/* ---------- Rota ---------- */
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

function renderWeekTables(){
  const wD=byId('wD'), wN=byId('wN'); if(!wD||!wN) return;
  const days=state.monFriOnly?[1,2,3,4,5]:[1,2,3,4,5,6,7];
  const names=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].slice(0,days.length);

  function head(table){
    const thead=el('thead'), tr=el('tr'); ["Area",...names].forEach(h=>tr.appendChild(el('th',{},h)));
    thead.appendChild(tr); table.appendChild(thead);
  }
  function body(table, areas){
    const tbody=el('tbody');
    areas.forEach(a=>{
      const tr=el('tr');
      const nameTd=el('td');
      nameTd.appendChild(el('span',{class:'areachip',style:`background:${a.color||'#eee'}`}, a.name));
      tr.appendChild(nameTd);
      days.forEach(d=>{
        const td=el('td',{class:'rota-cell'}); const key=`${a.id}__week${state.currentWeek}__day${d}`;
        td.dataset.key=key; paintCell(td, state.alloc[key]||""); tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  wD.innerHTML=''; wN.innerHTML='';
  head(wD); body(wD, state.areas.filter(a=>a.type==="DCC"));
  head(wN); body(wN, state.areas.filter(a=>a.type!=="DCC"));
}

function paintCell(td, val){
  td.innerHTML='';
  const sel=document.createElement('select');
  sel.appendChild(new Option("— blank —",""));
  sel.appendChild(new Option("ECL (unfilled)","__ECL__"));
  state.consultants.forEach(c=>{
    const txt=(c.initials||"") + (c.name && c.name!==c.initials ? " — "+c.name : "");
    sel.appendChild(new Option(txt, c.id));
  });
  td.appendChild(sel);
  const pill=document.createElement('div'); pill.className='pillwrap'; td.appendChild(pill);

  const show=(v)=>{
    if(!v){ sel.value=""; pill.innerHTML=""; return; }
    if(v==="__ECL__"){ sel.value="__ECL__"; pill.innerHTML=pillHTML("#DC2626","ECL","Unfilled"); return; }
    const c=state.consultants.find(x=>x.id===v);
    if(c){ sel.value=c.id; pill.innerHTML=pillHTML(c.color||"#888", c.initials, c.name); }
    else { sel.value=""; pill.innerHTML=""; }
  };
  show(val);

  sel.onchange=()=>{
    const chosen=sel.value; const key=td.dataset.key; pushHistory();
    state.alloc[key]=chosen?chosen:null; show(state.alloc[key]);
  };
  pill.addEventListener('click',()=>{
    const key=td.dataset.key; pushHistory(); state.alloc[key]=null; sel.value=""; pill.innerHTML="";
  });
}

/* ---------- Jobplans ---------- */
function jpRenderHeader(cId){
  const t=byId('jpTitle'); if(!t) return;
  const c=state.consultants.find(x=>x.id===cId);
  t.innerHTML = c ? `
    <span class="pill"><span class="dot" style="background:${c.colorful
