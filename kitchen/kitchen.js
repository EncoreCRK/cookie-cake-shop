// Supabase is loaded only for real gameplay. Artwork preview runs without a CDN.

/* Self-contained HTML5 canvas editor: no extra canvas library/CDN required. */
const $ = id => document.getElementById(id);
const cfg = window.CAKE_CONFIG;
const A = window.CAKE_KITCHEN_ASSETS;
const FLAVORS = ['strawberry','lemon','milky','chocolate','blueberry'];
const COLORS = { strawberry:'#f6a8c4', lemon:'#ffe684', milky:'#fff5e6', chocolate:'#9c6d51', blueberry:'#8ca5ff' };
const LABEL = s => s[0].toUpperCase()+s.slice(1).replaceAll('_',' ');
const W = 960, H = 620;
const canvas = $('cakeCanvas'), ctx = canvas.getContext('2d');
const pictures = new Map();
const itemHistory = [];
const pointers = new Map();
const state = {
  db:null, user:null, order:null, catalog:[],
  creamStock:Object.fromEntries(FLAVORS.map(x=>[x,0])), toppingStock:{},
  design:{frosting_flavor:'strawberry',layer_count:1,decorations:[]},
  submitted:false, preview:false, selected:null,
  mode:{type:'move'}, zoom:1, cursor:null, active:null, pinch:null,
  busy:false, saveTimer:null, saveQueue:Promise.resolve(), revision:0
};
const uid=()=>globalThis.crypto?.randomUUID?.() || `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reqCake=()=>A.layers[state.design.frosting_flavor][state.design.layer_count];
const cakeArea=()=>A.decorationArea;

// Image loads asynchronously; fallbacks remain usable if a PNG is missing.
function picture(url){
  if(!url)return null;
  if(!pictures.has(url)){
    const entry={image:null,ready:false,missing:false};
    pictures.set(url,entry);
    const img=new Image();
    img.onload=()=>{entry.image=img;entry.ready=true;draw();};
    img.onerror=()=>{entry.missing=true;draw();};
    img.src=url;
  }
  return pictures.get(url).ready ? pictures.get(url).image : null;
}
function cover(img,x,y,w,h){const s=Math.max(w/img.width,h/img.height);const iw=w/s,ih=h/s;ctx.drawImage(img,(img.width-iw)/2,(img.height-ih)/2,iw,ih,x,y,w,h);}
function contain(img,x,y,w,h){const s=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);}
function ellipse(x,y,rx,ry,fill,stroke=null,line=1){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=line;ctx.strokeStyle=stroke;ctx.stroke();}}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke();}}
function label(text,x,y,size=15,color='#e8faff',bold=true){ctx.font=`${bold?'700':'500'} ${size}px system-ui`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,x,y);}

function drawTable(){
  const table=picture(A.table);
  if(table){cover(table,0,0,W,H);ctx.fillStyle='#00152a3b';ctx.fillRect(0,0,W,H);return;}
  const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#092e63');bg.addColorStop(.45,'#051b41');bg.addColorStop(1,'#020c22');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(let i=0;i<36;i++){
    const x=(i*257+97)%W,y=(i*139+23)%H;
    ellipse(x,y,i%4===0?2.4:1.2,i%4===0?2.4:1.2,'#c5eeff88');
  }
  // Quiet glowing-eye ornaments echo the dark azure reference art.
  for(const [x,y,s] of [[135,72,1],[822,102,1.25],[155,560,.75],[805,563,.85]]){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle='#64ccff37';ctx.lineWidth=3;ctx.shadowColor='#51c7ff';ctx.shadowBlur=13;
    ctx.beginPath();ctx.moveTo(-29,0);ctx.quadraticCurveTo(0,-22,29,0);ctx.quadraticCurveTo(0,23,-29,0);ctx.stroke();
    ellipse(0,0,7,13,'#5dc8ff35');ctx.restore();
  }
  const top=ctx.createLinearGradient(0,410,0,H);top.addColorStop(0,'#194b7d');top.addColorStop(.2,'#0d366b');top.addColorStop(1,'#061634');
  ctx.fillStyle=top;ctx.fillRect(0,460,W,160);
  ctx.fillStyle='#4ea4e355';ctx.fillRect(0,459,W,4);
  ellipse(480,455,290,84,'#0b132a99','#83dfff40',3);
  ellipse(480,430,256,48,'#9de1ff19');
  ctx.save();ctx.shadowColor='#25bafa';ctx.shadowBlur=45;ellipse(480,380,230,148,'#3d78cb22');ctx.restore();
}
function drawCake(){
  const im=picture(reqCake());
  if(im){
    contain(im,A.cakeImage.x,A.cakeImage.y,A.cakeImage.width,A.cakeImage.height);
    return;
  }
  // Fallback illustration, intentionally non-editable.
  const fl=state.design.frosting_flavor, n=state.design.layer_count;
  const color=COLORS[fl];
  ellipse(480,458,235,40,'#020c1c88');
  ellipse(480,438,234,52,'#d7eeff','#8aaad3',5);
  for(let i=0;i<n;i++){
    const y=390-i*42;
    roundRect(295,y,370,43,13,'#ae755d','#6a4b46');
    roundRect(295,y-8,370,34,13,color,'#e8f7ff');
    ellipse(480,y-9,185,20,color,'#f5feff',2.5);
    for(let j=0;j<7;j++)ellipse(326+j*52,y+3+(j%2)*5,14,6,'#ffffff70');
  }
  label(`${LABEL(fl)} • ${n} ${n===1?'layer':'layers'}`,480,140,17,'#daedff');
  label('Add your cake PNG in kitchen-assets.js',480,166,12,'#7cb4df',false);
}
function used(){
  const creams=Object.fromEntries(FLAVORS.map(f=>[f,0]));
  const toppings={};
  creams[state.design.frosting_flavor]+=state.design.layer_count;
  for(const d of state.design.decorations){
    if(d.type==='cream'&&FLAVORS.includes(d.flavor))creams[d.flavor]++;
    if(d.type==='topping')toppings[d.code]=(toppings[d.code]||0)+1;
  }
  return {creams,toppings};
}
function available(type,code){const u=used();return type==='cream'?(u.creams[code]||0)<(state.creamStock[code]||0):(u.toppings[code]||0)<(state.toppingStock[code]||0);}
function validStock(){
  const u=used();
  return FLAVORS.every(f=>u.creams[f]<=(state.creamStock[f]||0))&&Object.entries(u.toppings).every(([c,n])=>n<=(state.toppingStock[c]||0));
}
function onCake(p){const a=cakeArea();const dx=(p.x-a.cx)/a.rx,dy=(p.y-a.cy)/a.ry;return dx*dx+dy*dy<=1;}
function withinCake(p){const a=cakeArea();const dx=(p.x-a.cx)/a.rx,dy=(p.y-a.cy)/a.ry;const r=Math.hypot(dx,dy);if(r<=.96)return p;return{x:a.cx+dx/r*.96*a.rx,y:a.cy+dy/r*.96*a.ry};}
function getItemPath(d){
  if(d.type==='cream')return A.dollops[d.flavor];
  const entry=state.catalog.find(x=>x.code===d.code);
  let p=entry?.image_path?.trim()||A.toppings[d.code];
  if(p && !/^(https?:\/\/|\/)/.test(p))p='/'+p;
  return p;
}
function drawCream(x,y,size,flavor){
  const color=COLORS[flavor]||'#fff';
  ellipse(x,y+size*.22,size*.58,size*.25,'#00162e55');
  for(let i=0;i<7;i++){
    const t=i*Math.PI*2/7;
    ellipse(x+Math.cos(t)*size*.26,y+Math.sin(t)*size*.21,size*.23,size*.27,color,'#376db787',1.5);
  }
  ellipse(x,y-size*.11,size*.31,size*.28,color,'#ecfaff99',2);
  ellipse(x-size*.12,y-size*.22,size*.1,size*.07,'#ffffff80');
}
function drawToppingFallback(d,x,y,size){
  const code=d.code||'';const sym=code.includes('star')?'★':code.includes('rose')?'✿':code.includes('leaf')?'❧':code.includes('banana')?'◕':'◆';
  ellipse(x,y,size*.52,size*.52,'#1c598c','#9ceaff',2);
  label(sym,x,y+size*.14,size*.72,'#d1f8ff');
}
function drawDecoration(d){
  const x=d.x*W,y=d.y*H,sc=d.scale||1,size=d.type==='cream'?64:83;
  ctx.save();ctx.translate(x,y);ctx.rotate((d.rotation||0)*Math.PI/180);ctx.scale(sc,sc);
  const im=picture(getItemPath(d));
  if(im)contain(im,-size/2,-size/2,size,size);
  else if(d.type==='cream')drawCream(0,0,size*.5,d.flavor);
  else drawToppingFallback(d,0,0,size);
  ctx.restore();
  if(state.selected===d.id){
    const r=size*sc*.62;
    ctx.save();ctx.setLineDash([8,5]);ellipse(x,y,r,r,null,'#9deaff',2);ctx.restore();
    ellipse(x+r*.78,y+r*.78,12,12,'#58dfff','#08356e',2);label('↗',x+r*.78,y+r*.78+5,14,'#022144');
    ellipse(x+r*.78,y-r*.78,12,12,'#104882','#b6efff',2);label('⟳',x+r*.78,y-r*.78+5,14,'#c9f7ff');
  }
}
const BOWL_POS=[{x:94,y:188},{x:94,y:345},{x:94,y:501},{x:866,y:240},{x:866,y:428}];
function drawBowls(){
  FLAVORS.forEach((f,i)=>{
    const p=BOWL_POS[i],selected=state.mode.type==='cream'&&state.mode.flavor===f;
    ctx.save();ctx.shadowColor=selected?'#65e7ff':'#00132e';ctx.shadowBlur=selected?25:12;
    ellipse(p.x,p.y,62,59,selected?'#1b5c9a':'#092953',selected?'#abf6ff':'#3f7eaf',selected?5:2);
    ctx.restore();
    const im=picture(A.bowls[f]);
    if(im)contain(im,p.x-45,p.y-43,90,77);
    else{ellipse(p.x,p.y+7,40,23,'#89b8df','#c8f0ff',2);ellipse(p.x,p.y,39,19,COLORS[f],'#d5f6ff',2);}
    label(LABEL(f),p.x,p.y+73,12,selected?'#b8f9ff':'#d0e9ff');
    label(`${(state.creamStock[f]||0)-(used().creams[f]||0)} left`,p.x,p.y+89,11,'#a5c9e3',false);
  });
}
function drawCursor(){
  if(state.mode.type!=='cream'||!state.cursor||!onCake(state.cursor)||state.submitted)return;
  const p=state.cursor,fl=state.mode.flavor;
  ctx.save();ctx.globalAlpha=.7;drawCream(p.x,p.y,25,fl);ctx.restore();
  if(state.active?.type==='pipe'){
    const elapsed=performance.now()-state.active.started;
    const scale=clamp(.55+elapsed/850*1.15,.55,1.7);
    const im=picture(A.dollops[fl]);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);ctx.globalAlpha=.85;
    if(im)contain(im,-34,-34,68,68);else drawCream(0,0,32,fl);
    ctx.restore();
    ellipse(p.x,p.y,42*scale,42*scale,null,'#a5f4ff99',2);
  }
  // Small reusable cream bag indicator, above the contact point.
  ctx.save();ctx.translate(p.x+34,p.y-46);ctx.rotate(.4);
  ctx.beginPath();ctx.moveTo(-9,-23);ctx.lineTo(12,-23);ctx.lineTo(4,-4);ctx.lineTo(0,14);ctx.lineTo(-5,-4);ctx.closePath();ctx.fillStyle='#e8faff';ctx.fill();ctx.strokeStyle='#72bce9';ctx.lineWidth=2;ctx.stroke();ctx.restore();
}
function draw(){
  if(!ctx)return;
  ctx.clearRect(0,0,W,H);
  ctx.save();ctx.translate(W/2,H/2);ctx.scale(state.zoom,state.zoom);ctx.translate(-W/2,-H/2);
  drawTable();drawCake();
  // Draw items ABOVE cake but BELOW the bowls/tool tray.
  state.design.decorations.forEach(drawDecoration);
  drawBowls();drawCursor();ctx.restore();
}
let animationFrame=0;
function startPipeTick(){
  if(animationFrame)return;
  const tick=()=>{
    if(state.active?.type==='pipe'){
      draw();animationFrame=requestAnimationFrame(tick);
    }else animationFrame=0;
  };
  animationFrame=requestAnimationFrame(tick);
}
function worldFromEvent(e){
  const rect=canvas.getBoundingClientRect();
  const screenX=(e.clientX-rect.left)*W/rect.width,screenY=(e.clientY-rect.top)*H/rect.height;
  return {x:(screenX-W/2)/state.zoom+W/2,y:(screenY-H/2)/state.zoom+H/2};
}
function setZoom(z){state.zoom=clamp(z,.65,2.3);$('zoomLevel').textContent=Math.round(state.zoom*100)+'%';draw();}
function bowlHit(p){return FLAVORS.find((_,i)=>Math.hypot(p.x-BOWL_POS[i].x,p.y-BOWL_POS[i].y)<60)||null;}
function hitDecoration(p){
  for(let i=state.design.decorations.length-1;i>=0;i--){
    const d=state.design.decorations[i],radius=(d.type==='cream'?42:52)*(d.scale||1);
    if(Math.hypot(p.x-d.x*W,p.y-d.y*H)<radius)return d;
  }
  return null;
}
function selectedHandle(p){
  const d=state.design.decorations.find(d=>d.id===state.selected);if(!d)return null;
  const r=(d.type==='cream'?64:83)*(d.scale||1)*.62;
  const x=d.x*W,y=d.y*H;
  if(Math.hypot(p.x-(x+r*.78),p.y-(y+r*.78))<20)return 'resize';
  if(Math.hypot(p.x-(x+r*.78),p.y-(y-r*.78))<20)return 'rotate';
  return null;
}
function remember(){itemHistory.push(structuredClone(state.design));if(itemHistory.length>35)itemHistory.shift();}
function updateDesign(){
  state.revision++;
  draw();updateStockDisplay();renderControls();
  $('saveState').textContent=state.preview?'Preview only':'Unsaved changes';
  clearTimeout(state.saveTimer);
  if(!state.preview&&!state.submitted&&!state.busy){
    if(validStock())state.saveTimer=setTimeout(()=>{persist().catch(()=>{});},950);
    else notify('Your cake currently uses more ingredients than your inventory allows. Change the design before saving.',true);
  }
}
function setMode(mode){state.mode=mode;state.selected=null;if(mode.type==='cream')state.cursor={x:480,y:302};renderControls();draw();}
function selectItem(id){state.selected=id;state.mode={type:'move'};renderControls();draw();}
function pushItem(type,p,extra={},scale=1){
  if(!available(type,type==='cream'?extra.flavor:extra.code)){
    notify(`No remaining ${type==='cream'?extra.flavor:'approved'} ${type==='cream'?'frosting':'topping'} available.`,true);return null;
  }
  remember();
  const point=withinCake(p);
  const d={id:uid(),type,x:point.x/W,y:point.y/H,rotation:0,scale:clamp(scale,.35,2.5),...extra};
  state.design.decorations.push(d);state.selected=d.id;
  updateDesign();return d;
}
function pointerDown(e){
  if(state.submitted||state.busy)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){
    const a=[...pointers.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    state.active=null;state.pinch={dist,zoom:state.zoom};return;
  }
  if(pointers.size>2)return;
  const p=worldFromEvent(e),flavor=bowlHit(p);
  if(flavor){setMode({type:'cream',flavor});return;}
  const handle=selectedHandle(p);
  if(handle){
    const d=state.design.decorations.find(x=>x.id===state.selected);
    remember();state.active={type:handle,id:d.id,initial:d.scale,angle:d.rotation,start:Math.atan2(p.y-d.y*H,p.x-d.x*W),distance:Math.hypot(p.x-d.x*W,p.y-d.y*H)};
    canvas.setPointerCapture(e.pointerId);return;
  }
  const hit=hitDecoration(p);
  if(hit){
    remember();state.selected=hit.id;state.mode={type:'move'};
    state.active={type:'drag',id:hit.id,offsetX:p.x-hit.x*W,offsetY:p.y-hit.y*H};
    canvas.setPointerCapture(e.pointerId);renderControls();draw();return;
  }
  if(!onCake(p)){state.selected=null;draw();return;}
  state.cursor=p;
  if(state.mode.type==='cream'){
    if(!available('cream',state.mode.flavor))return notify('No more of this cream flavor is available.',true);
    state.active={type:'pipe',started:performance.now(),point:p,flavor:state.mode.flavor};
    startPipeTick();
    canvas.setPointerCapture(e.pointerId);
  }else if(state.mode.type==='topping'){
    const d=pushItem('topping',p,{code:state.mode.code});
    if(d){state.active={type:'drag',id:d.id,offsetX:0,offsetY:0};canvas.setPointerCapture(e.pointerId);}
  }else{state.selected=null;draw();}
}
function pointerMove(e){
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(state.pinch&&pointers.size>=2){const pts=[...pointers.values()],dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);setZoom(state.pinch.zoom*dist/Math.max(1,state.pinch.dist));return;}
  const p=worldFromEvent(e);state.cursor=p;
  if(!state.active){draw();return;}
  const act=state.active,d=state.design.decorations.find(d=>d.id===act.id);
  if(act.type==='pipe'){act.point=p;draw();return;}
  if(!d)return;
  if(act.type==='drag'){
    const pos=withinCake({x:p.x-act.offsetX,y:p.y-act.offsetY});d.x=clamp(pos.x/W,0,1);d.y=clamp(pos.y/H,0,1);
  }else if(act.type==='resize'){
    const dist=Math.hypot(p.x-d.x*W,p.y-d.y*H);
    d.scale=clamp(act.initial*dist/Math.max(10,act.distance),.35,2.5);
  }else if(act.type==='rotate'){
    d.rotation=clamp(act.angle+(Math.atan2(p.y-d.y*H,p.x-d.x*W)-act.start)*180/Math.PI,-360,360);
  }
  draw();
}
function pointerEnd(e,cancel=false){
  pointers.delete(e.pointerId);if(pointers.size<2)state.pinch=null;
  if(state.pinch)return;
  const act=state.active;state.active=null;
  if(!act){draw();return;}
  if(act.type==='pipe'&&!cancel){
    const elapsed=performance.now()-act.started;
    const p=act.point;
    if(onCake(p))pushItem('cream',p,{flavor:act.flavor},clamp(.55+elapsed/850*1.15,.55,1.7));
    else notify('Release over the cake to place the dollop.',true);
  }else if(act.type!=='pipe'&&!cancel){updateDesign();}
  draw();
}
function registerPointers(){
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointerDown(e)});
  canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')e.preventDefault();pointerMove(e)});
  canvas.addEventListener('pointerup',e=>pointerEnd(e));
  canvas.addEventListener('pointercancel',e=>pointerEnd(e,true));
  canvas.addEventListener('pointerleave',()=>{if(!state.active){state.cursor=null;draw();}});
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(state.zoom*(e.deltaY>0?.9:1.1));},{passive:false});
  window.addEventListener('blur',()=>{state.active=null;pointers.clear();draw()});
}
function renderControls(){
  const u=used();
  $('flavor').value=state.design.frosting_flavor;
  $('layerOptions').querySelectorAll('button').forEach(b=>{
    b.classList.toggle('chosen',+b.dataset.layers===state.design.layer_count);
    const path=A.layers[state.design.frosting_flavor]?.[+b.dataset.layers];
    const holder=b.querySelector('.layer-preview'),im=b.querySelector('img');
    if(im.dataset.path!==path){
      im.dataset.path=path||'';
      im.hidden=true;
      holder.querySelector('.layer-fallback')?.remove();
      const fallback=document.createElement('span');fallback.className='layer-fallback';fallback.textContent=b.dataset.layers;holder.append(fallback);
      im.onload=()=>{im.hidden=false;fallback.remove();};
      im.onerror=()=>{im.hidden=true;};
      if(path)im.src=path;
    }
    b.disabled=state.submitted||state.busy;
  });
  $('creamChoices').replaceChildren();
  FLAVORS.forEach(f=>{
    const btn=document.createElement('button');btn.type='button';btn.className='bowl-button'+(state.mode.type==='cream'&&state.mode.flavor===f?' chosen':'');
    btn.disabled=state.submitted||state.busy;
    const image=document.createElement('img');image.alt='';image.src=A.bowls[f];image.onerror=()=>{image.remove();const sw=document.createElement('span');sw.className='swatch';sw.style.background=COLORS[f];btn.prepend(sw);};
    const txt=document.createElement('span');txt.innerHTML='';const title=document.createElement('strong');title.textContent=LABEL(f);const small=document.createElement('small');small.textContent=`${Math.max(0,(state.creamStock[f]||0)-(u.creams[f]||0))} left`;txt.append(title,small);
    btn.append(image,txt);btn.onclick=()=>setMode({type:'cream',flavor:f});$('creamChoices').append(btn);
  });
  $('toppingChoices').replaceChildren();let count=0;
  for(const t of state.catalog){
    if(!(state.toppingStock[t.code]>0))continue;
    count++;
    const btn=document.createElement('button');btn.type='button';btn.className='topping-button'+(state.mode.type==='topping'&&state.mode.code===t.code?' chosen':'');btn.disabled=state.submitted||state.busy;
    const img=document.createElement('img');img.src=getItemPath({type:'topping',code:t.code});img.alt=t.name;img.onerror=()=>img.style.display='none';
    const name=document.createElement('span');name.textContent=t.name;const qty=document.createElement('small');qty.textContent=`${Math.max(0,(state.toppingStock[t.code]||0)-(u.toppings[t.code]||0))} left`;
    btn.append(img,name,qty);btn.onclick=()=>setMode({type:'topping',code:t.code});$('toppingChoices').append(btn);
  }
  if(!count){const p=document.createElement('p');p.className='small';p.textContent='No approved toppings in inventory yet.';$('toppingChoices').append(p);}
  $('modeLabel').textContent=state.mode.type==='move'?'Move decorations':state.mode.type==='cream'?`Piping ${LABEL(state.mode.flavor)}`:`Placing ${state.catalog.find(t=>t.code===state.mode.code)?.name||'topping'}`;
  $('moveMode').classList.toggle('chosen',state.mode.type==='move');
  $('flavor').disabled=state.submitted||state.busy;
  for(const id of ['moveMode','undo','saveBtn','submitBtn'])$(id).disabled=state.submitted||state.busy||((id==='saveBtn'||id==='submitBtn')&&state.preview);
  for(const id of ['sizeDown','sizeUp','rotateLeft','rotateRight','removeSelected'])$(id).disabled=!state.selected||state.submitted||state.busy;
}
function updateStockDisplay(){
  const u=used();const creams=$('frostingUsage'),tops=$('toppingUsage');creams.replaceChildren();tops.replaceChildren();
  for(const f of FLAVORS){
    const row=document.createElement('div');row.className='usage-row'+(u.creams[f]>(state.creamStock[f]||0)&&!state.submitted?' over':'');
    const name=document.createElement('span');name.textContent=LABEL(f);const qty=document.createElement('strong');qty.textContent=state.submitted?`${u.creams[f]} used`:`${u.creams[f]} / ${state.creamStock[f]||0}`;row.append(name,qty);creams.append(row);
  }
  for(const [code,n] of Object.entries(u.toppings)){
    const row=document.createElement('div');row.className='usage-row'+(n>(state.toppingStock[code]||0)&&!state.submitted?' over':'');
    const name=document.createElement('span');name.textContent=state.catalog.find(t=>t.code===code)?.name||LABEL(code);const qty=document.createElement('strong');qty.textContent=state.submitted?`${n} used`:`${n} / ${state.toppingStock[code]||0}`;row.append(name,qty);tops.append(row);
  }
}
function notify(s,error=false){const el=$('notice');el.hidden=!s;el.textContent=s||'';el.classList.toggle('error',error);}
async function q(p){const{data,error}=await p;if(error)throw error;return data;}
function describeOrder(r){
  if(!r?.flavor)return 'Choose your frosting and build a beautiful cake.';
  const creams=Object.entries(r.cream||{}).filter(([,n])=>n>0).map(([f,n])=>`${n} ${f} cream`).join(', ')||'none';
  const tops=Object.entries(r.toppings||{}).filter(([,n])=>n>0).map(([f,n])=>`${n} ${LABEL(f)}`).join(', ')||'none';
  return `${LABEL(r.flavor)} · ${r.layers} layers · Cream: ${creams} · Toppings: ${tops}`;
}
function pickOrder(rows){const id=new URLSearchParams(location.search).get('order_id')||sessionStorage.getItem('cake_active_order_id');return rows.find(o=>o.order_id===id);}
async function fetchStock(){
  const [c,t]=await Promise.all([q(state.db.from('frosting_inventory').select('flavor,quantity').eq('user_id',state.user.id)),q(state.db.from('topping_inventory').select('topping_code,quantity').eq('user_id',state.user.id))]);
  state.creamStock=Object.fromEntries(FLAVORS.map(f=>[f,0]));state.toppingStock={};
  c.forEach(x=>state.creamStock[x.flavor]=x.quantity);t.forEach(x=>state.toppingStock[x.topping_code]=x.quantity);
}
function showReview(r){
  $('reviewCard').hidden=false;$('starResult').textContent='★'.repeat(r.stars)+'☆'.repeat(5-r.stars);
  $('reviewText').textContent=r.review||'Thank you for the cake!';const img=$('reviewArt');
  let url=r.review_image_path||'';if(url&&!/^https?:\/\//.test(url)&&!url.startsWith('/'))url='/'+url;
  if(url){img.src=url;img.hidden=false;img.onerror=()=>img.hidden=true;}else img.hidden=true;
}
function persist(){
  if(state.preview||state.submitted)return Promise.resolve();
  if(!validStock()){notify('Not enough frosting/toppings to save this design.',true);return Promise.reject(new Error('Inventory limit exceeded'));}
  const snap=structuredClone(state.design),rev=state.revision;
  $('saveState').textContent='Saving draft…';
  state.saveQueue=state.saveQueue.catch(()=>{}).then(async()=>{
    await q(state.db.rpc('save_cake_draft',{p_order_id:state.order.order_id,p_frosting:snap.frosting_flavor,p_layers:snap.layer_count,p_decorations:snap.decorations}));
    if(rev===state.revision){$('saveState').textContent='Draft saved';notify('');}
  });
  return state.saveQueue.catch(err=>{$('saveState').textContent='Save failed';notify(`Draft save failed: ${err.message}`,true);throw err;});
}
function bindControls(){
  $('flavor').addEventListener('change',e=>{remember();state.design.frosting_flavor=e.target.value;updateDesign();});
  $('layerOptions').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{remember();state.design.layer_count=+b.dataset.layers;updateDesign();}));
  $('moveMode').onclick=()=>setMode({type:'move'});
  const changeSelection=(action)=>{
    const d=state.design.decorations.find(d=>d.id===state.selected);if(!d)return notify('Select a topping or cream first.');remember();action(d);updateDesign();
  };
  $('sizeDown').onclick=()=>changeSelection(d=>d.scale=clamp(d.scale-.15,.35,2.5));
  $('sizeUp').onclick=()=>changeSelection(d=>d.scale=clamp(d.scale+.15,.35,2.5));
  $('rotateLeft').onclick=()=>changeSelection(d=>d.rotation=clamp(d.rotation-15,-360,360));
  $('rotateRight').onclick=()=>changeSelection(d=>d.rotation=clamp(d.rotation+15,-360,360));
  $('removeSelected').onclick=()=>{if(!state.selected)return notify('Select a decoration to remove.');remember();state.design.decorations=state.design.decorations.filter(d=>d.id!==state.selected);state.selected=null;updateDesign();};
  $('undo').onclick=()=>{if(!itemHistory.length)return notify('Nothing to undo.');state.design=itemHistory.pop();state.selected=null;updateDesign();};
  $('zoomOut').onclick=()=>setZoom(state.zoom-.15);$('zoomIn').onclick=()=>setZoom(state.zoom+.15);$('zoomReset').onclick=()=>setZoom(1);
  $('saveBtn').onclick=async()=>{clearTimeout(state.saveTimer);try{await persist();}catch{}};
  $('submitBtn').onclick=async()=>{
    if(state.submitted||state.busy||state.preview)return;
    if(!validStock())return notify('The cake uses more ingredients than you have.',true);
    if(!confirm('Submit this finished cake? Frosting and topping inventory will be deducted, and the cake cannot be edited again.'))return;
    state.busy=true;clearTimeout(state.saveTimer);renderControls();
    try{
      await persist();
      const result=await q(state.db.rpc('submit_cake',{p_order_id:state.order.order_id}));
      state.submitted=true;$('saveState').textContent='Submitted ✦';notify('Cake submitted!');
      await fetchStock();renderControls();updateStockDisplay();showReview(result);
    }catch(e){notify(`Submission failed: ${e.message}`,true);$('saveState').textContent='Submission failed';}
    finally{state.busy=false;renderControls();draw();}
  };
}
async function init(){
  try{
    if(!A)throw Error('The /kitchen/kitchen-assets.js configuration is missing.');
    $('backBakery').href=A.gameUrl;$('shopLink').href=A.shopUrl;$('moreToppings').href=A.shopUrl;
    registerPointers();bindControls();
    const preview=new URLSearchParams(location.search).get('preview')==='1';
    if(preview){
      state.preview=true;
      state.catalog=Object.entries(A.toppings).map(([code])=>({code,name:LABEL(code),image_path:A.toppings[code]}));
      state.creamStock=Object.fromEntries(FLAVORS.map(x=>[x,25]));state.toppingStock=Object.fromEntries(Object.keys(A.toppings).map(x=>[x,10]));
      $('customerName').textContent='Kitchen editor — artwork preview';$('orderSummary').textContent='Preview mode: experiment with all toppings. No data will be saved.';
      $('saveState').textContent='Preview only';
    }else{
      if(!cfg?.supabaseUrl||!cfg?.supabaseKey)throw Error('Your root /config.js has not loaded.');
      const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
      state.db=createClient(cfg.supabaseUrl,cfg.supabaseKey);
      const {data:{user}}=await state.db.auth.getUser();if(!user)throw Error('Sign in at the Bakery before entering the Kitchen.');
      state.user=user;
      const profile=await q(state.db.from('profiles').select('approved').eq('user_id',user.id).single());if(!profile.approved)throw Error('Your membership is disabled.');
      const orders=await q(state.db.rpc('get_current_cake_orders'));state.order=pickOrder(orders);
      if(!state.order)throw Error('Choose a customer on the Weekly Orders screen, then open the Kitchen.');
      sessionStorage.setItem('cake_active_order_id',state.order.order_id);
      $('customerName').textContent=`Baking for ${state.order.customer_name}`;
      $('orderSummary').textContent=state.order.mystery?'Mystery order — ????':describeOrder(state.order.display_requirements);
      await fetchStock();
      state.catalog=await q(state.db.from('topping_catalog').select('code,name,cost,image_path,active').eq('active',true).order('cost'));
      const rows=await q(state.db.from('cakes').select('id,status,frosting_flavor,layer_count,decorations').eq('user_id',user.id).eq('weekly_order_id',state.order.order_id).limit(1));
      if(rows.length){
        const c=rows[0];
        state.design={frosting_flavor:c.frosting_flavor||'strawberry',layer_count:c.layer_count||1,decorations:Array.isArray(c.decorations)?c.decorations:[]};
        state.submitted=c.status==='submitted';
        if(state.submitted){
          const reviews=await q(state.db.from('cake_reviews').select('stars,review_text_snapshot').eq('cake_id',c.id).limit(1));
          if(reviews.length){
            const r=reviews[0],art=await q(state.db.from('review_cards').select('review_image_path').eq('customer_code',state.order.customer_code).eq('stars',r.stars).limit(1));
            showReview({stars:r.stars,review:r.review_text_snapshot,review_image_path:art[0]?.review_image_path});
          }
        }
      }
      $('saveState').textContent=state.submitted?'Submitted ✦':'Ready to decorate';
    }
    renderControls();updateStockDisplay();draw();
    if(!state.submitted&&state.design.decorations.some(d=>!d.id))notify('Some saved decorations may be from an older editor version; please inspect before submitting.');
  }catch(e){
    $('saveState').textContent='Unable to load';notify(e.message||String(e),true);
    $('customerName').textContent='Unable to load customer order';
    ['saveBtn','submitBtn'].forEach(id=>$(id).disabled=true);
    // Draw the demo fallback so an error never leaves a blank canvas.
    draw();
  }
}
init();
