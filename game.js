import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cfg = window.CAKE_CONFIG;
const $ = id => document.getElementById(id);
const sections = ['loginPanel','cutscene','chooseOrder','locations','locationPreview'];
const defaultAssets = {
  orderSceneBackground: '/assets/orders-background.png',
  receptionDesk: '/assets/reception.png'
};
const sceneAssets = {...defaultAssets, ...(cfg?.assets || {}), ...(window.CAKE_SCENE_ASSETS?.scene || {})};
const characterAssets = window.CAKE_SCENE_ASSETS?.characters || {};
function view(id){sections.forEach(x => $(x).hidden = x !== id)}
function say(msg){$('alert').textContent = msg || ''}
if(!cfg?.supabaseUrl || !cfg?.supabaseKey || cfg.supabaseUrl.includes('YOUR_NEW')) say('First configure config.js with the new Cake Shop project keys.');
const sb = createClient(cfg.supabaseUrl, cfg.supabaseKey);
let orders = [], frames = [], frame = 0, active = null;

async function unwrap(p){const {data,error}=await p;if(error) throw error; return data}
function setImage(el, url, fallback = null, onLoaded = null){
  const finalUrl = typeof url === 'string' && /^(https:\/\/|\/)/.test(url) ? url : '';
  el.onload = null;
  el.onerror = null;
  if(fallback) fallback.hidden = false;
  if(!finalUrl){el.hidden = true;el.removeAttribute('src');return;}
  el.hidden = true;
  el.onload = () => {
    el.hidden = false;
    if(fallback) fallback.hidden = true;
    if(onLoaded) onLoaded(true);
  };
  el.onerror = () => {
    el.hidden = true;
    if(fallback) fallback.hidden = false;
    if(onLoaded) onLoaded(false);
    console.warn('Missing cake shop image:', finalUrl);
  };
  el.src = finalUrl;
}
function setSceneArt(){
  setImage($('sceneBg'), sceneAssets.orderSceneBackground);
  setImage($('receptionDesk'), sceneAssets.receptionDesk, $('sceneFallbackDesk'));
}

async function init(){
  try{
    const {data:{user}} = await sb.auth.getUser();
    if(!user){ view('loginPanel'); return; }
    const member = await unwrap(sb.from('profiles').select('username,approved').eq('user_id', user.id).single());
    if(!member.approved) throw Error('Your membership is disabled.');
    $('who').textContent = member.username;
    $('logout').hidden = false;

    orders = await unwrap(sb.rpc('get_current_cake_orders'));
    if(orders.length !== 2) throw Error('Could not load this week’s two customers.');
    const end = new Date(orders[0].week_end);
    $('weekTime').textContent = 'Current week ends ' + end.toLocaleString(undefined,{dateStyle:'full',timeStyle:'short',timeZone:'America/Los_Angeles'}) + ' Pacific time';
    $('deadline').textContent = $('weekTime').textContent;

    frames = [];
    orders.forEach(o => {
      const lines = Array.isArray(o.entrance_dialogue) ? o.entrance_dialogue : [];
      (lines.length ? lines : ['Welcome to the bakery!']).forEach(s => frames.push({o,s}));
      frames.push({o, s: o.order_dialogue || 'I have a cake request for you!'});
    });
    frame = 0;
    setSceneArt();
    renderFrame();
    view('cutscene');
  }catch(e){ say(e.message || String(e)); view('loginPanel'); }
}

function renderFrame(){
  const current = frames[frame];
  if(!current) return;
  const {o,s} = current;
  $('sceneTitle').textContent = frame === 0 ? 'The bakery doors open...' : 'A special request';
  $('speaker').textContent = o.customer_name;
  $('speech').textContent = s;
  const override = characterAssets[o.customer_code] || {};
  setImage($('portrait'), override.sprite || o.portrait_path, $('portraitFallback'));
  const bubble = $('bubbleBox');
  bubble.classList.remove('customArt');
  setImage($('speechArt'), override.bubble || o.speech_image_path, null, loaded => bubble.classList.toggle('customArt', loaded));
  $('sceneCounter').textContent = `${frame + 1} / ${frames.length}`;
  $('prevLine').disabled = frame === 0;
  $('nextLine').textContent = frame === frames.length - 1 ? 'Choose an order →' : 'Continue →';
}

