import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const url = Deno.env.get('SUPABASE_URL')!;
const publishable = Deno.env.get('SUPABASE_ANON_KEY') || JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const admin = createClient(url, secret, { auth: { persistSession: false } });
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { error: 'POST required' });
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply(401, { error: 'Authentication required' });
    const authClient = createClient(url, publishable, {auth:{persistSession:false}});
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return reply(401, { error: 'Invalid session' });
    const { data: actor, error: actorError } = await admin.from('profiles').select('role,approved').eq('user_id', user.id).single();
    if (actorError || actor?.role !== 'admin' || actor?.approved !== true) return reply(403, { error: 'Admin permission required' });
    const body = await req.json();
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (username.length < 1 || username.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12)
      return reply(400, { error: 'Provide username (1–80 chars), valid email and password (12+ chars)' });
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } });
    if (error) return reply(400, { error: error.message });
    await admin.from('admin_audit_log').insert({ actor_id: user.id, action: 'create_member', target_user_id: data.user.id, details: { username } });
    return reply(200, { ok: true, username, user_id: data.user.id });
  } catch (e) { return reply(500, { error: e instanceof Error ? e.message : 'Unexpected error' }); }
});
