/* ============================================================
   ⬇️⬇️⬇️  PEGÁ ACÁ TUS DATOS DE SUPABASE  ⬇️⬇️⬇️
   Los sacás de: Supabase → Project Settings → API
   (ver la GUÍA, Parte 1, paso 8)
   ============================================================ */
const SUPABASE_URL = "https://rxserrwtacbzvnsrfcqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Uueli_cwTBHqc-3qwAOBMw_hEfpJX3i";
/* ============================================================
   ⬆️⬆️⬆️  NO TOQUES NADA MÁS ABAJO  ⬆️⬆️⬆️
   ============================================================ */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let sbUser = null, remoteReady = false;

const KEY='panel_alquileres_v1';
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
let state=load(), currentTab='mes', ym=ymNow();
let mesQuery='', mesOwner='all', mesSoloImpagos=false, dashOwner='all', ownerFilterCtx='mes';

function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.duenos){if(!s.config)s.config={onboarded:s.deptos&&s.deptos.length>0,organizador:{nombre:'',tel:''},pin:'',cobranza:{diasRecordar:5,diasReclamar:10}};if(!s.config.organizador)s.config.organizador={nombre:'',tel:''};if(!s.config.cobranza)s.config.cobranza={diasRecordar:5,diasReclamar:10};(s.deptos||[]).forEach(d=>{if(d.estado==='publicado'){d.estado='vacio';d.publicando=true;}d.expensas=true;if(!d.diaVencimiento)d.diaVencimiento=10;if(!d.moneda)d.moneda='ARS';if(!Array.isArray(d.serviciosList)){d.serviciosList=d.servicios?['agua','luz','gas']:[];}d.servicios=d.serviciosList.length>0;
      d.inqApellido=capName(d.inqApellido);d.inqNombre=capName(d.inqNombre);if(d.inqApellido||d.inqNombre)d.inquilino=(d.inqApellido+(d.inqNombre?', '+d.inqNombre:'')).trim();});
    // Capitalizar dueños y fusionar duplicados por apellido+nombre
    (s.duenos||[]).forEach(o=>{o.apellido=capName(o.apellido);o.nombre=capName(o.nombre);});
    const byKey={},remap={},kept=[];(s.duenos||[]).forEach(o=>{const key=((o.apellido||'')+'|'+(o.nombre||'')).toLowerCase();if(key==='|'){kept.push(o);return;}if(byKey[key]!=null){remap[o.id]=byKey[key];}else{byKey[key]=o.id;kept.push(o);}});
    s.duenos=kept;(s.deptos||[]).forEach(d=>{if(remap[d.duenoId])d.duenoId=remap[d.duenoId];});
    return s;}}catch(e){}return {duenos:[],deptos:[],pagos:{},alquileres:[],config:{onboarded:false,organizador:{nombre:'',tel:''},pin:'',cobranza:{diaVencimiento:10}}};}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){console.warn('localStorage write failed:',e);}
  setSaveStatus(navigator.onLine?'saving':'offline');
  pushRemote();
}
let saveStatusT;
function setSaveStatus(st){
  const el=document.getElementById('saveStatus');if(!el)return;
  clearTimeout(saveStatusT);
  el.className='save-status '+st;
  el.textContent = st==='saving' ? 'Guardando…' : st==='offline' ? '⚠️ Sin conexión' : '✓ Guardado';
  if(st==='saved')saveStatusT=setTimeout(()=>{el.className='save-status';},2500);
}
let pushT;
function pushRemote(){
  if(!sbUser||!remoteReady){if(!sbUser&&navigator.onLine)setSaveStatus('saved');return;}
  clearTimeout(pushT);
  pushT=setTimeout(async()=>{
    if(!navigator.onLine){setSaveStatus('offline');return;}
    try{
      const {error}=await sb.from('panel_data').upsert({user_id:sbUser.id,data:state,updated_at:new Date().toISOString()});
      if(error)throw error;
      setSaveStatus('saved');
    }catch(e){console.warn('No se pudo guardar:',e);setSaveStatus('offline');}
  },700);
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

function ymNow(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function ymLabel(v){const[y,m]=v.split('-');return MESES[+m-1]+' '+y;}
function shiftYm(v,n){let[y,m]=v.split('-').map(Number);m+=n;while(m<1){m+=12;y--;}while(m>12){m-=12;y++;}return y+'-'+String(m).padStart(2,'0');}
function monthsBetween(a,b){const[ay,am]=a.split('-').map(Number);const[by,bm]=b.split('-').map(Number);return (by-ay)*12+(bm-am);}
const money=n=>(n<0?'-':'')+'$'+new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(Math.abs(Math.round(n||0)));
function curMoney(dep,n){const s=money(n);return (dep&&dep.moneda==='USD')?s.replace('$','US$'):s;}
function esc(s){return(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function capName(s){return (s||'').trim().toLowerCase().split(/\s+/).map(w=>w?w.charAt(0).toUpperCase()+w.slice(1):w).join(' ');}
function diaVenc(dep){const d=dep&&dep.diaVencimiento;const cfg=(state.config&&state.config.cobranza)||{};return d||cfg.diaVencimiento||10;}
function diaHoy(){return new Date().getDate();}
const digits=t=>(t||'').replace(/[^0-9]/g,'');
function owner(id){return state.duenos.find(d=>d.id===id);}
function ownerName(id){const o=owner(id);if(!o)return 'Sin dueño';return o.apellido?(o.apellido+(o.nombre?', '+o.nombre:'')):(o.nombre||'Sin nombre');}
function comision(dep){if(dep.modalidad==='dueno')return 0;return (alquilerEnMes(dep)||0)*(dep.comisionPct||0)/100;}
/* ¿El depto estaba alquilado durante el mes que se está viendo? */
function activoEnMes(dep,m){m=m||ym;const ini=ymOf(dep.contratoInicio);if(!ini)return true;if(cmpYm(m,ini)<0)return false;if(dep.contratoFin){const fin=ymOf(dep.contratoFin);if(cmpYm(m,fin)>0)return false;}return true;}
/* Alquiler vigente en un mes dado (según los ajustes aplicados hasta ese mes) */
function alquilerEnMes(dep,m){m=m||ym;let rent=dep.alquilerInicial!=null?dep.alquilerInicial:(dep.alquiler||0);const ajs=(dep.ajustes||[]).slice().sort((a,b)=>a.ym<b.ym?-1:1);for(const a of ajs){if(cmpYm(a.ym,m)<=0)rent=a.nuevo;}return rent;}
function pagos(deptoId){const m=state.pagos[ym]||{};return m[deptoId]||{alq:false,exp:false,ser:false};}
function setPago(deptoId,k){if(!state.pagos[ym])state.pagos[ym]={};if(!state.pagos[ym][deptoId])state.pagos[ym][deptoId]={alq:false,exp:false,ser:false};const cell=state.pagos[ym][deptoId];cell[k]=!cell[k];if(k==='alq'){if(cell.alq){cell.fecha=(ym===ymNow())?new Date().toISOString().slice(0,10):(ym+'-01');}else{delete cell.fecha;}}save();render();}
function serviciosDe(dep){return (dep.serviciosList&&dep.serviciosList.length)?dep.serviciosList:(dep.servicios?['agua','luz','gas']:[]);}
function servPagos(dep,m){m=m||ym;const cell=(state.pagos[m]||{})[dep.id]||{};const lista=serviciosDe(dep);const total=lista.length;if(!total)return{done:0,total:0,allPaid:true};let done=0;lista.forEach(k=>{const val=cell.serv?cell.serv[k]:(cell.ser===true);if(val)done++;});return{done,total,allPaid:done>=total};}
function setServ(deptoId,k){if(!state.pagos[ym])state.pagos[ym]={};if(!state.pagos[ym][deptoId])state.pagos[ym][deptoId]={alq:false,exp:false,ser:false};const cell=state.pagos[ym][deptoId];if(!cell.serv){cell.serv={};if(cell.ser===true){const d0=state.deptos.find(d=>d.id===deptoId);serviciosDe(d0).forEach(x=>cell.serv[x]=true);}}cell.serv[k]=!cell.serv[k];const dep=state.deptos.find(d=>d.id===deptoId);cell.ser=servPagos(dep).allPaid;save();}
function openServicios(depId){const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;const lista=serviciosDe(dep);if(!lista.length){toast('Esta propiedad no tiene servicios cargados');return;}
  openSheet(`<h3>Servicios de ${esc(dep.nombre)}</h3><p class="hint">Marcá los que ya pagó el inquilino este mes (${ymLabel(ym)}).</p><div id="serv_rows"></div><button class="btn btn-primary" style="margin-top:12px" onclick="closeSheet();render()">Listo</button>`);
  refreshServSheet(depId);
}
function refreshServSheet(depId){const dep=state.deptos.find(d=>d.id===depId);const cell=(state.pagos[ym]||{})[depId]||{};const lista=serviciosDe(dep);const cont=document.getElementById('serv_rows');if(!cont)return;cont.innerHTML=lista.map(k=>{const on=cell.serv?cell.serv[k]:(cell.ser===true);return `<button class="serv-row ${on?'on':''}" onclick="setServ('${depId}','${k}');refreshServSheet('${depId}')">${servLabel(k)}<span>${on?'✓ Pagó':'Pendiente'}</span></button>`;}).join('');}
function setFechaPago(deptoId,fecha){if(!state.pagos[ym])state.pagos[ym]={};if(!state.pagos[ym][deptoId])state.pagos[ym][deptoId]={alq:false,exp:false,ser:false};state.pagos[ym][deptoId].fecha=fecha;state.pagos[ym][deptoId].alq=true;save();render();}
/* Días hábiles (lu-vi) desde el 1º hasta una fecha YYYY-MM-DD dada */
function habilesHasta(fecha){if(!fecha)return null;const[y,m,d]=fecha.split('-').map(Number);let c=0;for(let dd=1;dd<=d;dd++){const wd=new Date(y,m-1,dd).getDay();if(wd!==0&&wd!==6)c++;}return c;}
function openFechaPago(depId){const c=(state.pagos[ym]||{})[depId]||{};const f=c.fecha||(ym+'-01');
  openSheet(`<h3>Fecha de pago</h3><p class="hint">¿Qué día pagó el alquiler de ${ymLabel(ym)}?</p>
    <div class="field"><label>Fecha</label><input id="fp_fecha" type="date" value="${f}"></div>
    <div class="sheet-actions"><button class="btn btn-ghost" onclick="closeSheet()">Cancelar</button><button class="btn btn-primary" onclick="(function(){const v=document.getElementById('fp_fecha').value;if(v){setFechaPago('${depId}',v);closeSheet();}})()">Guardar</button></div>`);
}
/* Historial de puntualidad del inquilino de un depto (usa solo meses con fecha real) */
function historialPago(dep){
  const con=[];Object.keys(state.pagos).sort().forEach(m=>{const c=(state.pagos[m]||{})[dep.id];if(c&&c.alq&&c.fecha){const dc=parseInt(c.fecha.split('-')[2]);if(!isNaN(dc))con.push(dc);}});
  const umbral=diaVenc(dep);
  const prom=con.length?con.reduce((a,b)=>a+b,0)/con.length:null;
  const tarde=con.filter(x=>x>umbral).length;
  const max=con.length?Math.max(...con):null;
  return {n:con.length,prom,tarde,max,umbral};
}
function badgePagador(h){
  if(!h||h.n===0)return{txt:'Sin historial',cls:'est-ok'};
  if(h.tarde===0)return{txt:'Puntual',cls:'est-ok'};
  if(h.tarde<=1&&h.prom<=h.umbral)return{txt:'Normal',cls:'est-warn'};
  return{txt:'Paga tarde',cls:'est-bad'};
}
function estaAlDia(dep){const p=pagos(dep.id);return p.alq&&(!dep.expensas||p.exp)&&servPagos(dep).allPaid;}
function ajustePendiente(dep){if(!dep.contratoInicio||!dep.ajusteMeses)return false;const els=monthsBetween(ymOf(dep.contratoInicio),ym);if(els<=0||els%dep.ajusteMeses!==0)return false;return !(dep.ajustes||[]).some(a=>a.ym===ym);}
/* ¿El mes que se ve tuvo aumento de IPC para este depto? */
function ajusteDelMes(dep,m){m=m||ym;return (dep.ajustes||[]).find(a=>a.ym===m);}

/* Estado de ocupación / vencimiento (relativo al mes REAL) */
function ocupacion(dep){
  const e=dep.estado||'alquilado';
  if(e==='vacio'||e==='publicado')return{code:'vacio',label:dep.publicando?'Vacío · publicando':'Vacío — publicá ya',cls:dep.publicando?'est-warn':'est-bad',urg:3,ml:null};
  const ml=dep.contratoFin?monthsBetween(ymNow(),ymOf(dep.contratoFin)):null;
  if(ml===null)return{code:'ok',label:'Alquilado',cls:'est-ok',urg:0,ml:null};
  if(ml<0)return{code:'vencido',label:'Contrato vencido',cls:'est-bad',urg:3,ml};
  if(ml===0)return{code:'vence',label:'Vence este mes',cls:'est-bad',urg:2,ml};
  if(ml<=3)return{code:'porvencer',label:'Vence en '+ml+(ml===1?' mes':' meses'),cls:'est-warn',urg:1,ml};
  return{code:'ok',label:'Vence en '+ml+' meses',cls:'est-ok',urg:0,ml};
}
function pipeline(){return state.deptos.map(d=>({dep:d,oc:ocupacion(d)})).filter(x=>x.oc.urg>0).sort((a,b)=>b.oc.urg-a.oc.urg||((a.oc.ml==null?99:a.oc.ml)-(b.oc.ml==null?99:b.oc.ml)));}

function go(tab){
  currentTab=tab;
  document.querySelectorAll('.tab').forEach(t=>{
    const on=t.dataset.tab===tab;
    t.classList.toggle('active',on);
    if(on)t.setAttribute('aria-current','page');
    else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el=document.getElementById('view-'+tab);
  if(el)el.classList.add('active');
  const titles={mes:'Este mes',deptos:'Propiedades',duenos:'Dueños',garantes:'Garantes',alquileres:'Vencimientos',dashboard:'Dashboard'};
  const ht=document.getElementById('headTitle');if(ht)ht.textContent=titles[tab]||'';
  render();
}
function changeMonth(n){ym=shiftYm(ym,n);render();}
function goToday(){ym=ymNow();render();toast('Mes actual');}

function render(){
  document.getElementById('monthLabel').innerHTML=ymLabel(ym);
  renderMonthBarDesktop();
  if(currentTab==='mes')renderMes();
  if(currentTab==='deptos')renderDeptos();
  if(currentTab==='duenos')renderDuenos();
  if(currentTab==='garantes')renderGarantes();
  if(currentTab==='alquileres')renderAlquileres();
  if(currentTab==='dashboard')renderDashboard();
}
// Barra de meses estilo línea de tiempo (solo visible en desktop vía CSS).
// Solo inyección visual: reutiliza helpers de fecha existentes, no cambia la lógica.
function pickMonth(v){ym=v;render();}
function renderMonthBarDesktop(){
  const cont=document.getElementById('monthBarDesktop');if(!cont)return;
  const now=ymNow();
  const meses=[now,shiftYm(now,-1),shiftYm(now,-2)];
  const capitalize=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const etiqueta=v=>{const[y,m]=v.split('-');return v===now?'Este mes':capitalize(MESES[+m-1]);};
  let btns=meses.map(v=>`<button type="button" class="mbd-pill ${ym===v?'on':''}" onclick="pickMonth('${v}')">${etiqueta(v)}</button>`).join('');
  // Si el mes visible no es ninguno de los tres, se agrega como pill activa extra
  if(!meses.includes(ym)){btns+=`<button type="button" class="mbd-pill on" onclick="pickMonth('${ym}')">${capitalize(MESES[+ym.split('-')[1]-1])+' '+ym.split('-')[0]}</button>`;}
  btns+=`<button type="button" class="mbd-hist" onclick="openHistorial()" aria-label="Ver historial de meses">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>
    Historial</button>`;
  cont.innerHTML=btns;
}
function openHistorial(){
  const now=ymNow();
  let items='';
  for(let i=0;i<18;i++){const v=shiftYm(now,-i);const[y,m]=v.split('-');const lbl=(i===0?'Este mes · ':'')+MESES[+m-1].charAt(0).toUpperCase()+MESES[+m-1].slice(1)+' '+y;items+=`<button type="button" class="hist-item ${ym===v?'on':''}" onclick="pickMonth('${v}');closeSheet();">${lbl}${ym===v?' ✓':''}</button>`;}
  openSheet(`<h3>Elegí un mes</h3><div class="hist-list">${items}</div>`);
}

function renderMes(){
  const el=document.getElementById('view-mes');
  if(state.deptos.length===0){el.innerHTML=empty('&#127968;','Todavía no cargaste propiedades.','Agregá el primero desde la pestaña “Propiedades”.');return;}
  const activos=state.deptos.filter(d=>activoEnMes(d));
  const cobrado={ARS:0,USD:0},faltaCobrar={ARS:0,USD:0},comTotal={ARS:0,USD:0};let alDia=0;
  activos.forEach(dep=>{
    if(estaAlDia(dep))alDia++;
    const p=pagos(dep.id);const rent=alquilerEnMes(dep);const cur=dep.moneda||'ARS';const c=dep.modalidad!=='dueno'?rent*(dep.comisionPct||0)/100:0;
    if(p.alq){if(dep.modalidad!=='dueno'){comTotal[cur]+=c;cobrado[cur]+=rent;}}
    else{faltaCobrar[cur]+=rent;}
  });
  const pct=activos.length?Math.round(alDia/activos.length*100):0;
  const alqSinCobrar=activos.filter(d=>!pagos(d.id).alq&&activoEnMes(d)).length;
  const alqTotal=activos.filter(d=>activoEnMes(d)&&(d.estado||'alquilado')==='alquilado').length;
  const todoCobrado=alqSinCobrar===0&&alqTotal>0;
  if(!alqSinCobrar&&mesSoloImpagos)mesSoloImpagos=false;
  const sinCobrarStat=alqSinCobrar?`<button type="button" class="stat warn stat-btn${mesSoloImpagos?' on':''}" onclick="toggleImpagos()" aria-pressed="${mesSoloImpagos}"><div class="k">${mesSoloImpagos?'Mostrando solo sin cobrar':'Sin cobrar este mes'}</div><div class="v" style="font-size:15px">${alqSinCobrar} ${alqSinCobrar===1?'propiedad':'propiedades'}</div><div class="stat-link">${mesSoloImpagos?'✓ ver todas':'ver cuáles ›'}</div></button>`:'';
  let html=`<div class="summary${alqSinCobrar?' has4':''}">
    <div class="stat pos"><div class="k">Cobrado</div><div class="v" style="font-size:15px">${dualStr(cobrado)}</div></div>
    <div class="stat ${alqSinCobrar?'warn':'pos'}"><div class="k">Pendiente de cobro ${alqSinCobrar}/${alqTotal}</div><div class="v" style="font-size:15px">${alqSinCobrar===0?'✓ Todo cobrado':dualStr(faltaCobrar)}</div></div>
    <div class="stat"><div class="k">Tu comisión</div><div class="v" style="font-size:15px">${dualStr(comTotal)}</div></div>
    ${sinCobrarStat}
  </div>`;

  let critCount=0;activos.forEach(d=>{if(cobranza(d).nivel==='critico')critCount++;});
  if(critCount){html+=`<div class="alert alert-red"><span class="txt">🔴 ${critCount} ${critCount===1?'pago crítico — corresponde reclamar a la garantía':'pagos críticos — corresponde reclamar a la garantía'}</span></div>`;}

  // Filtro de dueños: desplegable simple (cómodo con muchos dueños)
  const ownerFilter=ownerFilterBtn(mesOwner,'mes');
  html+=`<div class="controls"><input id="mesSearch" placeholder="Buscar propiedad o inquilino…" value="${esc(mesQuery)}" oninput="onMesSearch(this.value)"></div>
  ${ownerFilter}
  <div class="progress"><span>Al día ${alDia}/${activos.length}</span><span class="bar"><i style="width:${pct}%"></i></span><span>${pct}%</span></div>`;

  let list=activos.filter(dep=>{
    if(mesOwner!=='all'&&dep.duenoId!==mesOwner)return false;
    if(mesSoloImpagos&&pagos(dep.id).alq)return false;
    if(mesQuery){const q=mesQuery.toLowerCase();if(!((dep.nombre||'').toLowerCase().includes(q)||(dep.inquilino||'').toLowerCase().includes(q)))return false;}
    return true;
  });
  if(list.length===0){html+=empty('&#128269;','Sin propiedades alquiladas este mes.','Cambiá de mes o de filtro.');el.innerHTML=html;return;}
  const cardHtml=dep=>{
    const p=pagos(dep.id);const cb=cobranza(dep);const[ptxt,pcls]=PILL[cb.nivel]||PILL.pendiente;
    const vencido=cb.nivel==='critico';
    const puedeRecordar=(cb.nivel==='recordar'||cb.nivel==='pendiente')&&dep.telInquilino;
    const wa=puedeRecordar?`<a class="contact contact-amber" href="https://wa.me/${digits(dep.telInquilino)}?text=${encodeURIComponent(reminderText(dep,'recordar'))}" target="_blank" rel="noopener">${WA_SVG} Recordar pago al inquilino</a>`:'';
    const mailGar=(vencido&&dep.garantiaMail)?`<a class="contact contact-red" href="${mailtoGar(dep)}" target="_blank" rel="noopener">${GMAIL_SVG} Avisar a la garantía</a>`:'';
    const efAj=ajusteDelMes(dep,ym);
    const infoChip=efAj?`<span class="chip-info" aria-hidden="true">i</span>`:'';
    const proxYm=shiftYm(ym,1);const avisoAj=(dep.ajustes||[]).find(a=>a.ym===proxYm);
    const mostrarAviso=avisoAj&&ym===ymNow()&&diaHoy()>=15;
    const avisoCard=mostrarAviso?`<button type="button" class="aviso-aumento" onclick="openAjusteInfo('${dep.id}','${proxYm}')" aria-label="Ver y avisar el aumento por IPC de ${esc(dep.nombre)} para ${ymLabel(proxYm)}">📈 <b>Corresponde aumentar el mes que viene</b> (${ymLabel(proxYm)}): +${avisoAj.pct.toFixed(1)}% por IPC → ${curMoney(dep,avisoAj.nuevo)}. Avisale ahora al inquilino. <span class="edit-link">ver y enviar</span></button>`:'';
    const efInfo=efAj?`<button type="button" class="aj-info-line" onclick="openAjusteInfo('${dep.id}','${efAj.ym}')" aria-label="Ver detalle del aumento por IPC de ${esc(dep.nombre)}">📈 Este mes rige el aumento por IPC: +${efAj.pct.toFixed(1)}% · ${curMoney(dep,efAj.anterior)} → ${curMoney(dep,efAj.nuevo)}</button>`:'';
    const rent=alquilerEnMes(dep);
    const alqChip=`<button class="chip ${p.alq?'paid':''}" onclick="setPago('${dep.id}','alq')"><div class="lbl">Alquiler ${infoChip}</div><div class="amt">${curMoney(dep,rent)}</div><div class="mk">${p.alq?'✓ Pagó':'Pendiente'}</div></button>`;
    const sp=servPagos(dep);const lista=serviciosDe(dep);
    const serChip=lista.length?`<button class="chip ${sp.allPaid?'paid':'chip-due'}" onclick="openServicios('${dep.id}')"><div class="lbl">Servicios</div><div class="amt" style="color:var(--muted);font-size:11px">${sp.done}/${sp.total} · tocá</div><div class="mk">${sp.allPaid?'✓ Pagó':'Pendiente'}</div></button>`:`<div class="chip na"><div class="lbl">Servicios</div><div class="amt">—</div></div>`;
    let fechaLine='';
    if(p.alq){const dc=p.fecha?parseInt(p.fecha.split('-')[2]):null;const due=diaVenc(dep);const fstr=p.fecha?p.fecha.split('-').reverse().join('/'):'—';const tag=dc!=null?(dc<=due?'<span style="color:var(--green)">a tiempo</span>':'<span style="color:var(--red)">tarde (día '+dc+')</span>'):'';fechaLine=`<button type="button" class="pago-fecha" onclick="openFechaPago('${dep.id}')" aria-label="Editar la fecha de pago de ${esc(dep.nombre)}">🗓️ Pagó el <b>${fstr}</b>${tag?' · '+tag:''} <span class="edit-link">editar</span></button>`;}
    return `<div class="card">
      <div class="card-top">
        <div><div class="card-name">${esc(dep.nombre)}</div>
        <div class="card-sub">${esc(dep.inquilino||'Sin inquilino')}</div></div>
        <span class="paid-pill ${pcls}">${ptxt}</span>
      </div>
      <div class="chips">
        ${alqChip}
        ${chip(dep,'exp','Expensas',null,p.exp,!dep.expensas,true)}
        ${serChip}
      </div>
      ${fechaLine}
      ${avisoCard}
      ${efInfo}
      ${(wa||mailGar)?`<div class="wa-row">${wa}${mailGar}</div>`:''}
    </div>`;
  };
  const grupos={};list.forEach(d=>{(grupos[d.duenoId]=grupos[d.duenoId]||[]).push(d);});
  const oidsOrdenados=Object.keys(grupos).sort((a,b)=>ownerName(a).localeCompare(ownerName(b)));
  oidsOrdenados.forEach(oid=>{
    const deps=grupos[oid].sort((a,b)=>{const sa=estaAlDia(a)?1:0,sb=estaAlDia(b)?1:0;return sa-sb||(a.nombre||'').localeCompare(b.nombre||'');});
    html+=`<h2 class="section-name">${esc(ownerName(oid))} · ${deps.length} ${deps.length===1?'propiedad':'propiedades'}</h2><div class="cards">`;
    deps.forEach(dep=>{html+=cardHtml(dep);});
    html+='</div>';
  });
  el.innerHTML=html;
}
function onMesSearch(v){mesQuery=v;renderMes();const i=document.getElementById('mesSearch');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}}
function toggleImpagos(){mesSoloImpagos=!mesSoloImpagos;renderMes();}
function onMesOwner(v){mesOwner=v;renderMes();}
function openRenovar(depId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;
  let baseEnd=(dep.contratoFin&&cmpYm(ymOf(dep.contratoFin),ymNow())>=0)?dep.contratoFin:new Date().toISOString().slice(0,10);
  const[y,m,d]=baseEnd.split('-').map(Number);const nd=new Date(y+3,m-1,d);nd.setDate(nd.getDate()-1);
  const sug=nd.getFullYear()+'-'+String(nd.getMonth()+1).padStart(2,'0')+'-'+String(nd.getDate()).padStart(2,'0');
  openSheet(`<h3>Renovar contrato</h3><p class="hint">${esc(dep.nombre)} · ${esc(dep.inquilino||'')}</p>
    <p class="sub" style="margin-top:2px">Sigue el mismo inquilino y alquiler; solo se extiende la fecha de fin. Los aumentos por IPC continúan su curso normal.</p>
    <div class="field"><label for="rv_fin">Nueva fecha de fin</label><input id="rv_fin" type="date" value="${sug}"></div>
    <div class="sheet-actions"><button class="btn btn-ghost" onclick="closeSheet()">Cancelar</button><button class="btn btn-primary" onclick="guardarRenovacion('${depId}')">Renovar</button></div>`);
}
function guardarRenovacion(depId){const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;const v=document.getElementById('rv_fin').value;if(!v){toast('Elegí la nueva fecha de fin');return;}dep.contratoFin=v;dep.estado='alquilado';save();closeSheet();render();toast('Contrato renovado hasta '+v.split('-').reverse().join('/'));}
function onDashOwner(v){dashOwner=v;renderDashboard();}
function ownerFilterBtn(current,ctx){
  const label=current==='all'?'Todos los dueños':ownerName(current);
  return `<div class="controls" style="margin-top:8px"><button type="button" class="owner-filter-btn" onclick="openOwnerFilter('${ctx}')" aria-label="Filtrar por dueño. Actual: ${esc(label)}"><span class="ofb-ico" aria-hidden="true">👤</span><span class="ofb-label">${esc(label)}</span><span class="ofb-caret" aria-hidden="true">▾</span></button></div>`;
}
function openOwnerFilter(ctx){
  ownerFilterCtx=ctx;
  openSheet(`<h3>Elegí un dueño</h3>
    <div class="field" style="margin-top:8px"><input id="of_search" type="text" placeholder="Buscar dueño…" oninput="renderOwnerFilterList()" aria-label="Buscar dueño"></div>
    <div id="of_list" class="of-list"></div>`);
  setTimeout(()=>{const i=document.getElementById('of_search');if(i)i.focus();},60);
  renderOwnerFilterList();
}
function renderOwnerFilterList(){
  const ctx=ownerFilterCtx;const current=ctx==='mes'?mesOwner:dashOwner;
  const q=(document.getElementById('of_search')||{}).value||'';const qq=q.trim().toLowerCase();
  const conDeptos=state.duenos.filter(o=>state.deptos.some(d=>d.duenoId===o.id)).slice().sort((a,b)=>ownerName(a.id).localeCompare(ownerName(b.id)));
  const items=[{id:'all',name:'Todos los dueños',n:state.deptos.length}]
    .concat(conDeptos.filter(o=>!qq||ownerName(o.id).toLowerCase().includes(qq)).map(o=>({id:o.id,name:ownerName(o.id),n:state.deptos.filter(d=>d.duenoId===o.id).length})));
  const cont=document.getElementById('of_list');if(!cont)return;
  cont.innerHTML=items.map(it=>`<button type="button" class="of-item ${current===it.id?'on':''}" onclick="pickOwnerFilter('${it.id}')">
      <span class="of-name">${it.id==='all'?'👥 ':''}${esc(it.name)}</span>
      <span class="of-count">${it.n} ${it.n===1?'depto':'deptos'}${current===it.id?' ✓':''}</span></button>`).join('')
      ||'<div class="hint" style="padding:8px">Sin resultados.</div>';
}
function pickOwnerFilter(id){const ctx=ownerFilterCtx;closeSheet();if(ctx==='mes'){mesOwner=id;renderMes();}else{dashOwner=id;renderDashboard();}}
function ownerSelectHtml(current,onchangeFn){
  const conDeptos=state.duenos.filter(o=>state.deptos.some(d=>d.duenoId===o.id)).slice().sort((a,b)=>ownerName(a.id).localeCompare(ownerName(b.id)));
  const opts=['<option value="all"'+(current==='all'?' selected':'')+'>👥 Todos los dueños</option>']
    .concat(conDeptos.map(o=>`<option value="${o.id}"${current===o.id?' selected':''}>${esc(ownerName(o.id))}</option>`)).join('');
  return `<div class="controls" style="margin-top:8px"><select class="owner-select" onchange="${onchangeFn}(this.value)">${opts}</select></div>`;
}
function chip(dep,k,lbl,amt,paid,na,noAmount){if(na)return `<div class="chip na"><div class="lbl">${lbl}</div><div class="amt">—</div></div>`;const amtHtml=noAmount?`<div class="amt" style="color:var(--muted);font-size:11px">${k==='ser'?'agua·luz·gas':'pago/no pago'}</div>`:`<div class="amt">${money(amt)}</div>`;return `<button class="chip ${paid?'paid':(k!=='alq'?'chip-due':'')}" onclick="setPago('${dep.id}','${k}')"><div class="lbl">${lbl}</div>${amtHtml}<div class="mk">${paid?'✓ Pagó':'Pendiente'}</div></button>`;}

function renderDuenos(){
  const el=document.getElementById('view-duenos');
  if(state.duenos.length===0){el.innerHTML=empty('&#128101;','No hay dueños cargados.','Agregalos desde la pestaña “Propiedades”.');return;}
  let html='<div class="cards">',any=false;
  state.duenos.forEach(d=>{
    const deps=state.deptos.filter(x=>x.duenoId===d.id&&activoEnMes(x));if(deps.length===0)return;any=true;
    const cobrado={ARS:0,USD:0},com={ARS:0,USD:0},neto={ARS:0,USD:0},pendLiq={ARS:0,USD:0},masa={ARS:0,USD:0};const rows=[],transferidos=[];let pendTransf=0,cobrados=0,gestionables=0;
    deps.forEach(dep=>{const p=pagos(dep.id);const rent=alquilerEnMes(dep);const cur=dep.moneda||'ARS';const c=dep.modalidad==='dueno'?0:rent*(dep.comisionPct||0)/100;
      if(dep.modalidad!=='dueno'){masa[cur]+=rent;gestionables++;}
      if(dep.modalidad==='dueno'){
        rows.push(`<div class="mini-row"><span>${esc(dep.nombre)} · directo</span><span>administra el dueño</span></div>`);
      }else if(p.alq){
        com[cur]+=c;cobrado[cur]+=rent;neto[cur]+=rent-c;cobrados++;
        const cell=(state.pagos[ym]||{})[dep.id]||{};const tr=cell.transf;const monto=montoTransfer(dep);
        if(!tr){pendTransf++;pendLiq[cur]+=monto;}else{transferidos.push({dep,monto});}
        const ctrl=tr
          ? `<button class="transf-chip on" onclick="openTransferir('${dep.id}')" aria-label="Transferencia hecha a ${esc(ownerName(dep.duenoId))} por ${esc(dep.nombre)}. Tocá para ver o deshacer.">✓ Transferido</button>`
          : `<button class="transf-chip" onclick="openTransferir('${dep.id}')" aria-label="Marcar que le transferiste al dueño el alquiler de ${esc(dep.nombre)}">Marcar transferido</button>`;
        rows.push(`<div class="mini-row mini-row-transf"><div class="mr-info"><span class="mr-name">${esc(dep.nombre)}</span><span class="mr-amt">${tr?'Transferido · ':'Le transferís '}${curMoney(dep,monto)}</span></div>${ctrl}</div>`);
      }else{
        rows.push(`<div class="mini-row mini-row-transf"><div class="mr-info"><span class="mr-name">${esc(dep.nombre)}</span><span class="mr-amt" style="color:var(--muted)">sin cobrar todavía</span></div></div>`);
      }
    });
    let waMsg='Hola'+(d.nombre?' '+d.nombre:'')+'!';
    if(transferidos.length){
      const tot={ARS:0,USD:0};transferidos.forEach(t=>{tot[t.dep.moneda||'ARS']+=t.monto;});
      waMsg+=' Te detallo lo que te transferí de '+ymLabel(ym)+':\n'+transferidos.map(t=>'• '+t.dep.nombre+': '+curMoney(t.dep,t.monto)).join('\n')+'\nTotal transferido: '+dualStr(tot)+'.\nCualquier cosa avisame. ¡Saludos!'+firmaOrg();
    }else{waMsg+=' ¿Cómo estás?';}
    const wa=d.telefono?`<a class="contact" href="https://wa.me/${digits(d.telefono)}?text=${encodeURIComponent(waMsg)}" target="_blank" rel="noopener" aria-label="Abrir WhatsApp con ${esc(ownerName(d.id))}">${WA_SVG} WhatsApp</a>`:'';
    const transfBadge=cobrados?`<span class="owner-tag ${pendTransf?'tag-warn':'tag-ok'}">${cobrados-pendTransf}/${cobrados} transferido${cobrados===1?'':'s'}</span>`:'';
    const hayPend=(pendLiq.ARS>0||pendLiq.USD>0);
    const heroCls=hayPend?'liq-hero pend':(cobrados?'liq-hero done':'liq-hero none');
    const heroTxt=hayPend?dualStr(pendLiq):(cobrados?'Todo liquidado':'Nada cobrado aún');
    const heroSub=hayPend?`Le falta liquidar este mes${pendTransf?` · ${pendTransf} ${pendTransf===1?'propiedad':'propiedades'} pendiente${pendTransf===1?'':'s'}`:''}`:(cobrados?'Ya le transferiste todo lo cobrado ✓':'Cuando cobres, vas a ver acá cuánto liquidarle');
    const metaLine=`<div class="owner-meta">${dualStr(masa)} en alquileres · ${cobrados}/${gestionables} cobrado${gestionables===1?'':'s'}${(com.ARS||com.USD)?' · comisión '+dualStr(com):''}</div>`;
    html+=`<div class="card owner-card">
      <div class="card-top owner-top">
        <div><div class="card-name">${esc(ownerName(d.id))}</div>${metaLine}</div>
        <span class="owner-tag">${deps.length} ${deps.length===1?'propiedad':'propiedades'}</span>
        <div class="owner-hero-wrap"><div class="${heroCls}"><div class="liq-hero-k">${hayPend?'💸 Falta liquidar':(cobrados?'✅ Al día':'—')}</div><div class="liq-hero-v">${heroTxt}</div><div class="liq-hero-sub">${heroSub}</div></div>${wa}</div>
      </div>
      <details class="liq-details"><summary>Ver detalle del mes ${transfBadge}</summary>
        <div class="liq-summary">
          <div class="liq-line"><span>Alquileres cobrados (pasan por vos)</span><span>${dualStr(cobrado)}</span></div>
          <div class="liq-line"><span>Tu comisión</span><span class="pos">${dualStr(com)}</span></div>
          <div class="liq-line tot"><span>Total a liquidar (cobrado)</span><span>${dualStr({ARS:Math.max(0,neto.ARS),USD:Math.max(0,neto.USD)})}</span></div>
        </div>
        <div class="transf-head">Transferencias al dueño (${ymLabel(ym)})</div>
        <div class="mini-list">${rows.join('')}</div>
      </details>
    </div>`;
  });
  html+='</div>';
  el.innerHTML=any?html:empty('&#128101;','Los dueños todavía no tienen propiedades asignadas.','Asignalos desde “Propiedades”.');
}
function montoTransfer(dep,m){m=m||ym;const rent=alquilerEnMes(dep,m);const c=dep.modalidad==='dueno'?0:rent*(dep.comisionPct||0)/100;const cell=(state.pagos[m]||{})[dep.id]||{};const desc=cell.transfDesc||0;return Math.max(0,rent-c-desc);}

// SVG logos para botones de contacto
const WA_SVG=`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.849L.073 23.629a.75.75 0 0 0 .92.92l5.757-1.463A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.717 9.717 0 0 1-4.953-1.353l-.355-.211-3.668.932.949-3.542-.232-.366A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>`;
const GMAIL_SVG=`<span class="gmail-badge"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/></svg></span>`;

function marcarAjusteNotificado(depId){
  const m=ymNow();if(!state.pagos[m])state.pagos[m]={};if(!state.pagos[m][depId])state.pagos[m][depId]={alq:false,exp:false,ser:false};
  state.pagos[m][depId].ajusteNotificado=true;
  save();renderDashboard();toast('Marcado como notificado');
}
function openTransferir(depId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;
  const cell=(state.pagos[ym]||{})[depId]||{};const yaHecho=!!cell.transf;const desc=cell.transfDesc||0;
  const rent=alquilerEnMes(dep);const c=dep.modalidad==='dueno'?0:rent*(dep.comisionPct||0)/100;
  const recalc=()=>{const dv=parseFloat(document.getElementById('tr_desc').value)||0;const monto=Math.max(0,rent-c-dv);document.getElementById('tr_monto').textContent=curMoney(dep,monto);};
  openSheet(`
    <h3 id="sheet-title">Transferencia al dueño</h3>
    <p class="hint">${esc(dep.nombre)} · ${esc(ownerName(dep.duenoId))} · ${ymLabel(ym)}</p>
    <div class="card" style="box-shadow:none;border:1px solid var(--line)">
      <div class="liq-line"><span>Alquiler cobrado</span><span>${curMoney(dep,rent)}</span></div>
      <div class="liq-line"><span>Menos tu comisión (${dep.comisionPct||0}%)</span><span class="neg">- ${curMoney(dep,c)}</span></div>
      <div class="field" style="margin-top:10px"><label for="tr_desc">Descuento extraordinario <span style="color:var(--muted);font-weight:400">— opcional (ej: expensas extraordinarias que pagó el inquilino)</span></label><input id="tr_desc" type="number" inputmode="numeric" min="0" placeholder="0" value="${desc||''}" oninput="(function(){var dv=parseFloat(this.value)||0;var monto=Math.max(0,${rent}-${c}-dv);document.getElementById('tr_monto').textContent='';})()" onkeyup="trRecalc('${depId}')" onchange="trRecalc('${depId}')"></div>
      <div class="liq-line tot"><span>Le transferís</span><span id="tr_monto">${curMoney(dep,Math.max(0,rent-c-desc))}</span></div>
    </div>
    <div class="sheet-actions" style="margin-top:12px;flex-wrap:wrap">
      ${yaHecho?`<button class="btn btn-ghost btn-sm" onclick="desmarcarTransfer('${depId}')">Deshacer</button>`:''}
      <button class="btn btn-ghost btn-sm" onclick="closeSheet()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="marcarTransfer('${depId}')">${yaHecho?'Guardar y avisar':'Marcar transferido y avisar'}</button>
    </div>`);
  setTimeout(()=>{const i=document.getElementById('tr_desc');if(i)i.focus();},60);
}
function trRecalc(depId){const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;const rent=alquilerEnMes(dep);const c=dep.modalidad==='dueno'?0:rent*(dep.comisionPct||0)/100;const dv=parseFloat(document.getElementById('tr_desc').value)||0;const monto=Math.max(0,rent-c-dv);const el=document.getElementById('tr_monto');if(el)el.textContent=curMoney(dep,monto);}
function marcarTransfer(depId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;
  if(!state.pagos[ym])state.pagos[ym]={};if(!state.pagos[ym][depId])state.pagos[ym][depId]={alq:false,exp:false,ser:false};
  const dv=parseFloat((document.getElementById('tr_desc')||{}).value)||0;
  const cell=state.pagos[ym][depId];cell.transf=true;cell.transfDesc=dv;cell.transfFecha=new Date().toISOString().slice(0,10);
  save();
  const monto=montoTransfer(dep);const dueno=owner(dep.duenoId);
  closeSheet();render();
  if(dueno&&dueno.telefono){const msg=msgTransfer(dep,monto);window.open('https://wa.me/'+digits(dueno.telefono)+'?text='+encodeURIComponent(msg),'_blank','noopener');}
  else toast('Marcado transferido. Cargá el teléfono del dueño para poder avisarle.');
}
function desmarcarTransfer(depId){if(!state.pagos[ym]||!state.pagos[ym][depId])return;const cell=state.pagos[ym][depId];cell.transf=false;delete cell.transfDesc;delete cell.transfFecha;save();closeSheet();render();toast('Transferencia desmarcada');}
function msgTransfer(dep,monto){const dueno=owner(dep.duenoId);const nombre=dueno&&dueno.nombre?' '+dueno.nombre:'';return 'Hola'+nombre+'! Te transferí el alquiler de '+dep.nombre+' correspondiente a '+ymLabel(ym)+': '+curMoney(dep,monto)+'. Cualquier cosa avisame. ¡Saludos!'+firmaOrg();}

function renderGarantes(){
  const el=document.getElementById('view-garantes');
  if(!el)return;
  const alquilados=state.deptos.filter(d=>(d.estado||'alquilado')==='alquilado'&&d.garantiaEmpresa);
  if(!alquilados.length){el.innerHTML=empty('🛡️','No hay garantías cargadas.','Al cargar una propiedad con inquilino podés indicar la empresa de garantía de caución.');return;}
  const grupos={};
  alquilados.forEach(dep=>{
    const key=(dep.garantiaEmpresa||'').trim().toLowerCase();const label=dep.garantiaEmpresa.trim();
    if(!grupos[key])grupos[key]={label,mail:dep.garantiaMail||'',deptos:[],reclamos:0,alqTotal:{ARS:0,USD:0}};
    const cb=cobranza(dep);const enReclamo=cb.nivel==='critico';
    if(enReclamo)grupos[key].reclamos++;
    const rent=alquilerEnMes(dep);const cur=dep.moneda||'ARS';grupos[key].alqTotal[cur]+=rent;
    grupos[key].deptos.push({dep,enReclamo,cb});
    if(!grupos[key].mail&&dep.garantiaMail)grupos[key].mail=dep.garantiaMail;
  });
  let html='<div class="cards">';
  Object.values(grupos).sort((a,b)=>b.deptos.length-a.deptos.length).forEach(g=>{
    const total=g.deptos.length;const masaStr=dualStr(g.alqTotal);
    const badge=g.reclamos?`<span class="gar-badge-red">${g.reclamos} en reclamo</span>`:`<span class="gar-badge-ok">${total} activo${total===1?'':'s'}</span>`;
    const enRec=g.deptos.filter(x=>x.enReclamo);
    let mailBtn='';
    if(g.mail&&enRec.length){
      const subj='Reclamo de pago — '+(enRec.length===1?enRec[0].dep.nombre:enRec.length+' propiedades con atraso');
      const body='Hola!\n\nLes escribo para informar '+(enRec.length===1?'un atraso de pago en una propiedad':'atrasos de pago en '+enRec.length+' propiedades')+' con garantía de caución de '+g.label+':\n\n'
        +enRec.map(({dep})=>'• '+dep.nombre+'\n  Inquilino: '+(dep.inquilino||'—')+'\n  Adeuda: '+itemsAdeuda(dep)+' de '+ymLabel(ym)+'\n  Alquiler mensual: '+curMoney(dep,alquilerEnMes(dep))).join('\n\n')
        +'\n\nPor favor avancen con el procedimiento correspondiente. Quedo a disposición por cualquier consulta.\n\nGracias.'+firmaOrg();
      mailBtn=`<a class="contact contact-red" href="https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(g.mail)}&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}" target="_blank" rel="noopener" aria-label="Notificar reclamo a ${esc(g.label)}">${GMAIL_SVG} Notificar reclamo (${enRec.length})</a>`;
    }
    const filas=g.deptos.map(({dep,enReclamo})=>{
      const pill=enReclamo?'pill-debt':'pill-ok';const pillTxt=enReclamo?'Atrasado':'Al día';
      const rent=alquilerEnMes(dep);const mailReclamo=enReclamo&&dep.garantiaMail?`<a class="gar-action-mail" href="${mailtoGar(dep)}" aria-label="Avisar reclamo por ${esc(dep.nombre)}">${GMAIL_SVG} Avisar</a>`:'';
      return `<div class="gar-row"><div class="gar-row-info"><span class="gar-row-name">${esc(dep.nombre)}</span><span class="gar-row-inq">${esc(dep.inquilino||'Sin inquilino')} · ${curMoney(dep,rent)}/mes</span></div><div class="gar-row-right"><span class="paid-pill ${pill}">${pillTxt}</span>${mailReclamo}</div></div>`;
    }).join('');
    const totalAct=g.deptos.filter(x=>!x.enReclamo).length;
    const tasaReclamo=total?Math.round(g.reclamos/total*100):0;
    const insightTasa=total>=3?`<div class="gar-insight">📊 Tasa de reclamo con <b>${esc(g.label)}</b>: <b>${tasaReclamo}%</b> (${g.reclamos} de ${total}). ${tasaReclamo>25?'⚠️ Relativamente alto — puede valer la pena revisar.':tasaReclamo>0?'Dentro de lo normal.':'Sin reclamos hasta ahora ✓'}</div>`:'';
    html+=`<div class="card gar-card">
      <div class="card-top"><div><div class="card-name">${esc(g.label)}</div><div class="card-sub">${masaStr} en alquileres cubiertos</div></div>${badge}</div>
      <div class="gar-stats">
        <div class="gar-stat"><div class="gar-stat-v">${total}</div><div class="gar-stat-k">propiedades</div></div>
        <div class="gar-stat"><div class="gar-stat-v">${totalAct}</div><div class="gar-stat-k">al día</div></div>
        <div class="gar-stat ${g.reclamos?'red':''}"><div class="gar-stat-v">${g.reclamos}</div><div class="gar-stat-k">en reclamo</div></div>
        <div class="gar-stat"><div class="gar-stat-v">${masaStr}</div><div class="gar-stat-k">masa cubierta</div></div>
      </div>
      ${insightTasa}
      <details class="gar-details"><summary>Ver detalle de las propiedades (${total})</summary><div class="gar-list">${filas}</div></details>
      ${mailBtn}
    </div>`;
  });
  html+='</div>';el.innerHTML=html;
}

function _alquileresData(){
  const withOc=state.deptos.map(d=>({dep:d,oc:ocupacion(d)}));
  const sinAlquilar=withOc.filter(x=>x.oc.code==='vacio'||x.oc.code==='publicado');
  const vencenPronto=withOc.filter(x=>x.oc.ml!=null&&x.oc.ml>=0&&x.oc.ml<=3&&x.oc.code!=='vacio'&&x.oc.code!=='publicado').sort((a,b)=>a.oc.ml-b.oc.ml);
  const usadas=new Set([...sinAlquilar,...vencenPronto].map(x=>x.dep.id));
  const resto=withOc.filter(x=>!usadas.has(x.dep.id)).sort((a,b)=>{const ma=a.oc.ml==null?999:a.oc.ml,mb=b.oc.ml==null?999:b.oc.ml;return ma-mb;});
  return{sinAlquilar,vencenPronto,resto};
}
function _alquileresHtml(){
  const{sinAlquilar,vencenPronto,resto}=_alquileresData();
  const focoVence=oc=>{if(oc.ml==null)return 'Sin fecha de fin';if(oc.ml<0)return 'Contrato vencido';if(oc.ml===0)return 'Vence este mes';return 'Vence en '+oc.ml+(oc.ml===1?' mes':' meses');};
  const card=(x,mostrarFoco)=>{const dep=x.dep,oc=x.oc;
    const h=historialPago(dep);const bp=badgePagador(h);
    const compLine=((dep.estado||'alquilado')==='alquilado'&&h.n>0)?`<div class="comp-line"><span class="estado-badge ${bp.cls}">${bp.txt}</span> <span style="font-size:12px;color:var(--muted)">paga cerca del día ~${Math.round(h.prom)}${h.tarde?(' · '+h.tarde+(h.tarde===1?' mes':' meses')+' tarde'):''}</span></div>`:'';
    const vacante=oc.code==='vacio';
    const alquiladoLejos=!vacante&&oc.ml!=null&&oc.ml>3;
    const controls=alquiladoLejos?'':(`<div class="pub-q">¿Ya lo estás publicando para alquilar?</div><div class="seg"><button class="${dep.publicando?'':'on-bad'}" onclick="setPublicando('${dep.id}',false)">Todavía no</button><button class="${dep.publicando?'on-ok':''}" onclick="setPublicando('${dep.id}',true)">Sí, publicando</button></div>`);
    const accion=vacante?`<button class="btn btn-primary btn-sm" onclick="openAlquiler('${dep.id}')">Registrar alquiler</button>`:'';
    const puedeRenovar=!vacante&&dep.inquilino&&oc.ml!=null&&oc.ml<=3;
    const renovar=puedeRenovar?`<button class="btn btn-primary btn-sm" onclick="openRenovar('${dep.id}')">Renovar contrato</button>`:'';
    return `<div class="card"><div class="card-top"><div><div class="card-name">${esc(dep.nombre)}</div><div class="card-sub">${esc(ownerName(dep.duenoId))}${dep.contratoFin?' · fin '+dep.contratoFin.split('-').reverse().join('/'):''}</div></div><span class="estado-badge ${oc.cls}">${oc.label}</span></div>${mostrarFoco?`<div class="foco-venc">⏳ ${focoVence(oc)}</div>`:''} ${compLine}${controls}<div class="sheet-actions" style="margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="openDepto('${dep.id}')">Editar contrato</button>${renovar}${accion}</div></div>`;
  };
  const seccion=(titulo,arr,foco)=>{if(!arr.length)return '';return `<h2 class="section">${titulo}</h2><div class="cards">${arr.map(x=>card(x,foco)).join('')}</div>`;};
  if(state.deptos.length===0)return empty('&#128273;','Todavía no cargaste propiedades.','Cargalos en "Propiedades".');
  return seccion('🔴 Sin alquilar',sinAlquilar,false)+seccion('🟠 Vencen pronto (3 meses)',vencenPronto,true)+seccion('🟢 El resto',resto,true);
}
function renderAlquileres(){const el=document.getElementById('view-alquileres');if(el)el.innerHTML=_alquileresHtml();}

function setEstado(id,e){const dep=state.deptos.find(d=>d.id===id);dep.estado=e;save();render();toast(e==='alquilado'?'Marcado alquilado':'Marcado vacío');}
function setPublicando(id,v){const dep=state.deptos.find(d=>d.id===id);dep.publicando=!!v;save();render();toast(v?'Marcado: se está publicando':'Marcado: no se está publicando');}

let deptosSubTab='propiedades';
function setDeptosSubTab(v){deptosSubTab=v;renderDeptos();}
function goVencimientos(){deptosSubTab='vencimientos';go('deptos');}

function renderDeptos(){
  const el=document.getElementById('view-deptos');
  // Sub-nav: Propiedades | Vencimientos
  const subNav=`<div class="subnav">
    <button class="subtab ${deptosSubTab==='propiedades'?'on':''}" onclick="setDeptosSubTab('propiedades')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/></svg>
      Propiedades
    </button>
    <button class="subtab ${deptosSubTab==='vencimientos'?'on':''}" onclick="setDeptosSubTab('vencimientos')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>
      Vencimientos
    </button>
  </div>`;
  let html=subNav;

  if(deptosSubTab==='vencimientos'){el.innerHTML=html+_alquileresHtml();return;}

  // === Vista: Propiedades ===
  const pipe=pipeline();
  if(pipe.length){html+=`<button class="alert" onclick="goVencimientos()"><span class="txt">⏳ ${pipe.length} ${pipe.length===1?'propiedad necesita':'propiedades necesitan'} atención — vencimientos / disponibles</span><span class="go">›</span></button>`;}
  html+=`<div class="add-fab"><button class="btn btn-primary" onclick="openDepto()">+ Agregar propiedad</button></div>`;
  if(state.deptos.length===0){html+=empty('&#127970;','Empezá cargando tus propiedades.','Cada uno se asigna a un dueño, con su alquiler, comisión y modalidad de cobro.');el.innerHTML=html;return;}
  const grupos={};state.deptos.forEach(d=>{(grupos[d.duenoId]=grupos[d.duenoId]||[]).push(d);});
  Object.keys(grupos).forEach(oid=>{
    html+=`<h2 class="section-name">${esc(ownerName(oid))}</h2><div class="cards">`;
    grupos[oid].forEach(dep=>{
      const oc=ocupacion(dep);
      html+=`<div class="card">
        <div class="card-top"><div><div class="card-name">${esc(dep.nombre)}</div><div class="card-sub">${esc(dep.inquilino||'Sin inquilino')}</div></div>
        <span class="estado-badge ${oc.cls}">${oc.label}</span></div>
        <div class="liq-line"><span>Alquiler</span><span>${curMoney(dep,dep.alquiler)}${dep.moneda==='USD'?' USD':''}${dep.modalidad==='dueno'?'':' · com. '+(dep.comisionPct||0)+'%'}</span></div>
        ${(dep.alquilerInicial!=null&&dep.alquilerInicial!==dep.alquiler)?`<div class="liq-line"><span>Pactado inicial</span><span style="color:var(--muted)">${curMoney(dep,dep.alquilerInicial)} · ${(dep.ajustes||[]).length} ajustes</span></div>`:''}
        ${dep.comisionPrevia?`<div class="liq-line"><span>Comisión ya ganada</span><span class="pos">${curMoney(dep,dep.comisionPrevia)}</span></div>`:''}
        <div class="liq-line"><span>Administración</span><span>${dep.modalidad==='dueno'?'directo el dueño':'lo administrás vos'}</span></div>
        <div class="liq-line"><span>Contrato</span><span>${dep.contratoInicio||'—'} → ${dep.contratoFin||'—'}</span></div>
        <div class="liq-line"><span>Ajuste IPC</span><span>${(dep.ajusteMeses&&dep.ajusteMeses>0)?('cada '+dep.ajusteMeses+' meses'):'sin ajuste'}</span></div>
        <div class="liq-line"><span>Vence el día</span><span>${diaVenc(dep)} (corrido)</span></div>
        <div class="liq-line"><span>Garantía de caución</span><span>${dep.garantiaEmpresa?esc(dep.garantiaEmpresa):'—'}</span></div>
        ${(dep.deposito&&dep.deposito.monto)?`<div class="liq-line"><span>Depósito de garantía</span><span>🔒 ${fmtMon(dep.deposito.moneda||'ARS',dep.deposito.monto)}${depStatusTag(dep)}</span></div>`:''}
        ${dep.notas?`<div class="depto-notas">📝 ${esc(dep.notas)}</div>`:''}
        <div class="sheet-actions" style="margin-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="openDepto('${dep.id}')">Editar</button>
          ${(dep.deposito&&dep.deposito.monto)||dep.depositoDevuelto?`<button class="btn btn-ghost btn-sm" onclick="openDeposito('${dep.id}')">Depósito</button>`:''}
          <button class="btn btn-danger btn-sm" onclick="delDepto('${dep.id}')">Borrar</button></div></div>`;});
    html+='</div>';
  });
  el.innerHTML=html;
}

function renderDashboard(){
  const el=document.getElementById('view-dashboard');
  if(state.deptos.length===0){el.innerHTML=empty('&#128202;','Todavía no hay datos.','Cargá propiedades para ver tus métricas.');return;}
  const now=ymNow();
  const base=dashOwner==='all'?state.deptos:state.deptos.filter(d=>d.duenoId===dashOwner);
  const activos=base.filter(d=>activoEnMes(d,now));
  const alquilados=base.filter(d=>(d.estado||'alquilado')==='alquilado');
  const vacios=base.filter(d=>d.estado==='vacio');
  const publicando=vacios.filter(d=>d.publicando);
  const gestionados=base.filter(d=>d.modalidad!=='dueno');
  const ymAnt=shiftYm(now,-1);
  // Filtro de dueños (desplegable)
  const segHtml=ownerFilterBtn(dashOwner,'dash');
  const monOf=d=>d.moneda||'ARS';
  // Comisión del mes (potencial y cobrada), masa administrada, morosidad — separadas por moneda
  const comMes={ARS:0,USD:0},comCobrada={ARS:0,USD:0},masa={ARS:0,USD:0},pendiente={ARS:0,USD:0};let morosos=0;
  activos.forEach(d=>{
    const rent=alquilerEnMes(d,now);const cur=monOf(d);
    if(d.modalidad!=='dueno'){const c=rent*(d.comisionPct||0)/100;comMes[cur]+=c;masa[cur]+=rent;
      const pg=(state.pagos[now]||{})[d.id]||{};if(pg.alq){comCobrada[cur]+=c;}else{pendiente[cur]+=rent;}}
    const alDia=(function(){const pg=(state.pagos[now]||{})[d.id]||{};return pg.alq&&(!d.expensas||pg.exp)&&servPagos(d).allPaid;})();
    if(!alDia)morosos++;
  });
  const curs=[...new Set(gestionados.filter(d=>activoEnMes(d,now)).map(monOf))];if(!curs.length)curs.push('ARS');
  const single=curs.length<=1;
  // Ocupación (sobre los deptos del filtro actual)
  const ocupPct=base.length?Math.round(alquilados.length/base.length*100):0;
  // Comisión promedio (sin ponderar, para no mezclar monedas)
  const gAct=gestionados.filter(d=>activoEnMes(d,now)&&(d.comisionPct||0)>0);
  const comProm=gAct.length?gAct.reduce((a,b)=>a+(b.comisionPct||0),0)/gAct.length:0;
  // Vencimientos próximos (<=3 meses)
  const venc90=base.filter(d=>{const oc=ocupacion(d);return oc.ml!=null&&oc.ml>=0&&oc.ml<=3&&(d.estado||'alquilado')==='alquilado';});
  // Comisión histórica ya ganada — por moneda
  const comHist={ARS:0,USD:0};base.forEach(d=>{if(d.comisionPrevia)comHist[monOf(d)]+=d.comisionPrevia;});
  // Delta vs mes previo (solo si hay una sola moneda, si no no es comparable)
  let delta=null;
  if(single){const cur=curs[0];let ant=0;base.filter(d=>activoEnMes(d,ymAnt)&&d.modalidad!=='dueno'&&monOf(d)===cur).forEach(d=>{const pg=(state.pagos[ymAnt]||{})[d.id]||{};if(pg.alq)ant+=alquilerEnMes(d,ymAnt)*(d.comisionPct||0)/100;});if(ant>0)delta=((comCobrada[cur]/ant-1)*100);}

  const heroMoney=obj=>{const a=obj.ARS?fmtMon('ARS',obj.ARS):'';const u=obj.USD?fmtMon('USD',obj.USD):'';if(a&&u)return a+' <span style="font-size:19px;opacity:.9">+ '+u+'</span>';return a||u||'$0';};
  let html=segHtml+`<div class="dash-hero">
    <div class="dash-hero-k">Tu comisión este mes</div>
    <div class="dash-hero-v">${heroMoney(comMes)}</div>
    <div class="dash-hero-sub">Cobrada: ${dualStr(comCobrada)} · Pendiente: ${dualStr({ARS:comMes.ARS-comCobrada.ARS,USD:comMes.USD-comCobrada.USD})}${delta!=null?` · <span style="color:${delta>=0?'#8fe3bf':'#ffd0d8'}">${delta>=0?'▲':'▼'} ${Math.abs(delta).toFixed(0)}% vs mes previo</span>`:''}</div>
    ${!single?'<div class="dash-hero-sub" style="margin-top:4px;opacity:.8">Pesos y dólares se muestran por separado para que sean comparables.</div>':''}
  </div>`;

  // Gráfico de comisión (últimos 12 meses) — confirmada (cobrada) vs proyectada — uno por moneda
  curs.forEach(cur=>{
    const serie=comisionSerie(12,cur);
    if(serie.some(s=>(s.pot||s.val)>0)){
      const prom=Math.round(serie.reduce((a,b)=>a+b.val,0)/serie.length);
      html+=`<div class="card" style="padding:16px 14px 8px"><div class="dash-chart-head"><span>Comisión ${cur==='USD'?'en dólares':'en pesos'}, últimos 12 meses</span><span class="dash-chart-avg">cobrado prom. ${fmtMon(cur,prom)}</span></div>${sparkline(serie,cur)}</div>`;
    }
  });

  // Métricas de inteligencia para el administrador
  const gestAct=base.filter(d=>activoEnMes(d,now)&&d.modalidad!=='dueno');
  const adminCount=gestAct.length;
  const histAll=gestAct.map(d=>historialPago(d)).filter(h=>h.n>0);
  const puntualesPct=histAll.length?Math.round(histAll.filter(h=>badgePagador(h).txt==='Puntual').length/histAll.length*100):null;
  let cobradosMes=0;gestAct.forEach(d=>{const pg=(state.pagos[now]||{})[d.id]||{};if(pg.alq)cobradosMes++;});
  const tasaCobro=adminCount?Math.round(cobradosMes/adminCount*100):0;

  html+=`<h2 class="section">Números para mostrarle a los dueños</h2><div class="dash-grid">
    ${dstat('Propiedades administradas',adminCount,'que gestionás vos','')}
    ${dstat('Ocupación',ocupPct+'%',alquilados.length+' de '+base.length+' alquilados',ocupPct>=90?'ok':ocupPct>=70?'warn':'bad')}
    ${dstat('Masa administrada',heroMoney(masa),'alquileres bajo tu gestión','')}
    ${dstat('Vencen ≤3m',venc90.length,venc90.length?'renovar o publicar':'sin urgencias',venc90.length?'warn':'ok')}
    ${dstat('Morosidad',morosos,morosos?dualStr(pendiente)+' sin cobrar':'todo al día',morosos?'bad':'ok')}
    ${dstat('Comisión media',comProm.toFixed(1)+'%','de tu cartera','')}
    ${dstat('Cobro del mes',tasaCobro+'%',cobradosMes+' de '+adminCount+' ya pagaron',tasaCobro>=90?'ok':tasaCobro>=60?'warn':'bad')}
    ${puntualesPct!=null?dstat('Inquilinos puntuales',puntualesPct+'%','pagan a tiempo',puntualesPct>=70?'ok':puntualesPct>=40?'warn':'bad'):''}
  </div>`;

  // Ranking deptos por comisión (bloque por moneda)
  curs.forEach(cur=>{
    const rk=gestionados.filter(d=>activoEnMes(d,now)&&monOf(d)===cur).map(d=>({d,c:alquilerEnMes(d,now)*(d.comisionPct||0)/100})).sort((a,b)=>b.c-a.c);
    if(!rk.length||rk[0].c<=0)return;const maxC=rk[0].c;
    html+='<h2 class="section">Propiedades que más te generan'+(single?'':' · '+(cur==='USD'?'dólares':'pesos'))+'</h2><div class="card" style="padding:14px">';
    rk.slice(0,6).forEach(r=>{const w=maxC>0?Math.round(r.c/maxC*100):0;
      html+=`<div class="dash-row"><div class="dash-row-top"><span class="dash-row-name">${esc(r.d.nombre)}</span><span class="dash-row-val">${fmtMon(cur,r.c)}</span></div><div class="dash-bar"><i style="width:${w}%"></i></div><div class="dash-row-sub">${esc(ownerName(r.d.duenoId))} · com. ${r.d.comisionPct||0}% · alq. ${fmtMon(cur,alquilerEnMes(r.d,now))}</div></div>`;});
    html+='</div>';
  });
  // Ranking dueños por comisión (bloque por moneda)
  curs.forEach(cur=>{
    const porDueno={};gestionados.filter(d=>activoEnMes(d,now)&&monOf(d)===cur).forEach(d=>{const c=alquilerEnMes(d,now)*(d.comisionPct||0)/100;porDueno[d.duenoId]=(porDueno[d.duenoId]||0)+c;});
    const rkD=Object.keys(porDueno).map(id=>({id,c:porDueno[id]})).sort((a,b)=>b.c-a.c);
    if(!rkD.length||rkD[0].c<=0)return;const maxD=rkD[0].c;
    html+='<h2 class="section">Comisión por dueño'+(single?'':' · '+(cur==='USD'?'dólares':'pesos'))+'</h2><div class="card" style="padding:14px">';
    rkD.forEach(r=>{const w=maxD>0?Math.round(r.c/maxD*100):0;const n=state.deptos.filter(d=>d.duenoId===r.id&&d.modalidad!=='dueno'&&activoEnMes(d,now)&&monOf(d)===cur).length;
      html+=`<div class="dash-row"><div class="dash-row-top"><span class="dash-row-name">${esc(ownerName(r.id))}</span><span class="dash-row-val">${fmtMon(cur,r.c)}</span></div><div class="dash-bar"><i style="width:${w}%"></i></div><div class="dash-row-sub">${n} ${n===1?'propiedad':'propiedades'}</div></div>`;});
    html+='</div>';
  });
  // ── Alertas de ajuste sin notificar (solo si ya pasó el día 20) ─────────────
  const proxYm=shiftYm(now,1);
  const alertasAjuste=diaHoy()>20?base.filter(d=>{
    if((d.estado||'alquilado')==='vacio'||!d.ajusteMeses)return false;
    const aj=(d.ajustes||[]).find(a=>a.ym===proxYm);if(!aj)return false;
    const cell=(state.pagos[now]||{})[d.id]||{};
    return !cell.ajusteNotificado;
  }):[];

  // Alertas accionables
  const tips=[];
  const vacSinPub=vacios.filter(d=>!d.publicando).length;
  if(vacSinPub)tips.push(`Tenés <b>${vacSinPub} ${vacSinPub===1?'propiedad vacía sin publicar':'propiedades vacías sin publicar'}</b> — no generan comisión, arrancá a publicarlos.`);
  else if(vacios.length)tips.push(`Tus <b>${vacios.length} ${vacios.length===1?'propiedad vacía ya está publicándose':'propiedades vacías ya se están publicando'}</b> — seguí de cerca las visitas.`);
  if(venc90.length)tips.push(`<b>${venc90.length} ${venc90.length===1?'contrato vence':'contratos vencen'}</b> en 3 meses — empezá a renovar o publicar.`);
  if(morosos)tips.push(`<b>${morosos} ${morosos===1?'propiedad debe':'propiedades deben'}</b> pagos este mes (${dualStr(pendiente)} sin cobrar) — mandá los recordatorios.`);
  const bajaCom=gAct.filter(d=>(d.comisionPct||0)<comProm-2).length;
  if(bajaCom)tips.push(`<b>${bajaCom} ${bajaCom===1?'propiedad tiene':'propiedades tienen'}</b> comisión por debajo de tu promedio — oportunidad de renegociar.`);
  if(comHist.ARS||comHist.USD)tips.push(`Comisión histórica ya ganada en tus contratos: <b>${dualStr(comHist)}</b>.`);

  const hayAlertas=alertasAjuste.length>0||tips.length>0;
  if(hayAlertas){
    html+='<h2 class="section">Para decidir</h2>';
    // Ajustes sin notificar primero (más urgentes)
    alertasAjuste.forEach(d=>{
      const aj=(d.ajustes||[]).find(a=>a.ym===proxYm);if(!aj)return;
      const waUrl=d.telInquilino?'https://wa.me/'+digits(d.telInquilino)+'?text='+encodeURIComponent(msgAumento(d,aj)):'';
      const waBtn=waUrl
        ?`<a class="btn-alerta btn-alerta-wa" href="${waUrl}" target="_blank" rel="noopener" onclick="marcarAjusteNotificado('${d.id}')" aria-label="Enviar WhatsApp de aumento a ${esc(d.inquilino||d.nombre)}">${WA_SVG} Enviar WhatsApp</a>`
        :`<span class="btn-alerta btn-alerta-wa disabled">Sin teléfono cargado</span>`;
      html+=`<div class="dash-alert"><div class="dash-alert-body"><span class="dash-alert-ico">⚠️</span><div><b>Ajuste pendiente: ${esc(d.nombre)}</b><br>Tiene un aumento del <b>${aj.pct.toFixed(1)}%</b> en ${ymLabel(proxYm)} (${curMoney(d,aj.nuevo)}) y aún no se le notificó al inquilino.</div></div><div class="dash-alert-actions">${waBtn}<button class="btn-alerta btn-alerta-ghost" onclick="marcarAjusteNotificado('${d.id}')" aria-label="Marcar como ya notificado sin abrir WhatsApp">Ya le avisé</button></div></div>`;
    });
    tips.forEach(t=>{html+=`<div class="dash-tip">💡 ${t}</div>`;});
  }

  // Comportamiento de pago (a quién apurar)
  const comp=base.filter(d=>(d.estado||'alquilado')==='alquilado'&&activoEnMes(d,now)).map(d=>({d,h:historialPago(d)})).filter(x=>x.h.n>0).sort((a,b)=>(b.h.prom||0)-(a.h.prom||0));
  if(comp.length){
    html+='<h2 class="section">Comportamiento de pago</h2><div class="card" style="padding:14px">';
    comp.slice(0,8).forEach(x=>{const bp=badgePagador(x.h);
      html+=`<div class="dash-row"><div class="dash-row-top"><span class="dash-row-name">${esc(x.d.inquilino||x.d.nombre)}</span><span class="estado-badge ${bp.cls}">${bp.txt}</span></div><div class="dash-row-sub">${esc(x.d.nombre)} · paga cerca del día ~${Math.round(x.h.prom)}${x.h.tarde?(' · '+x.h.tarde+(x.h.tarde===1?' mes':' meses')+' tarde'):''}${x.h.max!=null?(' · peor: día '+x.h.max):''}</div></div>`;});
    html+='</div><div class="dash-tip">💡 Ordenados de más lento a más rápido: a los de arriba conviene apurarlos primero. La etiqueta “Paga tarde” es un aviso a la hora de renovar.</div>';
  }

  el.innerHTML=html;
}
function fmtMon(cur,v){const s=money(v);return cur==='USD'?s.replace('$','US$'):s;}
function dualStr(obj){const parts=[];if(obj.ARS)parts.push(fmtMon('ARS',obj.ARS));if(obj.USD)parts.push(fmtMon('USD',obj.USD));return parts.length?parts.join(' + '):'$0';}
function dstat(k,v,sub,tone){return `<div class="dstat ${tone||''}"><div class="dstat-k">${k}</div><div class="dstat-v">${v}</div><div class="dstat-sub">${sub}</div></div>`;}
/* Comisión efectivamente cobrada por mes (últimos n meses hasta el actual) */
function comisionSerie(n,cur){
  const out=[];let m=ymNow();for(let i=0;i<n;i++){out.unshift(m);m=shiftYm(m,-1);}
  let set=dashOwner==='all'?state.deptos:state.deptos.filter(d=>d.duenoId===dashOwner);
  if(cur)set=set.filter(d=>(d.moneda||'ARS')===cur);
  return out.map(mes=>{let c=0,pot=0;set.forEach(d=>{if(d.modalidad==='dueno'||!activoEnMes(d,mes))return;const com=alquilerEnMes(d,mes)*(d.comisionPct||0)/100;pot+=com;const pg=(state.pagos[mes]||{})[d.id]||{};if(pg.alq)c+=com;});return{ym:mes,val:Math.round(c),pot:Math.round(pot)};});
}
function compactMoney(v,cur){const p=cur==='USD'?'US$':'$';if(v>=1e6)return p+(v/1e6).toFixed(v>=1e7?0:1).replace('.',',')+'M';if(v>=1e3)return p+Math.round(v/1e3)+'k';return p+v;}
function sparkline(serie,cur){
  if(!serie.length)return '';
  const W=340,H=150,pad=6,topPad=26,botPad=30;const tops=serie.map(s=>Math.max(s.val,s.pot||s.val));const max=Math.max(...tops,1);const min=0;
  const n=serie.length;const bw=(W-pad*2)/n;
  const x=i=>pad+bw*i+bw*0.12;const bw2=bw*0.76;
  const y=v=>H-botPad-((v-min)/(max-min||1))*(H-topPad-botPad);
  const base=H-botPad;
  let bars='',vlabels='';serie.forEach((s,i)=>{const pot=s.pot||s.val;const yTop=y(pot);const yConf=y(s.val);const cx=x(i)+bw2/2;const last=i===n-1;
    // proyectado (parte no cobrada) = de yTop a yConf, rayado/claro
    const projH=Math.max(0,yConf-yTop);
    if(projH>0.5)bars+=`<rect x="${x(i).toFixed(1)}" y="${yTop.toFixed(1)}" width="${bw2.toFixed(1)}" height="${projH.toFixed(1)}" rx="2" fill="url(#proj)"><title>${ymLabel(s.ym)}: proyectado ${fmtMon(cur||'ARS',pot)}</title></rect>`;
    // confirmado (cobrado) = de yConf a base, verde
    const confH=Math.max(1,base-yConf);
    bars+=`<rect x="${x(i).toFixed(1)}" y="${yConf.toFixed(1)}" width="${bw2.toFixed(1)}" height="${confH.toFixed(1)}" rx="2" fill="${last?'#0f6b4f':'#7fbfa4'}"><title>${ymLabel(s.ym)}: cobrado ${fmtMon(cur||'ARS',s.val)}</title></rect>`;
    if(pot>0&&((n-1-i)%2===0))vlabels+=`<text x="${cx.toFixed(1)}" y="${(y(pot)-4).toFixed(1)}" font-size="8.5" font-weight="700" fill="${projH>0.5?'#0b5540':'#0f6b4f'}" text-anchor="middle">${compactMoney(pot,cur)}</text>`;
  });
  const lab=i=>{const[y2,m2]=serie[i].ym.split('-');return ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+m2-1];};
  let labels='';serie.forEach((s,i)=>{labels+=`<text x="${(x(i)+bw2/2).toFixed(1)}" y="${H-16}" font-size="8" fill="#586860" text-anchor="middle">${lab(i)}</text>`;});
  const legend=`<rect x="${pad}" y="${H-9}" width="9" height="9" rx="2" fill="#0f6b4f"></rect><text x="${pad+13}" y="${H-1.5}" font-size="8.5" fill="#586860">Confirmado (cobrado)</text><rect x="${pad+128}" y="${H-9}" width="9" height="9" rx="2" fill="url(#proj)" stroke="#8fc3ab" stroke-width="0.6"></rect><text x="${pad+141}" y="${H-1.5}" font-size="8.5" fill="#586860">Proyectado (falta cobrar)</text>`;
  const defs=`<defs><pattern id="proj" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#dcefe6"></rect><line x1="0" y1="0" x2="0" y2="5" stroke="#0b5540" stroke-width="2"></line></pattern></defs>`;
  const resumen='Comisión mensual '+(cur==='USD'?'en dólares':'en pesos')+', últimos 12 meses, confirmada vs proyectada. '+serie.filter(s=>(s.pot||s.val)>0).map(s=>ymLabel(s.ym)+': cobrado '+fmtMon(cur||'ARS',s.val)+' de '+fmtMon(cur||'ARS',s.pot||s.val)).join('; ')+'.';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block" role="img" aria-label="${resumen.replace(/"/g,'')}">${defs}${bars}${vlabels}${labels}${legend}</svg>`;
}
function empty(em,t,d){return `<div class="empty"><div class="em">${em}</div><p><strong>${t}</strong><br>${d}</p></div>`;}

let _sheetPrevFocus=null;
function openSheet(html){const s=document.getElementById('sheet');_sheetPrevFocus=document.activeElement;s.innerHTML='<div class="grab" id="sheetGrab" aria-hidden="true"></div><button class="sheet-close" onclick="closeSheet()" aria-label="Cerrar">✕</button>'+html;document.getElementById('sheetBg').classList.add('open');s.scrollTop=0;initSheetSwipe(s);
  const h=s.querySelector('h3');if(h){h.id='sheet-title';}else{s.removeAttribute('aria-labelledby');s.setAttribute('aria-label','Panel');}
  // Enfocar el primer control (o el título) para lectores de pantalla y teclado
  setTimeout(()=>{const f=s.querySelector('input,select,textarea,button:not(.sheet-close)');(f||s.querySelector('.sheet-close')||s).focus&&(f||s.querySelector('.sheet-close')||s).focus();},50);}
function closeSheet(){document.getElementById('sheetBg').classList.remove('open');const s=document.getElementById('sheet');if(s)s.style.transform='';if(_sheetPrevFocus&&_sheetPrevFocus.focus){try{_sheetPrevFocus.focus();}catch(e){}}_sheetPrevFocus=null;}
document.addEventListener('keydown',function(e){if(e.key==='Escape'){const bg=document.getElementById('sheetBg');if(bg&&bg.classList.contains('open'))closeSheet();}});
// Trap de foco dentro del sheet abierto (Tab cicla)
document.addEventListener('keydown',function(e){if(e.key!=='Tab')return;const bg=document.getElementById('sheetBg');if(!bg||!bg.classList.contains('open'))return;const s=document.getElementById('sheet');const f=[...s.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null||el===document.activeElement);if(!f.length)return;const first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
function initSheetSwipe(s){
  let y0=null,dy=0;const grab=document.getElementById('sheetGrab');if(!grab)return;
  const start=e=>{if(s.scrollTop>0)return;y0=(e.touches?e.touches[0].clientY:e.clientY);dy=0;};
  const move=e=>{if(y0==null)return;const y=(e.touches?e.touches[0].clientY:e.clientY);dy=y-y0;if(dy>0){s.style.transform='translateY('+dy+'px)';}};
  const end=()=>{if(y0==null)return;s.style.transition='transform .2s';if(dy>90){closeSheet();}s.style.transform='';setTimeout(()=>{s.style.transition='';},220);y0=null;};
  grab.addEventListener('touchstart',start,{passive:true});grab.addEventListener('touchmove',move,{passive:true});grab.addEventListener('touchend',end);
}

let flowSel='vos',estSel='alquilado',ipcSel='si',serviciosSel=[],monedaSel='ARS',depMonedaSel='ARS';
const SERVICIOS=[{k:'agua',l:'Agua'},{k:'luz',l:'Luz'},{k:'gas',l:'Gas'},{k:'abl',l:'ABL'},{k:'internet',l:'Internet'}];
function servLabel(k){const s=SERVICIOS.find(x=>x.k===k);return s?s.l:k;}
function openDepto(id){
  const dep=id?state.deptos.find(d=>d.id===id):null;
  flowSel=dep?(dep.modalidad==='dueno'?'dueno':'vos'):'vos';
  estSel=dep?dep.estado||'alquilado':'alquilado';
  ipcSel=dep?((dep.ajusteMeses&&dep.ajusteMeses>0)?'si':'no'):'si';
  serviciosSel=dep&&Array.isArray(dep.serviciosList)?dep.serviciosList.slice():[];
  monedaSel=dep&&dep.moneda?dep.moneda:'ARS';
  depMonedaSel=(dep&&dep.deposito&&dep.deposito.moneda)?dep.deposito.moneda:(dep&&dep.moneda?dep.moneda:'ARS');
  const o=dep?owner(dep.duenoId):null;
  const dl=[...new Set(state.duenos.map(x=>(x.apellido||x.nombre||'').trim()).filter(Boolean))].map(v=>`<option value="${esc(v)}"></option>`).join('');
  openSheet(`
    <h3>${dep?'Editar propiedad':'Nueva propiedad'}</h3>

    <div class="form-sec">Estado de la propiedad</div>
    <div class="seg" id="f_est">
      <button type="button" class="${estSel==='alquilado'?'on':''}" onclick="pickEstado('alquilado')">Alquilado</button>
      <button type="button" class="${estSel==='vacio'?'on':''}" onclick="pickEstado('vacio')">Vacío</button></div>

    <div class="form-sec">Detalle de la propiedad</div>
    <div class="row2">
      <div class="field"><label for="f_calle">Calle</label><input id="f_calle" placeholder="Ej: Av. Corrientes" value="${dep?esc(dep.calle||''):''}"></div>
      <div class="field"><label for="f_num">Número</label><input id="f_num" inputmode="numeric" placeholder="Ej: 1234" value="${dep?esc(dep.numero||''):''}"></div></div>
    <div class="row2">
      <div class="field"><label>Piso <span style="color:var(--muted);font-weight:400">— opcional</span></label><input id="f_piso" placeholder="Ej: 4 / PB" value="${dep?esc(dep.piso||''):''}"></div>
      <div class="field"><label>Depto <span style="color:var(--muted);font-weight:400">— opcional</span></label><input id="f_dep" placeholder="Ej: B" value="${dep?esc(dep.depto||''):''}"></div></div>
    <div class="field"><label for="f_notas">Notas <span style="color:var(--muted);font-weight:400">— opcional</span></label><textarea id="f_notas" rows="2" placeholder="Cualquier detalle para tener a mano: cochera, mascotas, arreglos pendientes, etc.">${dep?esc(dep.notas||''):''}</textarea></div>

    <div class="form-sec">Detalle del dueño</div>
    <input type="hidden" id="f_duenoId" value="${dep?esc(dep.duenoId||''):''}">
    <datalist id="ownersList">${dl}</datalist>
    <div class="row2">
      <div class="field"><label for="f_oap">Apellido</label><input id="f_oap" list="ownersList" autocomplete="off" placeholder="Empezá a escribir…" oninput="ownerSuggest()" value="${o?esc(o.apellido||''):''}"></div>
      <div class="field"><label for="f_onom">Nombre</label><input id="f_onom" placeholder="Nombre" value="${o?esc(o.nombre||''):''}"></div></div>
    <div class="row2">
      <div class="field"><label for="f_odni">DNI</label><input id="f_odni" inputmode="numeric" placeholder="Sin puntos" value="${o?esc(o.dni||''):''}"></div>
      <div class="field"><label for="f_otel">Teléfono</label><input id="f_otel" inputmode="tel" placeholder="Ej: 11 5555 5555" value="${o?esc(o.telefono||''):''}"></div></div>
    <div class="sub" id="ownerHint" style="margin:-6px 2px 0"></div>

    <div id="inqSection" style="display:${estSel==='alquilado'?'block':'none'}">
      <div class="form-sec">Detalle del inquilino</div>
      <div class="row2">
        <div class="field"><label for="f_iap">Apellido</label><input id="f_iap" placeholder="Apellido" value="${dep?esc(dep.inqApellido||''):''}"></div>
        <div class="field"><label for="f_inom">Nombre</label><input id="f_inom" placeholder="Nombre" value="${dep?esc(dep.inqNombre||''):''}"></div></div>
      <div class="row2">
        <div class="field"><label for="f_idni">DNI</label><input id="f_idni" inputmode="numeric" placeholder="Sin puntos" value="${dep?esc(dep.inqDni||''):''}"></div>
        <div class="field"><label for="f_tel">Teléfono</label><input id="f_tel" inputmode="tel" placeholder="Ej: 11 5555 5555" value="${dep?esc(dep.telInquilino||''):''}"></div></div>
      <div class="form-sec" style="margin-top:14px">Garantía de caución <span style="color:var(--muted);font-weight:400;font-size:12px">— opcional, dejá vacío si no tiene</span></div>
      <div class="field"><label for="f_garemp">Empresa de garantía</label><input id="f_garemp" list="garList" autocomplete="off" placeholder="Ej: Finaer (o dejá vacío)" oninput="garSuggest()" value="${dep?esc(dep.garantiaEmpresa||''):''}"></div>
      <datalist id="garList">${[...new Set(state.deptos.map(d=>d.garantiaEmpresa).filter(Boolean))].map(e=>`<option value="${esc(e)}"></option>`).join('')}</datalist>
      <div class="field" id="garTelWrap" style="display:${dep&&dep.garantiaEmpresa?'block':'none'}"><label for="f_garmail">Mail de la garantía</label><input id="f_garmail" type="email" inputmode="email" autocomplete="off" placeholder="Ej: siniestros@finaer.com" value="${dep?esc(dep.garantiaMail||''):''}"><div class="sub">Se usa solo si el inquilino se atrasa: abre el mail listo para enviar.</div></div>
      <div class="form-sec" style="margin-top:14px">Servicios que paga el inquilino</div>
      <div class="chip-select" id="f_serv">${SERVICIOS.map(s=>`<button type="button" class="pick-chip ${serviciosSel.includes(s.k)?'on':''}" onclick="toggleServ('${s.k}')">${s.l}</button>`).join('')}</div>
      <div class="sub" style="margin-top:6px">Elegí los que corresponde pagar al inquilino. Después, en Seguimiento, marcás cuáles ya pagó.</div>
    </div>

    <div id="contractSection" style="display:${estSel==='alquilado'?'block':'none'}">
    <div class="form-sec">Detalle del contrato</div>
    <div class="row2">
      <div class="field"><label for="f_ini">Fecha de inicio</label><input id="f_ini" type="date" oninput="setFinDefault()" value="${dep?dep.contratoInicio||'':''}"></div>
      <div class="field"><label for="f_fin">Fecha de fin</label><input id="f_fin" type="date" value="${dep?dep.contratoFin||'':''}"></div></div>
    <div class="field"><label>Moneda del alquiler</label>
      <div class="seg" id="f_mon" role="group" aria-label="Moneda del alquiler">
        <button type="button" class="${monedaSel==='ARS'?'on':''}" aria-pressed="${monedaSel==='ARS'}" onclick="pickMoneda('ARS')">Pesos (ARS)</button>
        <button type="button" class="${monedaSel==='USD'?'on':''}" aria-pressed="${monedaSel==='USD'}" onclick="pickMoneda('USD')">Dólares (USD)</button></div></div>
    <div class="field"><label for="f_alq">Alquiler pactado <span style="color:var(--muted);font-weight:400">(el del inicio del contrato)</span></label><input id="f_alq" type="number" inputmode="numeric" placeholder="0" value="${dep?(dep.alquilerInicial!=null?dep.alquilerInicial:(dep.alquiler||'')):''}"><div class="sub">Con los ajustes por IPC del medio, la app calcula sola el valor actual.</div></div>
    <div class="field"><label>Administración</label>
      <div class="seg" id="f_flow" role="group" aria-label="Quién administra">
        <button type="button" class="${flowSel==='vos'?'on':''}" aria-pressed="${flowSel==='vos'}" onclick="pickFlow('vos')">Lo administrás vos</button>
        <button type="button" class="${flowSel==='dueno'?'on':''}" aria-pressed="${flowSel==='dueno'}" onclick="pickFlow('dueno')">Directo el dueño</button></div>
      <div class="sub">“Directo el dueño” = lo maneja el dueño; queda solo en tu radar para cuando se libere.</div></div>
    <div class="field" id="comWrap" style="display:${flowSel==='dueno'?'none':'block'}"><label for="f_com">Comisión (%)</label><input id="f_com" type="number" inputmode="decimal" placeholder="Ej: 8" value="${dep?dep.comisionPct||'':''}"></div>
    <div class="field"><label>Ajuste por inflación (IPC)</label>
      <div class="seg" id="f_ipc" role="group" aria-label="¿Tiene ajuste por IPC?">
        <button type="button" class="${ipcSel==='si'?'on':''}" aria-pressed="${ipcSel==='si'}" onclick="pickIPC('si')">Sí</button>
        <button type="button" class="${ipcSel==='no'?'on':''}" aria-pressed="${ipcSel==='no'}" onclick="pickIPC('no')">No</button></div></div>
    <div class="field" id="ipcFreqWrap" style="display:${ipcSel==='si'?'block':'none'}"><label for="f_aj">Frecuencia del ajuste</label>
      <select id="f_aj">
        <option value="3" ${!dep||dep.ajusteMeses===3?'selected':''}>Trimestral</option>
        <option value="4" ${dep&&dep.ajusteMeses===4?'selected':''}>Cuatrimestral</option>
        <option value="6" ${dep&&dep.ajusteMeses===6?'selected':''}>Semestral</option>
        <option value="12" ${dep&&dep.ajusteMeses===12?'selected':''}>Anual</option></select></div>
    <div class="field"><label for="f_diavenc">Día de vencimiento del pago <span style="color:var(--muted);font-weight:400">(día corrido)</span></label><input id="f_diavenc" type="number" inputmode="numeric" min="1" max="31" placeholder="10" value="${dep&&dep.diaVencimiento?dep.diaVencimiento:''}"><div class="sub">Ej: 10 → el día 11 ya está vencido. Si se pasa, se avisa a la garantía.</div></div>

    <div class="form-sec" style="margin-top:14px">Depósito de garantía <span style="color:var(--muted);font-weight:400;font-size:12px">— opcional</span></div>
    <div class="field"><label>Moneda del depósito</label>
      <div class="seg" id="f_depmon" role="group" aria-label="Moneda del depósito">
        <button type="button" class="${depMonedaSel==='ARS'?'on':''}" aria-pressed="${depMonedaSel==='ARS'}" onclick="pickDepMoneda('ARS')">Pesos (ARS)</button>
        <button type="button" class="${depMonedaSel==='USD'?'on':''}" aria-pressed="${depMonedaSel==='USD'}" onclick="pickDepMoneda('USD')">Dólares (USD)</button></div></div>
    <div class="field"><label for="f_depmonto">Monto del depósito</label><input id="f_depmonto" type="number" inputmode="numeric" placeholder="0" value="${dep&&dep.deposito?(dep.deposito.monto||''):''}"><div class="sub">Lo que dejó el inquilino al firmar. Al terminar el contrato descontás los arreglos y el resto se le devuelve.</div></div>
    <div class="field"><label for="f_depnota">Nota <span style="color:var(--muted);font-weight:400">— opcional</span></label><input id="f_depnota" placeholder="Ej: en efectivo, lo tiene el dueño · equivale a 1 mes" value="${dep&&dep.deposito?esc(dep.deposito.nota||''):''}"></div>
    </div>

    <div class="sheet-actions" style="margin-top:8px">
      <button class="btn btn-ghost" onclick="closeSheet()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveDepto('${id||''}')">Guardar</button></div>`);
}
function pickEstado(v){estSel=v;const btns=document.querySelectorAll('#f_est button');btns.forEach((b,i)=>{b.classList.toggle('on',i===(v==='alquilado'?0:1));b.setAttribute('aria-pressed',String(i===(v==='alquilado'?0:1)));});const show=v==='alquilado';const inq=document.getElementById('inqSection');const con=document.getElementById('contractSection');if(inq)inq.style.display=show?'block':'none';if(con)con.style.display=show?'block':'none';}
function toggleServ(k){const i=serviciosSel.indexOf(k);if(i>=0)serviciosSel.splice(i,1);else serviciosSel.push(k);const btns=document.querySelectorAll('#f_serv .pick-chip');SERVICIOS.forEach((s,idx)=>{if(btns[idx])btns[idx].classList.toggle('on',serviciosSel.includes(s.k));});}
function pickMoneda(v){monedaSel=v;document.querySelectorAll('#f_mon button').forEach((b,i)=>b.classList.toggle('on',(v==='ARS')?i===0:i===1));}
function pickDepMoneda(v){depMonedaSel=v;document.querySelectorAll('#f_depmon button').forEach((b,i)=>b.classList.toggle('on',(v==='ARS')?i===0:i===1));}
function setFinDefault(){const ini=document.getElementById('f_ini').value;const fin=document.getElementById('f_fin');if(!ini||!fin)return;const[y,m,d]=ini.split('-').map(Number);const end=new Date(y+3,m-1,d);end.setDate(end.getDate()-1);fin.value=end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0');}
function pickFlow(v){flowSel=v;document.querySelectorAll('#f_flow button').forEach((b,i)=>b.classList.toggle('on',(v==='vos')?i===0:i===1));document.getElementById('comWrap').style.display=v==='dueno'?'none':'block';}
function pickIPC(v){ipcSel=v;document.querySelectorAll('#f_ipc button').forEach((b,i)=>b.classList.toggle('on',(v==='si')?i===0:i===1));document.getElementById('ipcFreqWrap').style.display=v==='si'?'block':'none';}
function toggleGarTel(){const emp=document.getElementById('f_garemp').value.trim();document.getElementById('garTelWrap').style.display=emp?'block':'none';}
function garSuggest(){
  toggleGarTel();
  const emp=document.getElementById('f_garemp').value.trim().toLowerCase();if(!emp)return;
  const match=state.deptos.find(d=>d.garantiaEmpresa&&d.garantiaEmpresa.trim().toLowerCase()===emp&&d.garantiaMail);
  const mail=document.getElementById('f_garmail');
  if(match&&mail&&!mail.value){mail.value=match.garantiaMail;}
}
function ownerSuggest(){
  const ap=document.getElementById('f_oap').value.trim().toLowerCase();if(!ap)return;
  const match=state.duenos.find(d=>(d.apellido||d.nombre||'').trim().toLowerCase()===ap);
  const hint=document.getElementById('ownerHint');
  if(match){
    document.getElementById('f_duenoId').value=match.id;
    document.getElementById('f_onom').value=match.nombre||'';
    document.getElementById('f_odni').value=match.dni||'';
    document.getElementById('f_otel').value=match.telefono||'';
    hint.innerHTML='✓ Dueño ya cargado — datos autocompletados.';
    const otro=state.deptos.find(d=>d.duenoId===match.id&&d.comisionPct);
    const com=document.getElementById('f_com');if(otro&&com&&!com.value){com.value=otro.comisionPct;}
  }else{document.getElementById('f_duenoId').value='';hint.innerHTML='';}
}
function saveDepto(id){
  const val=x=>document.getElementById(x).value.trim();
  const calle=val('f_calle'),numero=val('f_num'),piso=val('f_piso'),depto=val('f_dep');
  if(!calle||!numero){toast('Completá calle y número');return;}
  const oap=capName(val('f_oap')),onom=capName(val('f_onom')),odni=val('f_odni'),otel=val('f_otel');
  if(!oap||!onom||!odni||!otel){toast('Completá los datos del dueño');return;}
  let duenoId=val('f_duenoId');
  const oData={apellido:oap,nombre:onom,dni:odni,telefono:otel};
  if(!duenoId){const key=(oap+'|'+onom).toLowerCase();const ex=state.duenos.find(d=>((d.apellido||'')+'|'+(d.nombre||'')).toLowerCase()===key);if(ex)duenoId=ex.id;}
  if(duenoId){const d=owner(duenoId);if(d)Object.assign(d,oData);else{duenoId=uid();state.duenos.push({id:duenoId,...oData});}}
  else{duenoId=uid();state.duenos.push({id:duenoId,...oData});}
  const nombre=calle+' '+numero+(piso?', Piso '+piso:'')+(depto?' Depto '+depto:'');
  const estado=estSel;
  const num=v=>{const el=document.getElementById(v);const n=el?parseFloat(el.value):NaN;return isNaN(n)?0:n;};
  let inq={inqApellido:'',inqNombre:'',inqDni:'',telInquilino:'',inquilino:'',garantiaEmpresa:'',garantiaMail:''};
  const notas=val('f_notas');
  let data;
  if(estado==='vacio'){
    data={nombre,calle,numero,piso,depto,duenoId,estado,...inq,notas,
      alquilerInicial:0,alquiler:0,moneda:'ARS',modalidad:'vos',comisionPct:0,
      contratoInicio:'',contratoFin:'',diaVencimiento:10,
      expensas:true,servicios:false,serviciosList:[],
      ajusteIPC:false,ajusteMeses:0,publicando:((id&&state.deptos.find(x=>x.id===id))||{}).publicando||false};
  }else{
    if(!val('f_ini')||!val('f_fin')){toast('Cargá inicio y fin de contrato');return;}
    if(num('f_alq')<=0){toast('Cargá el alquiler pactado');return;}
    const iap=capName(val('f_iap')),inom=capName(val('f_inom')),idni=val('f_idni'),itel=val('f_tel');
    if(!iap||!inom||!idni||!itel){toast('Completá los datos del inquilino');return;}
    const garemp=val('f_garemp');const garmail=garemp?val('f_garmail'):'';
    inq={inqApellido:iap,inqNombre:inom,inqDni:idni,telInquilino:itel,inquilino:iap+', '+inom,garantiaEmpresa:garemp,garantiaMail:garmail};
    const modalidad=flowSel;
    const alqInicial=num('f_alq');
    const ajusteMeses=ipcSel==='si'?parseInt(document.getElementById('f_aj').value):0;
    const diaVencimiento=Math.min(31,Math.max(1,parseInt(document.getElementById('f_diavenc').value)||10));
    const serviciosList=serviciosSel.slice();
    const prevDep=(id&&state.deptos.find(x=>x.id===id))||{};
    const deposito={monto:num('f_depmonto'),moneda:depMonedaSel,nota:val('f_depnota')};
    data={nombre,calle,numero,piso,depto,duenoId,estado,...inq,notas,
      alquilerInicial:alqInicial,alquiler:alqInicial,moneda:monedaSel,modalidad,comisionPct:modalidad==='dueno'?0:num('f_com'),
      contratoInicio:val('f_ini'),contratoFin:val('f_fin'),diaVencimiento,
      expensas:true,servicios:serviciosList.length>0,serviciosList,
      deposito,depositoArreglos:prevDep.depositoArreglos||[],depositoDevuelto:prevDep.depositoDevuelto||'',
      ajusteIPC:ipcSel==='si',ajusteMeses};
  }
  let target;
  if(id){target=state.deptos.find(x=>x.id===id);Object.assign(target,data,{ajustes:[]});}
  else{target={id:uid(),ajustes:[],...data};state.deptos.push(target);}
  if(estado!=='vacio'){
    const rec=reconstruir(target,ipcMap());
    target.alquiler=rec.cur;target.ajustes=rec.ajustes;
    marcarPrevios(target);
    const comPrev=comisionPrevia(target);target.comisionPrevia=comPrev;
    save();closeSheet();render();
    if(!id&&(rec.ajustes.length||comPrev)){toast('Reconstruido: '+money(target.alquilerInicial)+' → '+money(rec.cur));}
    else{toast(id?'Propiedad actualizada':'Propiedad agregada');}
  }else{
    target.ajustes=[];target.comisionPrevia=0;
    save();closeSheet();render();
    toast(id?'Propiedad actualizada':'Propiedad agregada (vacía)');
  }
}
function delDepto(id){if(!confirm('¿Borrar esta propiedad? Se pierden sus pagos registrados.'))return;state.deptos=state.deptos.filter(d=>d.id!==id);Object.values(state.pagos).forEach(m=>delete m[id]);save();render();toast('Propiedad borrada');}

// ── Depósito de garantía: lo que dejó el inquilino al firmar; al terminar se descuentan arreglos y el resto se devuelve ──
function depositoCalc(dep){
  const d=dep.deposito||{};const monto=d.monto||0;const moneda=d.moneda||'ARS';
  const arr=dep.depositoArreglos||[];
  const usado=arr.reduce((a,b)=>a+(b.monto||0),0);
  return{monto,moneda,usado,disponible:Math.max(0,monto-usado),arr,devuelto:dep.depositoDevuelto||''};
}
function depStatusTag(dep){
  if(dep.depositoDevuelto)return ' · <span style="color:var(--green)">devuelto</span>';
  const c=depositoCalc(dep);
  if(c.usado>0)return ` · <span style="color:var(--muted)">disponible ${fmtMon(c.moneda,c.disponible)}</span>`;
  return '';
}
function openDeposito(depId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;
  const c=depositoCalc(dep);
  if(c.monto<=0){
    openSheet(`<h3 id="sheet-title">Depósito de garantía</h3>
      <div class="empty" style="padding:20px 0"><div class="em">🔒</div><p><strong>Esta propiedad no tiene depósito cargado.</strong><br>Editá la propiedad para agregar el monto que dejó el inquilino.</p></div>
      <div class="sheet-actions"><button class="btn btn-ghost btn-sm" onclick="closeSheet()">Cerrar</button><button class="btn btn-primary btn-sm" onclick="closeSheet();openDepto('${depId}')">Editar propiedad</button></div>`);
    return;
  }
  const arrHtml=c.arr.length
    ?c.arr.map(a=>`<div class="mini-row mini-row-transf"><div class="mr-info"><span class="mr-name">${esc(a.concepto||'Arreglo')}</span><span class="mr-amt neg">- ${fmtMon(c.moneda,a.monto||0)}</span></div><button class="transf-chip" onclick="delArreglo('${depId}','${a.id}')" aria-label="Quitar ${esc(a.concepto||'arreglo')}">Quitar</button></div>`).join('')
    :'<div class="sub" style="padding:6px 0">Sin arreglos ni descuentos cargados.</div>';
  openSheet(`
    <h3 id="sheet-title">Depósito de garantía</h3>
    <p class="hint">${esc(dep.nombre)}${dep.inquilino?' · '+esc(dep.inquilino):''}${dep.contratoFin?' · contrato hasta '+dep.contratoFin.split('-').reverse().join('/'):''}</p>
    ${dep.deposito&&dep.deposito.nota?`<div class="sub" style="margin:-4px 2px 10px">🔒 ${esc(dep.deposito.nota)}</div>`:''}
    <div class="card" style="box-shadow:none;border:1px solid var(--line)">
      <div class="liq-line"><span>Depósito recibido</span><span>${fmtMon(c.moneda,c.monto)}</span></div>
      <div class="liq-line"><span>Usado en arreglos</span><span class="neg">- ${fmtMon(c.moneda,c.usado)}</span></div>
      <div class="liq-line tot"><span>${c.devuelto?'Se le devolvió':'Disponible para devolver'}</span><span>${fmtMon(c.moneda,c.disponible)}</span></div>
    </div>
    <div class="form-sec" style="margin-top:14px">Arreglos / descuentos</div>
    <div class="mini-list">${arrHtml}</div>
    ${c.devuelto?'':`
    <div class="row2" style="margin-top:8px;align-items:end">
      <div class="field" style="flex:2"><label for="ar_concepto">Concepto</label><input id="ar_concepto" placeholder="Ej: pintura, plomería"></div>
      <div class="field"><label for="ar_monto">Monto</label><input id="ar_monto" type="number" inputmode="numeric" placeholder="0" onkeydown="if(event.key==='Enter')addArreglo('${depId}')"></div>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="addArreglo('${depId}')">+ Agregar descuento</button>`}
    <div class="sheet-actions" style="margin-top:16px;flex-wrap:wrap">
      ${c.devuelto
        ?`<span class="sub" style="flex:1;align-self:center">Devuelto el ${c.devuelto.split('-').reverse().join('/')}</span><button class="btn btn-ghost btn-sm" onclick="desmarcarDepDevuelto('${depId}')">Deshacer devolución</button>`
        :`<button class="btn btn-ghost btn-sm" onclick="closeSheet()">Cerrar</button><button class="btn btn-primary btn-sm" onclick="marcarDepDevuelto('${depId}')">Marcar devuelto (${fmtMon(c.moneda,c.disponible)})</button>`}
    </div>`);
}
function addArreglo(depId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;
  const con=((document.getElementById('ar_concepto')||{}).value||'').trim();
  const monto=parseFloat((document.getElementById('ar_monto')||{}).value)||0;
  if(monto<=0){toast('Cargá el monto del arreglo');return;}
  if(!dep.depositoArreglos)dep.depositoArreglos=[];
  dep.depositoArreglos.push({id:uid(),concepto:con||'Arreglo',monto});
  save();openDeposito(depId);
}
function delArreglo(depId,arrId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep||!dep.depositoArreglos)return;
  dep.depositoArreglos=dep.depositoArreglos.filter(a=>a.id!==arrId);
  save();openDeposito(depId);
}
function marcarDepDevuelto(depId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;
  dep.depositoDevuelto=new Date().toISOString().slice(0,10);
  save();closeSheet();render();toast('Depósito marcado como devuelto');
}
function desmarcarDepDevuelto(depId){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;
  dep.depositoDevuelto='';save();openDeposito(depId);
}

const IPC_SEED={'2023-01':6.0,'2023-02':6.6,'2023-03':7.7,'2023-04':8.4,'2023-05':7.8,'2023-06':6.0,'2023-07':6.3,'2023-08':12.4,'2023-09':12.7,'2023-10':8.3,'2023-11':12.8,'2023-12':25.5,'2024-01':20.6,'2024-02':13.2,'2024-03':11.0,'2024-04':8.8,'2024-05':4.2,'2024-06':4.6,'2024-07':4.0,'2024-08':4.2,'2024-09':3.5,'2024-10':2.7,'2024-11':2.4,'2024-12':2.7};
let IPC_CACHE=null;
async function fetchIPC(){
  if(IPC_CACHE)return IPC_CACHE;
  const base=Object.assign({},IPC_SEED,state.ipc||{});
  try{
    const r=await fetch('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&format=json&start_date=2022-12&limit=1000');
    if(r.ok){const j=await r.json();const rows=(j&&j.data)||[];const idx={};rows.forEach(row=>{if(row&&row[0]!=null&&row[1]!=null)idx[String(row[0]).slice(0,7)]=Number(row[1]);});Object.keys(idx).forEach(m=>{const prev=shiftYm(m,-1);if(idx[prev]!=null)base[m]=(idx[m]/idx[prev]-1)*100;});}
  }catch(e){}
  IPC_CACHE=base;try{state.ipc=base;localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}
  return base;
}
function ipcMap(){return IPC_CACHE||Object.assign({},IPC_SEED,state.ipc||{});}
function ymOf(d){return (d||'').slice(0,7);}
function mesesPrevios(ymBase,n){const out=[];let v=ymBase;for(let i=0;i<n;i++){v=shiftYm(v,-1);out.unshift(v);}return out;}
/* Ventana de IPC para un aumento efectivo en effYm.
   El último IPC usable es el publicado el mes anterior al aumento (M-1), que corresponde al mes M-2,
   porque el INDEC publica la inflación de un mes a mitad del mes siguiente.
   Ej: aumento efectivo en ABRIL -> usa diciembre, enero y febrero (febrero sale a mitad de marzo).
       aumento efectivo en JULIO -> usa marzo, abril y mayo. */
function ventanaIPC(effYm,n){return mesesPrevios(shiftYm(effYm,-1),n);}
function sumaVentana(effYm,n,map){const meses=ventanaIPC(effYm,n);let pct=0;const vals=[];for(const m of meses){if(map[m]==null||isNaN(map[m]))return null;const v=Math.round(map[m]*10)/10;pct+=v;vals.push({ym:m,val:v});}return{pct:Math.round(pct*10)/10,vals};}
function sumaIPC(ymAdj,n,map){const meses=mesesPrevios(ymAdj,n);let pct=0;const vals=[];for(const m of meses){if(map[m]==null||isNaN(map[m]))return null;const v=Math.round(map[m]*10)/10;pct+=v;vals.push({ym:m,val:v});}return{pct:Math.round(pct*10)/10,vals};}
function calcAjusteIPC(dep,map){
  const n=dep.ajusteMeses||3;const r=sumaVentana(ym,n,map);
  if(!r)return{ok:false,faltan:ventanaIPC(ym,n)};
  const nuevo=Math.round((dep.alquiler||0)*(1+r.pct/100));
  return{ok:true,pct:r.pct,nuevo,anterior:dep.alquiler||0,nominal:nuevo-(dep.alquiler||0),vals:r.vals};
}
/* Reconstruye el alquiler actual desde el pactado inicial + ajustes pasados */
function reconstruir(dep,map){
  const n=dep.ajusteMeses||0;let cur=dep.alquilerInicial!=null?dep.alquilerInicial:(dep.alquiler||0);const ajustes=[];
  if(!n||!dep.contratoInicio)return{cur,ajustes};
  const startYm=ymOf(dep.contratoInicio);const nowYm=ymNow();let k=1;
  while(true){const adjYm=shiftYm(startYm,k*n);if(cmpYm(adjYm,nowYm)>0)break;const r=sumaVentana(adjYm,n,map);if(!r)break;const anterior=cur;cur=Math.round(cur*(1+r.pct/100));ajustes.push({ym:adjYm,fecha:adjYm+'-15',pct:r.pct,anterior,nuevo:cur,vals:r.vals});k++;}
  return{cur,ajustes};
}
/* Comisión histórica ya ganada (meses transcurridos, según alquiler vigente en cada mes) */
function comisionPrevia(dep){
  if(dep.modalidad==='dueno'||!(dep.comisionPct>0)||!dep.contratoInicio)return 0;
  const startYm=ymOf(dep.contratoInicio);const nowYm=ymNow();const ajs=(dep.ajustes||[]).slice().sort((a,b)=>a.ym<b.ym?-1:1);
  let total=0;let m=startYm;let guard=0;
  while(cmpYm(m,nowYm)<0&&guard<600){let rent=dep.alquilerInicial!=null?dep.alquilerInicial:(dep.alquiler||0);for(const a of ajs){if(cmpYm(a.ym,m)<=0)rent=a.nuevo;}total+=rent*(dep.comisionPct/100);m=shiftYm(m,1);guard++;}
  return Math.round(total);
}
/* Marca como pagados/liquidados los meses previos de un depto ya existente */
function marcarPrevios(dep){
  const startYm=ymOf(dep.contratoInicio);if(!startYm)return;const nowYm=ymNow();let m=startYm;let guard=0;
  while(cmpYm(m,nowYm)<0&&guard<600){if(!state.pagos[m])state.pagos[m]={};state.pagos[m][dep.id]={alq:true,exp:true,ser:true};m=shiftYm(m,1);guard++;}
}
/* Aplica automáticamente los ajustes que ya corresponden y avisa */
function autoAjustes(){
  const map=ipcMap();const nuevos=[];
  // Migración única: recalcular ajustes viejos que quedaron con la ventana de IPC incorrecta
  let fixRan=false;
  if(!(state.config&&state.config.ipcWindowFixed)){
    state.deptos.forEach(d=>{if(d.ajusteMeses>0&&d.contratoInicio&&d.alquilerInicial!=null){d.ajustes=[];d.alquiler=d.alquilerInicial;}});
    if(!state.config)state.config={};state.config.ipcWindowFixed=true;fixRan=true;
  }
  state.deptos.forEach(dep=>{
    if(!dep.ajusteMeses||dep.ajusteMeses<=0||!dep.contratoInicio)return;
    const startYm=ymOf(dep.contratoInicio);const nowYm=ymNow();const horizonte=shiftYm(nowYm,1);let k=1;let guard=0;
    while(guard<300){guard++;const effYm=shiftYm(startYm,k*dep.ajusteMeses);if(cmpYm(effYm,horizonte)>0)break; // no precomputar más allá del mes que viene
      const yaHecho=(dep.ajustes||[]).some(a=>a.ym===effYm);
      if(!yaHecho){const r=sumaVentana(effYm,dep.ajusteMeses,map);if(r){const anterior=alquilerEnMes(dep,shiftYm(effYm,-1));const nuevo=Math.round(anterior*(1+r.pct/100));dep.ajustes=dep.ajustes||[];dep.ajustes.push({ym:effYm,fecha:new Date().toISOString().slice(0,10),pct:r.pct,anterior,nuevo,vals:r.vals});if(!fixRan&&cmpYm(effYm,nowYm)>=0)nuevos.push({dep,ym:effYm,pct:r.pct,anterior,nuevo,vals:r.vals,n:dep.ajusteMeses});}}
      k++;}
    dep.alquiler=alquilerEnMes(dep,ymNow()); // el "actual" es el vigente este mes real
  });
  if(nuevos.length){save();render();cartelAjustes(nuevos);}
  else if(fixRan){save();render();}
}
function periodoLabel(n){return n===3?'trimestral':n===4?'cuatrimestral':n===6?'semestral':n===12?'anual':'periódico';}
function msgAumento(dep,aj){const n=dep.ajusteMeses||3;const meses=(aj.vals||[]).map(v=>ymLabel(v.ym)).join(', ');const vars={inquilino:dep.inqNombre||dep.inquilino||'',depto:dep.nombre,periodo:periodoLabel(n),ipc:aj.pct.toFixed(1),nuevo:curMoney(dep,aj.nuevo),anterior:curMoney(dep,aj.anterior),desde:aj.ym?ymLabel(aj.ym):'',meses,firma:firmaOrg()};return fillTpl(tpl('aumento'),vars);}
function cartelAjustes(list){
  const cards=list.map(a=>{
    const filas=(a.vals||[]).map(x=>`<div class="liq-line"><span>Inflación ${ymLabel(x.ym)}</span><span>${x.val.toFixed(1)}%</span></div>`).join('');
    const wa=a.dep.telInquilino?`<a class="btn btn-primary" style="text-decoration:none;margin-top:8px" href="https://wa.me/${digits(a.dep.telInquilino)}?text=${encodeURIComponent(msgAumento(a.dep,{pct:a.pct,nuevo:a.nuevo,ym:a.ym}))}" target="_blank" rel="noopener">${WA_SVG} Informar al inquilino</a>`:'<div class="sub" style="text-align:center;margin-top:8px">Cargá el WhatsApp del inquilino para informarle.</div>';
    return `<div class="card" style="box-shadow:none;border:1px solid var(--line)"><div class="card-name">${esc(a.dep.nombre)}</div>
      <div class="sub" style="margin-top:2px">Rige a partir de ${ymLabel(a.ym)}</div>
      <div class="liq-line tot" style="margin-top:6px"><span>Aumento ${a.pct.toFixed(1)}%</span><span class="pos">${curMoney(a.dep,a.anterior)} → ${curMoney(a.dep,a.nuevo)}</span></div>
      <details style="margin-top:6px"><summary style="cursor:pointer;font-size:13px;color:var(--green);font-weight:700">Ver cálculo (inflación mes a mes)</summary><div style="margin-top:8px">${filas}<div class="liq-line tot"><span>Suma (${a.n} meses)</span><span class="pos">${a.pct.toFixed(1)}%</span></div></div></details>
      ${wa}</div>`;
  }).join('');
  openSheet(`<div style="text-align:center"><div style="font-size:40px">📈</div><h3 style="margin-top:6px">Aumento por IPC</h3><p class="hint">${list.length} ${list.length===1?'propiedad con aumento':'propiedades con aumento'}. Avisale al inquilino.</p></div>${cards}<button class="btn btn-ghost" style="margin-top:10px" onclick="closeSheet()">Listo</button>`);
}
async function ensureIPC(){try{await fetchIPC();}catch(e){}autoAjustes();}
/* Popup INFORMATIVO de un aumento ya aplicado */
function openAjusteInfo(depId,ajYm){
  const dep=state.deptos.find(d=>d.id===depId);if(!dep)return;const aj=(dep.ajustes||[]).find(a=>a.ym===ajYm);if(!aj){toast('Sin datos del ajuste');return;}
  const n=dep.ajusteMeses||3;const nominal=aj.nuevo-aj.anterior;
  const filas=(aj.vals||[]).map(x=>`<div class="liq-line"><span>Inflación ${ymLabel(x.ym)}</span><span>${x.val.toFixed(1)}%</span></div>`).join('');
  const esFuturo=cmpYm(aj.ym,ymNow())>0;
  const wa=dep.telInquilino?`<a class="btn btn-primary" style="text-decoration:none" href="https://wa.me/${digits(dep.telInquilino)}?text=${encodeURIComponent(msgAumento(dep,aj))}" target="_blank" rel="noopener">${WA_SVG} ${esFuturo?'Avisar el aumento al inquilino':'Informar al inquilino'}</a>`:`<div class="sub" style="text-align:center">Cargá el WhatsApp del inquilino para poder informarle.</div>`;
  const mesesTxt=(aj.vals||[]).map(x=>ymLabel(x.ym)).join(', ');
  openSheet(`<div style="text-align:center"><div style="font-size:38px">📈</div><h3 style="margin-top:6px">Aumento por IPC</h3><p class="hint">${esc(dep.nombre)} · rige a partir de <b>${ymLabel(aj.ym)}</b></p></div>
    <div class="aviso-aumento" style="cursor:default">${esFuturo?'📣 Avisale ahora al inquilino: este aumento se aplica el mes que viene ('+ymLabel(aj.ym)+'), usando el IPC recién publicado de '+mesesTxt+'.':'Este aumento ya rige este mes. Se calculó con el IPC de '+mesesTxt+'.'}</div>
    <div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:10px">
      ${filas}
      <div class="liq-line tot"><span>Suma (${n} ${n===1?'mes':'meses'})</span><span class="pos">${aj.pct.toFixed(1)}%</span></div>
      <div class="liq-line"><span>Aumento</span><span>${curMoney(dep,nominal)}</span></div>
      <div class="liq-line"><span>Alquiler anterior</span><span style="color:var(--muted)">${curMoney(dep,aj.anterior)}</span></div>
      <div class="liq-line tot"><span>Nuevo alquiler</span><span>${curMoney(dep,aj.nuevo)}</span></div></div>
    <div style="margin-top:8px">${wa}</div>
    <button class="btn btn-ghost" style="margin-top:10px" onclick="closeSheet()">Cerrar</button>`);
}
/* Cuando falta el dato del IPC: informativo, se aplica solo al publicarse */
async function openAjuste(id){const dep=state.deptos.find(d=>d.id===id);
  openSheet(`<div style="text-align:center"><div style="font-size:38px">⏳</div><h3 style="margin-top:6px">Ajuste por IPC pendiente</h3><p class="hint">${esc(dep.nombre)}</p></div>
    <div id="ipc_box" class="card" style="box-shadow:none;border:1px solid var(--line)"><div style="text-align:center;color:var(--muted);font-size:13px">Consultando la inflación del INDEC…</div></div>
    <button class="btn btn-ghost" style="margin-top:10px" onclick="closeSheet()">Cerrar</button>`);
  try{const map=await fetchIPC();const r=calcAjusteIPC(dep,map);const box=document.getElementById('ipc_box');if(!box)return;
    if(r.ok){closeSheet();autoAjustes();}
    else{box.innerHTML=`<div style="font-size:13px;color:var(--amber);font-weight:700">Todavía no se publicó la inflación de: ${r.faltan.map(ymLabel).join(', ')}.</div><div style="font-size:12.5px;color:var(--muted);margin-top:6px">El ajuste se aplica <b>solo</b> apenas el INDEC publique el dato (suele salir a mitad del mes siguiente). No tenés que hacer nada.</div>`;}
  }catch(e){const box=document.getElementById('ipc_box');if(box)box.innerHTML=`<div style="font-size:13px;color:var(--muted)">No se pudo conectar a la fuente del IPC. Reintentá con internet.</div>`;}
}

function openAlquiler(preId){const dp=preId?state.deptos.find(d=>d.id===preId):null;alqTipo=(dp&&dp.inquilino)?'renovacion':'nuevo';const opts=state.deptos.map(d=>`<option value="${d.id}" ${preId===d.id?'selected':''}>${esc(d.nombre)} — ${esc(ownerName(d.duenoId))}</option>`).join('');
  openSheet(`
    <h3>Registrar alquiler</h3>
    <p class="hint">Registrá la operación y la comisión de garantía que cobrás por conseguir inquilino.</p>
    <div class="field"><label>Tipo de operación</label>
      <div class="seg" id="al_tipo">
        <button type="button" class="${alqTipo==='nuevo'?'on':''}" onclick="pickTipo('nuevo')">Propiedad nueva</button>
        <button type="button" class="${alqTipo==='renovacion'?'on':''}" onclick="pickTipo('renovacion')">Renovación</button></div>
      <div class="sub">“Propiedad nueva” = un dueño te dio una propiedad que no administrabas. “Renovación” = una propiedad que ya tenías cambió de inquilino.</div></div>
    <div class="field"><label>Propiedad</label><select id="al_depto">${opts||'<option>Primero cargá propiedades</option>'}</select></div>
    <div class="field"><label>Inquilino nuevo</label><input id="al_inq" placeholder="Nombre"></div>
    <div class="row2">
      <div class="field"><label>Alquiler pactado</label><input id="al_alq" type="number" inputmode="numeric" placeholder="0"></div>
      <div class="field"><label>Comisión garantía</label><input id="al_gar" type="number" inputmode="numeric" placeholder="0"></div></div>
    <div class="row2">
      <div class="field"><label>Fecha de inicio</label><input id="al_fecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>Fin de contrato</label><input id="al_fin" type="month"></div></div>
    <div class="field"><label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600"><input type="checkbox" id="al_update" checked style="width:20px;height:20px"> Actualizar la propiedad (inquilino, alquiler, contrato)</label></div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" onclick="closeSheet()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAlquiler()">Guardar</button></div>`);
}
let alqTipo='nuevo';function pickTipo(v){alqTipo=v;document.querySelectorAll('#al_tipo button').forEach((b,i)=>b.classList.toggle('on',(v==='nuevo')?i===0:i===1));}
function saveAlquiler(){const deptoId=document.getElementById('al_depto').value;const dep=state.deptos.find(d=>d.id===deptoId);if(!dep){toast('Cargá una propiedad primero');return;}
  const num=v=>{const n=parseFloat(document.getElementById(v).value);return isNaN(n)?0:n;};
  const inq=document.getElementById('al_inq').value.trim();const alq=num('al_alq'),gar=num('al_gar'),fecha=document.getElementById('al_fecha').value,fin=document.getElementById('al_fin').value;
  state.alquileres.push({id:uid(),deptoId,deptoNombre:dep.nombre,inquilino:inq,alquiler:alq,garantia:gar,fecha,fin,tipo:alqTipo,cobrada:false});
  if(document.getElementById('al_update').checked){if(inq)dep.inquilino=inq;if(alq)dep.alquiler=alq;if(fecha)dep.contratoInicio=fecha.slice(0,7);if(fin)dep.contratoFin=fin;dep.estado='alquilado';}
  save();closeSheet();render();toast('Alquiler registrado');}
function toggleCobrada(id){const a=state.alquileres.find(x=>x.id===id);a.cobrada=!a.cobrada;save();render();}
function delAlquiler(id){if(!confirm('¿Borrar este registro?'))return;state.alquileres=state.alquileres.filter(x=>x.id!==id);save();render();}

function openSettings(){
  const cfg=state.config||{};const org=cfg.organizador||{};const cob=cfg.cobranza||{diasRecordar:5,diasReclamar:10};
  const ownersHtml=state.duenos.length?state.duenos.map(o=>{const n=state.deptos.filter(d=>d.duenoId===o.id).length;return `<div class="owner-row"><div><div class="nm">${esc(ownerName(o.id))}</div><div class="sm">${n} ${n===1?'propiedad':'propiedades'}${o.telefono?' · 📱 '+esc(o.telefono):''}</div></div><div class="acts"><button class="btn-ghost" onclick="editOwner('${o.id}')">Editar</button>${n===0?`<button class="btn-danger" onclick="delOwner('${o.id}')">Borrar</button>`:''}</div></div>`;}).join(''):'<div class="sm" style="color:var(--muted);font-size:13px">Todavía no hay dueños.</div>';
  openSheet(`
    <h3>Ajustes</h3>
    <p class="hint">Los datos viven en este dispositivo. Guardá una copia cada tanto.</p>
    <div class="settings-item"><div><div class="t">Tu perfil</div><div class="d">${org.nombre?esc(org.nombre):'Sin nombre'}${org.tel?' · '+esc(org.tel):''}</div></div><button class="btn btn-ghost btn-sm" onclick="editOrganizador()">Editar</button></div>
    <div class="settings-item"><div><div class="t">Cambiar contraseña</div><div class="d">Actualizá tu clave de acceso</div></div><button class="btn btn-ghost btn-sm" onclick="editPassword()">Cambiar</button></div>
    <div class="settings-item"><div><div class="t">Ver tutorial</div><div class="d">Repasá cómo funciona el panel</div></div><button class="btn btn-ghost btn-sm" onclick="startTour()">Ver</button></div>
    <div class="settings-item"><div><div class="t">Letra más grande</div><div class="d">Agranda los textos de toda la app</div></div><button class="btn ${cfg.textoGrande?'btn-primary':'btn-ghost'} btn-sm" onclick="toggleTextoGrande()">${cfg.textoGrande?'Activada ✓':'Activar'}</button></div>
    <div class="settings-item"><div><div class="t">Vencimiento por defecto</div><div class="d">El pago vence el día ${cob.diaVencimiento||10} · después se avisa a la garantía</div></div><button class="btn btn-ghost btn-sm" onclick="editCobranza()">Editar</button></div>
    <div class="settings-item"><div><div class="t">Mensajes</div><div class="d">Personalizá los textos automáticos</div></div><button class="btn btn-ghost btn-sm" onclick="editMensajes()">Editar</button></div>
    <div class="settings-item"><div><div class="t">Descargar copia</div><div class="d">Archivo con todos tus datos</div></div><button class="btn btn-ghost btn-sm" onclick="exportData()">Descargar</button></div>
    <div class="settings-item"><div><div class="t">Restaurar copia</div><div class="d">Cargar un archivo guardado</div></div><button class="btn btn-ghost btn-sm" onclick="document.getElementById('importFile').click()">Elegir</button></div>
    <input type="file" id="importFile" accept="application/json" style="display:none" onchange="importData(event)">
    <h2 class="section" style="margin-top:20px">Dueños</h2>
    <div class="card" style="box-shadow:none;border:1px solid var(--line)">${ownersHtml}</div>
    <div class="settings-item" style="margin-top:14px"><div><div class="t">Cerrar sesión</div><div class="d">Salís de la cuenta en este dispositivo</div></div><button class="btn btn-ghost btn-sm" onclick="logout()">Salir</button></div>
    <div class="settings-item" style="margin-top:14px"><div><div class="t" style="color:var(--red)">Borrar todo</div><div class="d">Empezar de cero</div></div><button class="btn btn-danger btn-sm" onclick="wipe()">Borrar</button></div>
    <div style="text-align:center;color:var(--muted);font-size:12px;margin-top:16px">${state.deptos.length} propiedades · ${state.duenos.length} dueños · ${state.alquileres.length} alquileres</div>`);
}
function editOwner(id){const o=owner(id);
  openSheet(`
    <h3>Editar dueño</h3>
    <div class="row2">
      <div class="field"><label for="o_ap">Apellido</label><input id="o_ap" value="${esc(o.apellido||'')}"></div>
      <div class="field"><label for="o_nombre">Nombre</label><input id="o_nombre" value="${esc(o.nombre||'')}"></div></div>
    <div class="row2">
      <div class="field"><label for="o_dni">DNI</label><input id="o_dni" inputmode="numeric" value="${esc(o.dni||'')}"></div>
      <div class="field"><label for="o_tel">Teléfono</label><input id="o_tel" inputmode="tel" placeholder="Ej: 11 5555 5555" value="${esc(o.telefono||'')}"></div></div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" onclick="openSettings()">Volver</button>
      <button class="btn btn-primary" onclick="saveOwner('${id}')">Guardar</button></div>`);
}
function saveOwner(id){const o=owner(id);const nm=document.getElementById('o_nombre').value.trim();const ap=document.getElementById('o_ap').value.trim();if(!ap&&!nm){toast('Poné apellido y nombre');return;}o.apellido=ap;o.nombre=nm;o.dni=document.getElementById('o_dni').value.trim();o.telefono=document.getElementById('o_tel').value.trim();save();openSettings();render();toast('Dueño actualizado');}
function delOwner(id){if(!confirm('¿Borrar este dueño?'))return;state.duenos=state.duenos.filter(d=>d.id!==id);save();openSettings();render();toast('Dueño borrado');}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='alquileres-'+ymNow()+'.json';a.click();toast('Copia descargada');}
function importData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.duenos)throw 0;if(!d.config)d.config={onboarded:true,organizador:{nombre:'',tel:''},pin:''};state=d;save();closeSheet();render();toast('Datos restaurados');}catch(x){toast('Archivo inválido');}};r.readAsText(f);}
function wipe(){if(!confirm('¿Borrar TODOS los datos? No se puede deshacer.'))return;state={duenos:[],deptos:[],pagos:{},alquileres:[],config:state.config};save();closeSheet();render();toast('Todo borrado');}

let toastT;function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2200);}

/* ===== Organizadora, bienvenida y tutorial ===== */
function firmaOrg(){const o=state.config&&state.config.organizador;return o&&o.nombre?'\n\n— '+o.nombre:'';}
const TPL_DEFAULT={
  recordatorio:'Hola {inquilino}! Te recuerdo que tenés pendiente el pago de {items} de {mes} del depto {depto}. ¡Gracias!{firma}',
  critico:'Hola {inquilino}! El pago de {items} de {mes} del depto {depto} está muy atrasado. Te pido que lo regularices a la brevedad para no tener que iniciar el reclamo a la garantía.{firma}',
  aumento:'Hola {inquilino}, te aviso con anticipación que, según lo estipulado en el contrato con ajuste {periodo}, a partir de {desde} el alquiler se ajusta un {ipc}% tomando como fuente la inflación del INDEC de {meses}, quedando en {nuevo} (antes {anterior}). ¡Muchas gracias!{firma}',
  garantia:'Hola {garantia}! Les informo un atraso de pago en un depto con garantía de caución. Depto: {depto}. Inquilino: {inquilino}. Adeuda: {items} de {mes}. Por favor avancen con el procedimiento correspondiente. Gracias.{firma}'
};
function tpl(key){const p=(state.config&&state.config.plantillas)||{};return (p[key]!=null&&p[key]!=='')?p[key]:TPL_DEFAULT[key];}
function fillTpl(str,vars){return String(str).replace(/\{(\w+)\}/g,(m,k)=>vars[k]!=null?vars[k]:'');}
function cmpYm(a,b){return a<b?-1:a>b?1:0;}
const PILL={ok:['Al día','pill-ok'],proximo:['Por pagar','pill-neutral'],pendiente:['Falta pagar','pill-warn'],recordar:['Falta pagar','pill-warn'],critico:['Atrasado','pill-debt']};
function habilesTranscurridos(){const now=new Date();const y=now.getFullYear(),m=now.getMonth();let c=0;for(let d=1;d<=now.getDate();d++){const wd=new Date(y,m,d).getDay();if(wd!==0&&wd!==6)c++;}return c;}
function cobranza(dep){
  const p=pagos(dep.id);
  if(estaAlDia(dep))return{nivel:'ok'};
  if(p.alq)return{nivel:'pendiente'};
  const rel=cmpYm(ym,ymNow());
  if(rel>0)return{nivel:'proximo'};
  if(rel<0)return{nivel:'critico'};        // mes pasado impago => vencido
  const due=diaVenc(dep);const hoy=diaHoy();const recStart=Math.max(1,Math.ceil(due/2));
  if(hoy>due)return{nivel:'critico',due,dia:hoy};        // vencido (día siguiente al vencimiento)
  if(hoy>=recStart)return{nivel:'recordar',due,dia:hoy};  // ya conviene recordar
  return{nivel:'proximo',due,dia:hoy};
}
function mailtoGar(dep){
  const subj='Atraso de pago — '+dep.nombre;
  const body=garantiaText(dep);
  const mail=dep.garantiaMail||'';
  // Gmail compose web — abre en nueva solapa en desktop, app de Gmail en mobile
  return 'https://mail.google.com/mail/?view=cm&to='+encodeURIComponent(mail)+'&su='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);
}
function itemsAdeuda(dep){const p=pagos(dep.id);const f=[];if(!p.alq)f.push('alquiler');if(dep.expensas&&!p.exp)f.push('expensas');if(!servPagos(dep).allPaid)f.push('servicios');if(f.length<=1)return f[0]||'alquiler';return f.slice(0,-1).join(', ')+' y '+f[f.length-1];}
function reminderText(dep,nivel){
  const vars={inquilino:dep.inqNombre||dep.inquilino||'',depto:dep.nombre,mes:ymLabel(ym),items:itemsAdeuda(dep),alquiler:curMoney(dep,alquilerEnMes(dep)),firma:firmaOrg()};
  return fillTpl(tpl(nivel==='critico'?'critico':'recordatorio'),vars);
}
function garantiaText(dep){
  const vars={garantia:dep.garantiaEmpresa||'',depto:dep.nombre,inquilino:dep.inqNombre||dep.inquilino||'—',mes:ymLabel(ym),items:itemsAdeuda(dep),firma:firmaOrg()};
  return fillTpl(tpl('garantia'),vars);
}
function hideGate(){const g=document.getElementById('gate');g.classList.remove('show');g.innerHTML='';}

function editOrganizador(){const cfg=state.config;const o=cfg.organizador||{};
  openSheet(`
    <h3>Tu perfil</h3>
    <p class="hint">Con esto se firman los recordatorios que le mandás por WhatsApp a los inquilinos.</p>
    <div class="field"><label>Tu nombre</label><input id="og_nombre" placeholder="Ej: Marta" value="${esc(o.nombre||'')}"></div>
    <div class="field"><label>Tu WhatsApp</label><input id="og_tel" inputmode="tel" placeholder="Ej: 11 5555 5555" value="${esc(o.tel||'')}"></div>
    <div class="sheet-actions"><button class="btn btn-ghost" onclick="openSettings()">Volver</button><button class="btn btn-primary" onclick="saveOrganizador()">Guardar</button></div>`);
}
function saveOrganizador(){const cfg=state.config;cfg.organizador={nombre:document.getElementById('og_nombre').value.trim(),tel:document.getElementById('og_tel').value.trim()};save();openSettings();render();toast('Perfil guardado');}
function editCobranza(){const c=(state.config&&state.config.cobranza)||{};
  openSheet(`
    <h3>Vencimiento por defecto</h3>
    <p class="hint">Día corrido del mes en que vence el pago. Ej: 10 → el día 11 ya está vencido. Desde la mitad del plazo aparece el botón para recordarle al inquilino; una vez vencido, el aviso pasa a la garantía. Cada propiedad puede tener su propio día.</p>
    <div class="field"><label>Día de vencimiento (corrido)</label><input id="cb_venc" type="number" inputmode="numeric" min="1" max="31" value="${c.diaVencimiento||10}"></div>
    <div class="sheet-actions"><button class="btn btn-ghost" onclick="openSettings()">Volver</button><button class="btn btn-primary" onclick="saveCobranza()">Guardar</button></div>`);
}
function saveCobranza(){const v=parseInt(document.getElementById('cb_venc').value);const dia=isNaN(v)?10:Math.min(31,Math.max(1,v));state.config.cobranza={diaVencimiento:dia};save();openSettings();render();toast('Vencimiento actualizado');}
function editPassword(){
  openSheet(`
    <h3>Cambiar contraseña</h3>
    <p class="hint">Elegí una nueva contraseña (mínimo 6 caracteres).</p>
    <div class="field"><label>Nueva contraseña</label><input id="pw_new" type="password" placeholder="••••••"></div>
    <div class="field"><label>Repetir contraseña</label><input id="pw_rep" type="password" placeholder="••••••"></div>
    <div class="gate-err" id="pw_err"></div>
    <div class="sheet-actions"><button class="btn btn-ghost" onclick="openSettings()">Volver</button><button class="btn btn-primary" onclick="savePassword()">Guardar</button></div>`);
}
async function savePassword(){
  const a=document.getElementById('pw_new').value,b=document.getElementById('pw_rep').value;const err=document.getElementById('pw_err');
  if(a.length<6){err.textContent='La contraseña debe tener al menos 6 caracteres.';return;}
  if(a!==b){err.textContent='Las contraseñas no coinciden.';return;}
  err.textContent='Guardando…';
  try{const{error}=await sb.auth.updateUser({password:a});if(error){err.textContent=error.message||'No se pudo cambiar la contraseña.';return;}closeSheet();toast('Contraseña actualizada');}
  catch(e){err.textContent='No se pudo cambiar la contraseña. Reintentá con internet.';}
}
const TPL_META={
  recordatorio:{titulo:'Recordatorio de pago',ph:['inquilino','depto','mes','items','alquiler','firma']},
  critico:{titulo:'Reclamo (atrasado)',ph:['inquilino','depto','mes','items','alquiler','firma']},
  aumento:{titulo:'Aviso de aumento por IPC',ph:['inquilino','depto','periodo','ipc','nuevo','anterior','desde','meses','firma']},
  garantia:{titulo:'Aviso a la garantía',ph:['garantia','depto','inquilino','mes','items','firma']}
};
const PH_DESC={inquilino:'nombre del inquilino',depto:'dirección de la propiedad',mes:'mes',items:'lo que adeuda',alquiler:'alquiler actual',firma:'tu firma',periodo:'trimestral/…',ipc:'% de aumento',nuevo:'alquiler nuevo',anterior:'alquiler anterior',desde:'mes en que rige',meses:'meses de IPC usados',garantia:'empresa de garantía'};
function editMensajes(){
  const items=Object.keys(TPL_META).map(k=>`<div class="settings-item"><div><div class="t">${TPL_META[k].titulo}</div><div class="d">${(state.config&&state.config.plantillas&&state.config.plantillas[k])?'Personalizado':'Por defecto'}</div></div><button class="btn btn-ghost btn-sm" onclick="editPlantilla('${k}')">Editar</button></div>`).join('');
  openSheet(`<h3>Mensajes automáticos</h3><p class="hint">Editá el texto genérico. Lo que va entre { } se completa solo con los datos de cada propiedad.</p>${items}<button class="btn btn-ghost" style="margin-top:8px" onclick="openSettings()">Volver</button>`);
}
function editPlantilla(key){
  const meta=TPL_META[key];const val=tpl(key);
  const chips=meta.ph.map(p=>`<button type="button" class="ph-chip" onclick="insertPh('tpl_area','{${p}}')">{${p}} <span>${PH_DESC[p]||''}</span></button>`).join('');
  openSheet(`<h3>${meta.titulo}</h3>
    <p class="hint">Tocá un dato para insertarlo donde tengas el cursor. La app lo reemplaza por el valor real al enviar.</p>
    <div class="field"><textarea id="tpl_area" rows="6">${esc(val)}</textarea></div>
    <div class="ph-list">${chips}</div>
    <div class="tpl-preview" id="tpl_prev"></div>
    <div class="sheet-actions" style="margin-top:12px">
      <button class="btn btn-danger btn-sm" onclick="resetPlantilla('${key}')">Restaurar</button>
      <button class="btn btn-ghost btn-sm" onclick="editMensajes()">Volver</button>
      <button class="btn btn-primary btn-sm" onclick="savePlantilla('${key}')">Guardar</button></div>`);
  const area=document.getElementById('tpl_area');
  const upd=()=>{document.getElementById('tpl_prev').textContent='Vista previa: '+previewTpl(key,area.value);};
  area.addEventListener('input',upd);upd();
}
function previewTpl(key,str){
  const demo={inquilino:'Juan Pérez',depto:'Av. Corrientes 1234, Piso 4 Depto B',mes:'agosto 2026',items:'alquiler y expensas',alquiler:'$500.000',periodo:'trimestral',ipc:'6.0',nuevo:'$530.000',anterior:'$500.000',desde:'julio 2026',meses:'marzo, abril y mayo',garantia:'Finaer',firma:(state.config&&state.config.organizador&&state.config.organizador.nombre)?('\n\n— '+state.config.organizador.nombre):''};
  return fillTpl(str,demo);
}
function insertPh(areaId,text){const a=document.getElementById(areaId);if(!a)return;const s=a.selectionStart||a.value.length,e=a.selectionEnd||a.value.length;a.value=a.value.slice(0,s)+text+a.value.slice(e);a.focus();a.selectionStart=a.selectionEnd=s+text.length;a.dispatchEvent(new Event('input'));}
function savePlantilla(key){const v=document.getElementById('tpl_area').value;if(!state.config.plantillas)state.config.plantillas={};state.config.plantillas[key]=v;save();render();editMensajes();toast('Mensaje guardado');}
function resetPlantilla(key){if(state.config.plantillas)delete state.config.plantillas[key];save();render();editPlantilla(key);toast('Restaurado por defecto');}

let obStep=0, obTourOnly=false;
function obSteps(){
  const s=[{type:'org'},
    {emoji:'🏢',title:'Propiedades',text:'Empezá por acá: <b>cargás cada propiedad</b> con su dueño, alquiler, comisión, contrato, servicios, cómo se cobra y el <b>depósito de garantía</b> (en pesos o dólares). Al terminar el contrato descontás los arreglos y ves cuánto devolverle. Adentro tenés la solapa <b>Vencimientos</b>, que te avisa qué contratos están por vencer y qué unidades están vacías para publicar a tiempo.'},
    {emoji:'📅',title:'Seguimiento',text:'Tu tablero del mes. Con un toque marcás quién pagó <b>alquiler</b>, <b>expensas</b> y <b>servicios</b> (verde = pagó, rojo = debe). Arriba ves lo cobrado, tu comisión y una tarjeta de <b>propiedades sin cobrar</b> que, al tocarla, te filtra la lista. Desde cada una mandás el <b>recordatorio por WhatsApp</b>.'},
    {emoji:'👥',title:'Dueños',text:'Te calcula solo cuánto <b>liquidarle a cada dueño</b> y cuánto es tu comisión. Marcás las transferencias y le avisás por <b>WhatsApp</b> con el detalle por propiedad y el total. Si un dueño te debe a vos, también te lo marca.'},
    {emoji:'🛡️',title:'Garantes',text:'Agrupa tus propiedades por <b>empresa de garantía</b>: ves cuántas cubre, la masa cubierta y cuáles están en reclamo. Con un clic mandás el <b>reclamo por mail ya redactado</b>, con todas las propiedades atrasadas.'},
    {emoji:'📊',title:'Dashboard',text:'Tus números para mostrarle a los dueños: <b>ocupación, morosidad, comisión y vencimientos</b>. Y te tira <b>alertas de aumentos por IPC</b> cuando corresponde avisarle al inquilino.'},
    {emoji:'⚙️',title:'Ajustes y guardado',text:'En <b>Configuración</b> ajustás los recordatorios, activás <b>Letra más grande</b> y bajás una <b>copia de seguridad</b>. Todo se guarda solo: arriba a la derecha ves “Guardando / Guardado”, y te avisa si te quedás sin conexión.'}];
  return s;
}
function openOnboarding(tourOnly){obTourOnly=tourOnly;obStep=tourOnly?1:0;renderOnboarding();}
function renderOnboarding(){
  const g=document.getElementById('gate');g.classList.add('show');
  const org=(state.config&&state.config.organizador)||{nombre:'',tel:''};
  const steps=obSteps();const total=steps.length;const s=steps[obStep];
  let body;
  if(s.type==='org'){
    body=`<div class="gate-emoji">🏠</div><h2>¡Hola! Bienvenida</h2>
      <p class="gate-p">Soy tu panel de alquileres. En 30 segundos te muestro cómo funciona.<br>Primero, ¿cómo te presentás?</p>
      <div class="field" style="text-align:left;margin-bottom:12px"><label>Tu nombre</label><input id="ob_nombre" placeholder="Ej: Marta" value="${esc(org.nombre)}"></div>
      <div class="field" style="text-align:left"><label>Tu WhatsApp <span style="color:var(--muted);font-weight:400">(para firmar los recordatorios)</span></label><input id="ob_tel" inputmode="tel" placeholder="Ej: 11 5555 5555" value="${esc(org.tel)}"></div>`;
  }else{
    body=`<div class="gate-emoji">${s.emoji}</div><h2>${s.title}</h2><p class="gate-p">${s.text}</p>`;
  }
  const dots=steps.map((_,i)=>`<span class="dot ${i===obStep?'on':''}"></span>`).join('');
  const isLast=obStep===total-1;
  g.innerHTML=`<div class="gate-card">${body}
    <div class="ob-dots">${dots}</div>
    <div class="ob-nav">
      ${obStep>(obTourOnly?1:0)?`<button class="btn btn-ghost" onclick="obBack()">Atrás</button>`:''}
      <button class="btn btn-primary" onclick="obNext()">${isLast?(obTourOnly?'Cerrar':'Empezar'):'Siguiente'}</button>
    </div></div>`;
}
function captureOb(){const n=document.getElementById('ob_nombre');if(n)state.config.organizador.nombre=n.value.trim();const t=document.getElementById('ob_tel');if(t)state.config.organizador.tel=t.value.trim();}
function obBack(){captureOb();if(obStep>0){obStep--;renderOnboarding();}}
function obNext(){captureOb();const total=obSteps().length;if(obStep<total-1){obStep++;renderOnboarding();}else{finishOnboarding();}}
function finishOnboarding(){state.config.onboarded=true;save();hideGate();if(!obTourOnly){go('deptos');setTimeout(()=>toast('¡Listo! Empezá cargando tu primera propiedad'),300);}else{toast('Tutorial terminado');}}
function startTour(){closeSheet();openOnboarding(true);}

function boot(){applyTextoGrande();render();if(!state.config.onboarded){openOnboarding(false);}ensureIPC();}
function applyTextoGrande(){document.body.classList.toggle('big-text',!!(state.config&&state.config.textoGrande));}
function toggleTextoGrande(){if(!state.config)state.config={};state.config.textoGrande=!state.config.textoGrande;applyTextoGrande();save();openSettings();}

/* ============ Login + sincronización con Supabase ============ */
async function authBoot(){
  const cfgOk = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length>20;
  if(!cfgOk){document.getElementById('gate').classList.add('show');document.getElementById('gate').innerHTML=`<div class="gate-card"><div class="gate-emoji">⚙️</div><h2>Falta configurar Supabase</h2><p class="gate-p">Abrí <b>index.html</b> con un editor de texto y pegá tu <b>Project URL</b> y tu <b>anon key</b> donde dice “PEGAR AQUÍ”. Seguí la guía, Parte 1.</p></div>`;return;}
  const {data:{session}}=await sb.auth.getSession();
  if(session){sbUser=session.user;await afterLogin();}
  else{showLogin(false);}
  sb.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT')location.reload();});
}
async function afterLogin(){
  document.getElementById('gate').classList.remove('show');
  try{
    const {data,error}=await sb.from('panel_data').select('data').eq('user_id',sbUser.id).maybeSingle();
    if(error)throw error;
    if(data&&data.data&&data.data.duenos){state=data.data;if(!state.config)state.config={onboarded:true,organizador:{nombre:'',tel:''},pin:'',cobranza:{diasRecordar:5,diasReclamar:10}};localStorage.setItem(KEY,JSON.stringify(state));}
  }catch(e){toast('Sin conexión — trabajando con los datos de este equipo');}
  remoteReady=true;
  boot();
  pushRemote();
}
function showLogin(isSignup){
  const g=document.getElementById('gate');g.classList.add('show');
  g.innerHTML=`<div style="max-width:400px;width:100%;margin:auto">
    <div style="text-align:center;color:#fff;padding:8px 8px 22px">
      <div style="font-size:46px;line-height:1">🏢</div>
      <div style="font-size:34px;font-weight:800;letter-spacing:.04em;margin-top:8px">ADMINISTRIA</div>
      <div style="font-size:16px;font-weight:600;color:#d7f2e6;margin-top:8px;line-height:1.4">Todos tus alquileres, bajo control.</div>
      <div style="font-size:13.5px;color:#a9dcc6;margin-top:6px;line-height:1.5">Cobros, dueños, vencimientos y ajustes por IPC — en un solo lugar, desde el celu o la compu.</div>
    </div>
    <div class="gate-card" style="margin:0">
      <h2 style="font-size:19px">${isSignup?'Crear cuenta':'Ingresar'}</h2>
      <p class="gate-p">${isSignup?'Creá el usuario una sola vez.':'Entrá con tu email y contraseña.'}</p>
      <div class="field" style="text-align:left"><label for="lg_email">Email</label><input id="lg_email" type="email" inputmode="email" autocomplete="email" placeholder="tucorreo@gmail.com"></div>
      <div class="field" style="text-align:left"><label for="lg_pass">Contraseña</label><input id="lg_pass" type="password" autocomplete="${isSignup?'new-password':'current-password'}" placeholder="••••••"></div>
      ${isSignup?`<div class="field" style="text-align:left"><label for="lg_pass2">Repetir contraseña</label><input id="lg_pass2" type="password" autocomplete="new-password" placeholder="••••••"></div>`:''}
      <div class="gate-err" id="lg_err" role="alert"></div>
      <button class="btn btn-primary" onclick="doAuth(${isSignup})">${isSignup?'Crear cuenta':'Entrar'}</button>
      <button class="gate-link" onclick="showLogin(${!isSignup})">${isSignup?'Ya tengo cuenta, ingresar':'Crear una cuenta nueva'}</button>
    </div>
  </div>`;
  return;
}
async function doAuth(isSignup){
  const email=document.getElementById('lg_email').value.trim();
  const pass=document.getElementById('lg_pass').value;
  const err=document.getElementById('lg_err');
  if(!email||!pass){err.textContent='Completá email y contraseña';return;}
  if(isSignup){
    if(pass.length<6){err.textContent='La contraseña debe tener al menos 6 caracteres.';return;}
    const pass2=(document.getElementById('lg_pass2')||{}).value||'';
    if(pass!==pass2){err.textContent='Las contraseñas no coinciden. Volvé a escribirlas.';return;}
  }
  err.textContent='Un momento…';
  try{
    let res;
    if(isSignup)res=await sb.auth.signUp({email,password:pass});
    else res=await sb.auth.signInWithPassword({email,password:pass});
    if(res.error)throw res.error;
    if(!res.data.session){err.textContent='Cuenta creada. Ahora tocá “Ya tengo cuenta, ingresar”.';return;}
    sbUser=res.data.session.user;await afterLogin();
  }catch(e){err.textContent=authErrMsg(e);}
}
function authErrMsg(e){
  const m=((e&&e.message)||'').toLowerCase();
  if(m.includes('invalid login')||m.includes('invalid credentials'))return 'Email o contraseña incorrectos.';
  if(m.includes('email not confirmed'))return 'Todavía no confirmaste tu email. Revisá tu casilla (y el correo no deseado).';
  if(m.includes('already registered')||m.includes('already exists'))return 'Ese email ya tiene una cuenta. Tocá “Ya tengo cuenta, ingresar”.';
  if(m.includes('at least 6')||m.includes('password should'))return 'La contraseña tiene que tener al menos 6 caracteres.';
  if(m.includes('rate limit')||m.includes('too many'))return 'Muchos intentos seguidos. Esperá un momento y probá de nuevo.';
  if(m.includes('network')||m.includes('fetch')||!navigator.onLine)return 'Sin conexión. Fijate que tengas internet y probá de nuevo.';
  return 'No pudimos entrar. Revisá el email y la contraseña.';
}
async function logout(){await sb.auth.signOut();}

window.addEventListener('online',()=>{setSaveStatus('saving');pushRemote();});
window.addEventListener('offline',()=>setSaveStatus('offline'));
authBoot();