$('prevLine').onclick = () => { if(frame > 0){ frame--; renderFrame(); } };
$('nextLine').onclick = () => { if(frame + 1 < frames.length){ frame++; renderFrame(); } else showOrders(); };
$('stageScene').addEventListener('click', e => {
  if(e.target.closest('button')) return;
  $('nextLine').click();
});
$('stageScene').addEventListener('mousemove', e => {
  const box = $('stageScene').getBoundingClientRect();
  const px = ((e.clientX - box.left) / box.width) - 0.5;
  const py = ((e.clientY - box.top) / box.height) - 0.5;
  $('customerWrap').style.transform = `translate(${px * 10}px, ${py * 6}px)`;
  $('bubbleWrap').style.transform = `translate(${px * -8}px, ${py * -5}px)`;
});
$('stageScene').addEventListener('mouseleave', () => {
  $('customerWrap').style.transform = '';
  $('bubbleWrap').style.transform = '';
});

function showOrders(){
  const root = $('orderCards');
  root.replaceChildren();
  orders.forEach(o => {
    const card = document.createElement('button');
    card.className = 'orderCard';
    const title = document.createElement('h2');
    title.textContent = o.customer_name;
    card.append(title);
    const characterSprite = characterAssets[o.customer_code]?.sprite || o.portrait_path;
    if(characterSprite){
      const img = document.createElement('img');
      setImage(img, characterSprite);
      card.append(img);
    }
    const d = document.createElement('div');
    d.className = 'req';
    if(o.mystery){
      d.textContent = '???? — This order is a mystery.';
    } else {
      const req = o.display_requirements || {};
      const cream = Object.entries(req.cream || {}).filter(([,n]) => n > 0).map(([k,n]) => `${n} ${k} cream`).join(', ');
      const toppings = Object.entries(req.toppings || {}).filter(([,n]) => n > 0).map(([k,n]) => `${n} ${k.replaceAll('_',' ')}`).join(', ');
      d.textContent = `${req.flavor || 'Not set'} frosting • ${req.layers || '?'} layers\nCream: ${cream || 'None'}\nToppings: ${toppings || 'None'}`;
    }
    card.append(d);
    card.onclick = () => { active = o; $('activeCustomer').textContent = `Baking for ${o.customer_name}`; view('locations'); };
    root.append(card);
  });
  view('chooseOrder');
}

$('switchOrder').onclick = showOrders;
$('shop').onclick = () => {
  view('locationPreview');
  $('placeName').textContent = 'Toppings Shop';
  $('placeTitle').textContent = 'A world of sweet decorations';
  $('placeIntro').textContent = 'Here are the available items and their Tarot prices. Purchase controls come in the upcoming shop step.';
  loadShop();
};
$('kitchen').onclick = () => {
  view('locationPreview');
  $('placeName').textContent = 'Kitchen';
  $('placeTitle').textContent = 'Your cake awaits';
  $('placeIntro').textContent = 'The kitchen will let you pick five frosting flavors, 1–4 layers, pipe cream and place purchased toppings. Your chosen customer stays selected.';
  $('previewContent').replaceChildren();
};
async function loadShop(){
  try{
    const items = await unwrap(sb.from('topping_catalog').select('name,cost').eq('active',true).order('cost'));
    const root = $('previewContent');
    root.replaceChildren();
    for(const i of items){
      const node = document.createElement('div');
      node.className = 'item';
      node.textContent = `${i.name} · ${i.cost}🂱`;
      root.append(node);
    }
  }catch(e){ say(e.message); }
}
$('backToLocations').onclick = () => view('locations');
$('loginForm').onsubmit = async e => {
  e.preventDefault();
  try{
    await unwrap(sb.auth.signInWithPassword({email:$('email').value,password:$('password').value}));
    say('');
    await init();
  }catch(err){ say(err.message); }
};
$('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

init();
