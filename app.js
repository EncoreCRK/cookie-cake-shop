import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cfg=window.CAKE_CONFIG;
if(
 !cfg?.supabaseUrl||
 !cfg?.supabaseKey||
 cfg.supabaseUrl.includes('YOUR_NEW')) 
 alert('Fill in config.js with the NEW Cake Shop Supabase URL and publishable key.');
const sb=createClient(
 cfg.supabaseUrl,
 cfg.supabaseKey);
const $=id=>document.getElementById(id);
const message=(txt,bad=false)=>{
 const n=$('message');
 n.textContent=txt;
 n.className=bad?
  'error':'';
 n.style.display='block';
 setTimeout(()=>{n.style.display='none'},6500)
};
const fail=e=>{
 console.error(e);
 message(
  e?.message||
  String(e),true
 )
};
async function unwrap(p){
 const {data,error}=await p;
 if(error)throw error;
 return data
}
const el=(tag,text,cl)=>{
 const n=document.createElement(tag);
 if(text!==undefined)n.textContent=text;
 if(cl)n.className=cl;
 return n
};
let members=[],customers=[],templates=[],reviews=[];
const isAdmin=async()=>{
 const {data:{user}}=await sb.auth.getUser();
 if(!user)return false;
 const p=await unwrap(sb.from('profiles').select('username,role,approved').eq('user_id',user.id).single());
 if(
  p.role!=='admin'||
  !p.approved
 )
  return false;$('welcome').textContent=`Signed in as ${p.username}`;return true
};
async function refresh(){
 members=await unwrap(
  sb.from('profiles')
  .select('user_id,username,approved,role')
  .order('username')
 );
 customers=await unwrap(sb.from('customers').select('*').order('rotation_week'));
 templates=await unwrap(sb.rpc('admin_get_templates'));
 reviews=await unwrap(sb.from('review_cards').select('*'));
 renderMembers();renderCustomerSelects();renderReview();await loadInventory();await loadPurchases();}
async function authenticate(){
 try{
  const ok=await isAdmin();$('login').hidden=ok;$('dashboard').hidden=!ok;
  if(ok)await refresh();else {
   const {data:{session}}=await sb.auth.getSession();
   if(session)message('This account is not an approved administrator.',true)}
 }
 catch(e){fail(e)}
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();
 try{
  await unwrap(
   sb.auth.signInWithPassword({email:$('loginEmail').value,password:$('loginPassword').value}));
  await authenticate()}catch(err){fail(err)}});
$('signOut').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('tabs').addEventListener('click',e=>{
 const tab=e.target.closest('button[data-tab]');
 if(!tab)
  return;
 document.querySelectorAll('.tab').forEach(n=>n.hidden=n.id!==tab.dataset.tab);
 document.querySelectorAll('#tabs button').forEach(n=>n.classList.toggle('active',n===tab));
});
function renderMembers(){
 const root=$('membersList');
 root.replaceChildren();
 const select=$('inventoryMember');
 select.replaceChildren();
 for(const m of members){
  const option=el('option',m.username);
  option.value=m.user_id;select.append(option);
 const row=el('div',undefined,'record');
  const name=el('input');name.value=m.username;name.maxLength=80;
  const status=el('span',`${m.role} • ${m.approved?'Active':'Disabled'}`);
  const actions=el('div',undefined,'actions');
  const save=el('button','Save username');
  const toggle=el('button',m.approved?'Disable':'Enable','secondary');
  save.onclick=()=>action(async()=>{
   await unwrap(sb.rpc('admin_set_member',{p_user_id:m.user_id,p_username:name.value,p_approved:m.approved}));
   await refresh()},'Member updated');
  toggle.onclick=()=>action(async()=>{
   await unwrap(sb.rpc('admin_set_member',{p_user_id:m.user_id,p_username:name.value,p_approved:!m.approved}));
   await refresh()},'Membership updated');
  actions.append(save,toggle);row.append(name,status,actions);
  root.append(row)}}
async function action(task,success){try{await task();message(success)}catch(e){fail(e)}}
$('createForm').onsubmit=e=>{e.preventDefault();action(async()=>{
 const {data,error}=await sb.functions.invoke(
  'create-member',
  {body:{username:$('newUsername').value,email:$('newEmail').value,password:$('newPassword').value}
  }
 );
 if(error)throw error;
 if(data?.error)throw Error(data.error);
 $('createForm').reset();
 await refresh()},'Member created')};
