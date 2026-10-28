import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cfg=window.CAKE_CONFIG;
const $=id=>document.getElementById(id);
const sections=['loginPanel','cutscene','chooseOrder','locations','locationPreview'];
function view(id){sections.forEach(x=>$(x).hidden=x!==id)}
function say(msg){$('alert').textContent=msg||''}
if(!cfg?.supabaseUrl||!cfg?.supabaseKey||cfg.supabaseUrl.includes('YOUR_NEW')) say('First configure config.js with the new Cake Shop project keys.');
const sb=createClient(cfg.supabaseUrl,cfg.supabaseKey);
let orders=[],frames=[],frame=0,active=null;
async function unwrap(p){const {data,error}=await p;if(error)throw error;return data}
async function init(){try{const {data:{user}}=await sb.auth.getUser();if(!user){view('loginPanel');return}const member=await unwrap(sb.from('profiles').select('username,approved').eq('user_id',user.id).single());if(!member.approved)throw Error('Your membership is disabled.');$('who').textContent=member.username;$('logout').hidden=false;
orders=await unwrap(sb.rpc('get_current_cake_orders'));if(orders.length!==2)throw Error('Could not load this week’s two customers.');
const end=new Date(orders[0].week_end);$('weekTime').textContent='Current week ends '+end.toLocaleString(undefined,{dateStyle:'full',timeStyle:'short',timeZone:'America/Los_Angeles'})+' Pacific time';$('deadline').textContent=$('weekTime').textContent;
frames=[];orders.forEach(o=>{const lines=Array.isArray(o.entrance_dialogue)?o.entrance_dialogue:[];(lines.length?lines:['Welcome to the bakery!']).forEach(s=>frames.push({o,s}));frames.push({o,s:o.order_dialogue||'I have a cake request for you!'});});
frame=0;renderFrame();view('cutscene');}catch(e){say(e.message||String(e));view('loginPanel')}}
function image(el,url){if(url&&/^(https:\/\/|\/)/.test(url)){el.src=url;el.hidden=false;el.onerror=()=>{el.hidden=true;if(el.id==='portrait')$('portraitFallback').hidden=false}}else{el.removeAttribute('src');el.hidden=true}}
function renderFrame(){const {o,s}=frames[frame];$('sceneTitle').textContent=frame===0?'The bakery doors open...':'A special request';$('speaker').textContent=o.customer_name;$('speech').textContent=s;$('portraitFallback').hidden=!!o.portrait_path;image($('portrait'),o.portrait_path);image($('speechArt'),o.speech_image_path);$('sceneCounter').textContent=`${frame+1} / ${frames.length}`;$('nextLine').textContent=frame===frames.length-1?'Choose an order →':'Continue →'}
$('nextLine').onclick=()=>{if(frame+1<frames.length){frame++;renderFrame()}else showOrders()};
function showOrders(){const root=$('orderCards');root.replaceChildren();orders.forEach(o=>{const card=document.createElement('button');card.className='orderCard';const title=document.createElement('h2');title.textContent=o.customer_name;card.append(title);if(o.portrait_path){const img=document.createElement('img');image(img,o.portrait_path);card.append(img)}const d=document.createElement('div');d.className='req';if(o.mystery){d.textContent='???? — This order is a mystery.'}else{const req=o.display_requirements||{};const cream=Object.entries(req.cream||{}).filter(([,n])=>n>0).map(([k,n])=>`${n} ${k} cream`).join(', ');const toppings=Object.entries(req.toppings||{}).filter(([,n])=>n>0).map(([k,n])=>`${n} ${k.replaceAll('_',' ')}`).join(', ');d.textContent=`${req.flavor||'Not set'} frosting • ${req.layers||'?'} layers\nCream: ${cream||'None'}\nToppings: ${toppings||'None'}`}card.append(d);card.onclick=()=>{active=o;$('activeCustomer').textContent=`Baking for ${o.customer_name}`;view('locations')};root.append(card)});view('chooseOrder')}
$('switchOrder').onclick=showOrders;
$('shop').onclick=()=>{view('locationPreview');$('placeName').textContent='Toppings Shop';$('placeTitle').textContent='A world of sweet decorations';$('placeIntro').textContent='Here are the available items and their Tarot prices. Purchase controls come in the upcoming shop step.';loadShop()};
$('kitchen').onclick=()=>{view('locationPreview');$('placeName').textContent='Kitchen';$('placeTitle').textContent='Your cake awaits';$('placeIntro').textContent='The kitchen will let you pick five frosting flavors, 1–4 layers, pipe cream and place purchased toppings. Your chosen customer stays selected.';$('previewContent').replaceChildren()};
async function loadShop(){try{const items=await unwrap(sb.from('topping_catalog').select('name,cost').eq('active',true).order('cost'));const root=$('previewContent');root.replaceChildren();for(const i of items){const node=document.createElement('div');node.className='item';node.textContent=`${i.name} · ${i.cost}🂱`;root.append(node)}}catch(e){say(e.message)}}
$('backToLocations').onclick=()=>view('locations');
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await unwrap(sb.auth.signInWithPassword({email:$('email').value,password:$('password').value}));say('');await init()}catch(err){say(err.message)}};
$('logout').onclick=async()=>{await sb.auth.signOut();location.reload()};
init();
