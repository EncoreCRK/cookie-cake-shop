import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const sb=createClient(window.CAKE_CONFIG.supabaseUrl,window.CAKE_CONFIG.supabaseKey),$=id=>document.getElementById(id);
let items=[];const out=s=>$('status').textContent=s;
async function call(q){const {data,error}=await q;if(error)throw error;return data}
function display(){const o=items.find(x=>x.customer_code===$('customer').value);$('json').value=JSON.stringify(o?.requirements||{},null,2)}
async function init(){try{const {data:{user}}=await sb.auth.getUser();if(!user)throw Error('Sign in using the main admin dashboard first.');const profile=await call(sb.from('profiles').select('role,approved').eq('user_id',user.id).single());if(profile.role!=='admin'||!profile.approved)throw Error('Admin-only page.');items=await call(sb.rpc('admin_view_current_orders'));$('customer').replaceChildren();for(const x of items){const opt=document.createElement('option');opt.value=x.customer_code;opt.textContent=x.customer_code.replaceAll('_',' ');$('customer').append(opt)}display()}catch(e){out(e.message)}}
$('customer').onchange=display;$('form').onsubmit=async e=>{e.preventDefault();try{await call(sb.rpc('admin_override_active_order',{p_customer_code:$('customer').value,p_requirements:JSON.parse($('json').value)}));out('Saved this week’s order.');await init()}catch(err){out(err.message)}};init();
