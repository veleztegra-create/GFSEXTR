const imageUpload = document.createElement('input');
imageUpload.type = 'file';
imageUpload.accept = 'image/*';
imageUpload.style.display = 'none';
document.body.appendChild(imageUpload);

const imgCanvas = document.getElementById('imgCanvas');
const ctx = imgCanvas.getContext('2d');
const dataRows = document.getElementById('dataRows');
const statusBar = document.getElementById('statusBar');
const paletteSelect = document.getElementById('paletteSelect');
const paletteCount = document.getElementById('paletteCount');
const saveState = document.getElementById('saveState');
const thresholdInput = document.getElementById('palette-light-threshold');

let currentImage = null;
let pendingColor = null;
let isDragging = false;
let startX = 0, startY = 0;
let state = { activePaletteId: null, palettes: [] };
let db = null;

const DB_NAME = 'GFSEXTR_DB';
const DB_VERSION = 1;
const STORE = 'app';

function uid(prefix='id') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error);
  });
}
function dbGet(key) {
  return new Promise((resolve,reject)=>{ const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
}
function dbSet(key,value) {
  return new Promise((resolve,reject)=>{ const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(value,key); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
}
async function persist() {
  await dbSet('state', state);
  saveState.textContent = '✓ Guardado local';
  setTimeout(()=>saveState.textContent='Guardado local',900);
}
async function init() {
  try { await openDb(); state = await dbGet('state') || {activePaletteId:null,palettes:[]}; }
  catch(e) { console.error(e); alert('No se pudo abrir el almacenamiento local del navegador.'); }
  if (!state.palettes.length) {
    const p={id:uid('pal_'),name:'Mi primera paleta',colors:[]};
    state.palettes.push(p); state.activePaletteId=p.id; await persist();
  }
  if (!state.palettes.some(p=>p.id===state.activePaletteId)) state.activePaletteId=state.palettes[0].id;
  renderPalettes(); renderDatabase();
}
function activePalette(){ return state.palettes.find(p=>p.id===state.activePaletteId); }

function getSerigraphyAdvice(r,g,b){
  const brightness=(r*299+g*587+b*114)/1000;
  const manualThreshold=thresholdInput ? Math.max(0,Math.min(255,parseInt(thresholdInput.value,10) || 155)) : 155;

  // En serigrafía sobre prenda oscura:
  // colores por debajo del umbral -> CON BASE
  // colores por encima del umbral -> SIN BASE
  return brightness < manualThreshold;
}
function rgbToHex(r,g,b){ return '#'+(1<<24|r<<16|g<<8|b).toString(16).slice(1).toUpperCase(); }
function hexToRgb(hex){
  const m=hex.replace('#','').match(/.{2}/g); return m ? m.map(v=>parseInt(v,16)) : [0,0,0];
}
function escapeHtml(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function renderPalettes(){
  paletteSelect.innerHTML=state.palettes.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} — ${p.colors.length}</option>`).join('');
  paletteSelect.value=state.activePaletteId;
}
function renderDatabase(){
  const p=activePalette();
  if(!p){ dataRows.innerHTML='<div class="empty">No hay paleta activa.</div>'; return; }
  paletteCount.textContent='— '+p.colors.length;
  if(!p.colors.length){ dataRows.innerHTML='<div class="empty">Esta paleta está vacía.<br>Haz clic sobre un color y luego arrastra sobre su nombre.</div>'; return; }
  dataRows.innerHTML=p.colors.slice().reverse().map(item=>`
    <div class="row-item" data-id="${item.id}">
      <div class="color-preview" style="background:${escapeHtml(item.hex)}" title="${escapeHtml(item.hex)}"></div>
      <div class="color-name"><input class="name-edit" value="${escapeHtml(item.colorName)}" title="Editar nombre"></div>
      <div><div class="hex">${escapeHtml(item.hex)}</div><span class="badge ${item.underbase?'base-true':'base-false'}">${item.underbase?'CON BASE':'SIN BASE'}</span></div>
      <button class="light delete-color" title="Eliminar color">×</button>
    </div>`).join('');
  dataRows.querySelectorAll('.name-edit').forEach(input=>input.addEventListener('change',async e=>{
    const item=p.colors.find(x=>x.id===e.target.closest('.row-item').dataset.id);
    if(item){item.colorName=e.target.value.trim()||'Sin nombre';await persist();}
  }));
  dataRows.querySelectorAll('.delete-color').forEach(btn=>btn.addEventListener('click',async e=>{
    const id=e.target.closest('.row-item').dataset.id;
    p.colors=p.colors.filter(x=>x.id!==id); await persist(); renderPalettes(); renderDatabase();
  }));
}

function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportJson(p=activePalette()){
  if(!p)return;
  const payload={format:'GFSEXTR-Palette',version:1,name:p.name,colors:p.colors};
  downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),safeFile(p.name)+'.json');
}
function exportAll(){
  const payload={format:'GFSEXTR-Backup',version:1,exportedAt:new Date().toISOString(),palettes:state.palettes};
  downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),'GFSEXTR-backup.json');
}
function safeFile(s){return (s||'palette').replace(/[\\/:*?"<>|]+/g,'-').trim()||'palette';}

function u16(n){return new Uint8Array([(n>>8)&255,n&255]);}
function ascii(s){return new TextEncoder().encode(s);}
function acbString(s){
  const bytes=new Uint8Array(4+s.length*2), view=new DataView(bytes.buffer);
  view.setUint32(0,s.length);
  for(let i=0;i<s.length;i++) view.setUint16(4+i*2,s.charCodeAt(i));
  return bytes;
}
function concatBytes(parts){
  const total=parts.reduce((n,p)=>n+p.length,0), out=new Uint8Array(total); let pos=0;
  for(const p of parts){out.set(p,pos);pos+=p.length;} return out;
}
function makeAcb(palette){
  const colors=palette.colors;
  const parts=[ascii('8BCB'),u16(1),u16(3000),acbString(palette.name),acbString(''),acbString(''),acbString('GFSEXTR custom RGB color book'),u16(colors.length),u16(Math.min(9,Math.max(1,colors.length||1))),u16(Math.min(4,Math.max(0,Math.floor((colors.length-1)/2)))),u16(0)];
  colors.forEach((c,i)=>{
    const rgb=hexToRgb(c.hex);
    const code=('C'+String(i+1).padStart(5,'0')).slice(0,6);
    parts.push(acbString(c.colorName||code),ascii(code.padEnd(6,' ')),new Uint8Array(rgb));
  });
  parts.push(ascii('spflproc'));
  return concatBytes(parts);
}
function exportAcb(){
  const p=activePalette(); if(!p||!p.colors.length){alert('La paleta no tiene colores para exportar.');return;}
  try{downloadBlob(new Blob([makeAcb(p)],{type:'application/octet-stream'}),safeFile(p.name)+'.acb');}
  catch(e){console.error(e);alert('No se pudo generar el ACB: '+e.message);}
}

async function importJsonFile(file){
  try{
    const obj=JSON.parse(await file.text());
    if(obj.format==='GFSEXTR-Backup' && Array.isArray(obj.palettes)){
      const incoming=obj.palettes.map(p=>({id:uid('pal_'),name:p.name||'Paleta importada',colors:Array.isArray(p.colors)?p.colors.map(c=>({...c,id:uid('c_')})):[]}));
      state.palettes.push(...incoming); state.activePaletteId=incoming[0]?.id||state.activePaletteId;
    } else if(Array.isArray(obj.colors)){
      const p={id:uid('pal_'),name:obj.name||file.name.replace(/\.json$/i,''),colors:obj.colors.map(c=>({...c,id:uid('c_')}))};
      state.palettes.push(p); state.activePaletteId=p.id;
    } else if(Array.isArray(obj)){
      const p={id:uid('pal_'),name:file.name.replace(/\.json$/i,''),colors:obj.map(c=>({...c,id:uid('c_')}))};
      state.palettes.push(p); state.activePaletteId=p.id;
    } else throw new Error('JSON no reconocido');
    await persist(); renderPalettes(); renderDatabase();
  }catch(e){alert('No se pudo importar el JSON: '+e.message);}
}

function showModal(title,initial,callback){
  const back=document.getElementById('modalBackdrop'), input=document.getElementById('modalInput');
  document.getElementById('modalTitle').textContent=title; input.value=initial||''; back.classList.remove('hidden'); input.focus(); input.select();
  const close=()=>back.classList.add('hidden');
  document.getElementById('modalCancel').onclick=close;
  document.getElementById('modalOk').onclick=()=>{const v=input.value.trim();if(v){callback(v);close();}};
  input.onkeydown=e=>{if(e.key==='Enter')document.getElementById('modalOk').click();if(e.key==='Escape')close();};
}

document.getElementById('newPaletteBtn').onclick=()=>{
  showModal('Nueva paleta','Nueva paleta',async name=>{
    const p={id:uid('pal_'),name,colors:[]};state.palettes.push(p);state.activePaletteId=p.id;await persist();renderPalettes();renderDatabase();
  });
};
document.getElementById('renamePaletteBtn').onclick=()=>{
  const p=activePalette(); if(!p)return;
  showModal('Renombrar paleta',p.name,async name=>{p.name=name;await persist();renderPalettes();});
};
document.getElementById('deletePaletteBtn').onclick=async()=>{
  const p=activePalette(); if(!p)return;
  if(state.palettes.length===1){alert('Debe existir al menos una paleta.');return;}
  if(!confirm('¿Eliminar la paleta "'+p.name+'" y sus '+p.colors.length+' colores?'))return;
  state.palettes=state.palettes.filter(x=>x.id!==p.id);state.activePaletteId=state.palettes[0].id;await persist();renderPalettes();renderDatabase();
};
paletteSelect.onchange=async()=>{state.activePaletteId=paletteSelect.value;await persist();renderDatabase();};
document.getElementById('exportJsonBtn').onclick=()=>exportJson();
document.getElementById('exportAllBtn').onclick=exportAll;
document.getElementById('exportAcbBtn').onclick=exportAcb;
document.getElementById('importJson').onchange=e=>{if(e.target.files[0])importJsonFile(e.target.files[0]);e.target.value='';};

const uploadButton=document.createElement('button'); uploadButton.textContent='Cargar imagen'; uploadButton.className='blue';
document.querySelector('.toolbar').prepend(uploadButton); uploadButton.onclick=()=>imageUpload.click();
imageUpload.addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=event=>{const img=new Image();img.onload=()=>{imgCanvas.width=img.width;imgCanvas.height=img.height;ctx.drawImage(img,0,0);currentImage=img;statusBar.innerHTML='🎯 <b>PASO 1:</b> Haz clic en el cuadro de color.';};img.src=event.target.result;};reader.readAsDataURL(file);
});

imgCanvas.addEventListener('mousedown',e=>{
  if(!currentImage)return;const r=imgCanvas.getBoundingClientRect();startX=e.clientX-r.left;startY=e.clientY-r.top;isDragging=false;
});
imgCanvas.addEventListener('mousemove',e=>{
  if(!currentImage||e.buttons!==1)return;isDragging=true;const r=imgCanvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;
  ctx.clearRect(0,0,imgCanvas.width,imgCanvas.height);ctx.drawImage(currentImage,0,0);ctx.strokeStyle='#0984e3';ctx.lineWidth=2;ctx.strokeRect(startX,startY,x-startX,y-startY);
});
imgCanvas.addEventListener('mouseup',async e=>{
  if(!currentImage)return;const r=imgCanvas.getBoundingClientRect();const endX=e.clientX-r.left,endY=e.clientY-r.top;ctx.drawImage(currentImage,0,0);
  if(!isDragging||(Math.abs(endX-startX)<5)){
    const x=Math.max(0,Math.min(imgCanvas.width-1,Math.round(startX))),y=Math.max(0,Math.min(imgCanvas.height-1,Math.round(startY)));
    const pixel=ctx.getImageData(x,y,1,1).data,hex=rgbToHex(pixel[0],pixel[1],pixel[2]),needsBase=getSerigraphyAdvice(pixel[0],pixel[1],pixel[2]);
    pendingColor={hex,underbase:needsBase};statusBar.innerHTML=`🎨 Color: <b>${hex}</b> | Base: <b>${needsBase?'SÍ':'NO'}</b>. Ahora selecciona el texto.`;return;
  }
  if(!pendingColor){alert('Primero selecciona el color con un clic.');return;}
  const cropX=Math.min(startX,endX),cropY=Math.min(startY,endY),cropW=Math.abs(endX-startX),cropH=Math.abs(endY-startY);
  statusBar.innerHTML='⌛ Analizando texto con OCR...';
  const temp=document.createElement('canvas');temp.width=cropW;temp.height=cropH;temp.getContext('2d').drawImage(imgCanvas,cropX,cropY,cropW,cropH,0,0,cropW,cropH);
  try{
    const result=await Tesseract.recognize(temp.toDataURL(),'eng'),cleanText=result.data.text.trim().replace(/\n/g,' ')||'Sin nombre';
    const p=activePalette();p.colors.push({id:uid('c_'),hex:pendingColor.hex,colorName:cleanText,underbase:pendingColor.underbase});
    await persist();renderPalettes();renderDatabase();pendingColor=null;statusBar.innerHTML='✅ Guardado en <b>'+escapeHtml(p.name)+'</b>. Selecciona el siguiente color.';
  }catch(err){console.error(err);statusBar.innerHTML='❌ Error en OCR.';}
});
init();