$('inventoryForm').onsubmit=e=>{
 e.preventDefault();
 action(async()=>{
  await unwrap(
   sb.rpc(
    'admin_adjust_frosting',
    {p_user_id:$('inventoryMember')
     .value,p_flavor:$('inventoryFlavor')
     .value,p_delta:Number($('inventoryDelta').value),
     p_reason:$('inventoryReason').value}));
  await loadInventory()},'Frosting inventory updated')
};
$('inventoryMember').onchange=loadInventory;
async function loadInventory(){
 if(!$('inventoryMember').value)return;
 try{
  const data=await unwrap(
   sb.from('frosting_inventory')
   .select('flavor,quantity')
   .eq('user_id',$('inventoryMember').value)
   .order('flavor'));$('inventoryList')
   .replaceChildren(...data.map(v=>el('div',`${v.flavor}: ${v.quantity}`,'record')))
 }
 catch(e){fail(e)}
}
function renderCustomerSelects(){
 for(const id of ['customerSelect','reviewCustomer']){
  const n=$(id),old=n.value;n.replaceChildren();
  for(const c of customers){
   const o=el('option',`${c.name}${c.mystery?' (Mystery)':''}`);
   o.value=c.code;n.append(o)
  }
  if(customers.some(c=>c.code===old))n.value=old}loadCustomer();
 renderReview()
}
function loadCustomer(){
 const c=customers.find(x=>x.code===$('customerSelect').value);
 if(!c)return;
 $('entranceDialogue').value=(c.entrance_dialogue||[]).join('\n');$('orderDialogue').value=c.order_dialogue;
 $('portraitPath').value=c.portrait_path||'';
 $('speechPath').value=c.speech_image_path||'';
 const t=templates.find(x=>x.customer_code===c.code);
 $('orderJSON').value=JSON.stringify(t?.requirements&&Object.keys(t.requirements).length?t.requirements:{
  flavor:'milky',
  layers:1,
  cream:{},
  toppings:{}
 },null,2)
}
$('customerSelect').onchange=loadCustomer;
$('customerForm').onsubmit=e=>{
 e.preventDefault();
 action(async()=>{
  await unwrap(sb.rpc('admin_save_customer',{
   p_code:$('customerSelect').value,
   p_entrance_dialogue:$('entranceDialogue').value.split('\n').map(s=>s.trim()).filter(Boolean),
   p_order_dialogue:$('orderDialogue').value,
   p_portrait_path:$('portraitPath').value,
   p_speech_image_path:$('speechPath').value}));
  await refresh()},'Customer dialogue saved')
};
$('orderForm').onsubmit=e=>{
 e.preventDefault();
 action(async()=>{
  const requirements=JSON.parse($('orderJSON').value);
  await unwrap(sb.rpc('admin_save_template',{p_code:$('customerSelect').value,p_requirements:requirements}));
  await refresh()},'Recurring order saved (future weeks)')
};
function renderReview(){
 const r=reviews.find(x=>x.customer_code===$('reviewCustomer').value&&x.stars===Number($('reviewStars').value));
 $('reviewText').value=r?.review_text||'';
 $('reviewImage').value=r?.review_image_path||''
}
$('reviewCustomer').onchange=renderReview;
$('reviewStars').onchange=renderReview;
$('reviewForm').onsubmit=e=>{
 e.preventDefault();
 action(async()=>{
  await unwrap(sb.rpc('admin_save_review',{
   p_code:$('reviewCustomer').value,
   p_stars:Number($('reviewStars').value),
   p_text:$('reviewText').value,
   p_image_path:$('reviewImage').value}));
  reviews=await unwrap(sb.from('review_cards').select('*'));
  renderReview()},'Review card saved')
};
async function loadPurchases(){try{
 const p=await unwrap(
  sb.from('purchases')
  .select('id,user_id,total_tarots,status,created_at')
  .order('created_at',{ascending:false}).limit(100));
 const root=$('purchasesList');
 root.replaceChildren();if(!p.length){
  root.append(el('p','No purchases yet. Checkout is a later step.'));
  return}
 for(const purchase of p){
  const member=members.find(x=>x.user_id===purchase.user_id);
  const row=el('div',undefined,'record');
  row.append(el('span',`${member?.username||'Unknown'} • ${purchase.total_tarots}🂱 • ${purchase.status}`));
  if(!['deducted','cancelled'].includes(purchase.status)){
   const b=el('button','Mark deducted');
   b.onclick=()=>action(async()=>{
    await unwrap(sb.rpc('admin_set_purchase_status',{p_purchase_id:purchase.id,p_status:'deducted'}));
    await loadPurchases()},'Marked as deducted');
   row.append(b)}root.append(row)}}catch(e){fail(e)}}
authenticate();
