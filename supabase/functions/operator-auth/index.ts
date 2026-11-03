// Supabase Edge Function. Deploy with --no-verify-jwt. For reset, this function
// validates the supplied JWT and configurador role itself. Service key never ships to client.
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const pepper = Deno.env.get('AUTH_PIN_PEPPER');
if (!pepper || pepper.length < 32) throw new Error('Configure AUTH_PIN_PEPPER com pelo menos 32 caracteres');
const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const publicAuth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const encoder = new TextEncoder();
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
});
const normalizeMat = (m: unknown) => typeof m === 'string' ? m.trim().toUpperCase() : '';
const validMat = (m: string) => /^[A-Z0-9._-]{3,40}$/.test(m);
const validPin = (p: unknown): p is string => typeof p === 'string' && /^\d{6,12}$/.test(p);
const newInternalEmail = () => `op-${crypto.randomUUID().replaceAll('-', '')}@accounts.example.com`;

async function passwordFor(matricula: string, pin: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`plant-mobile-v1:${matricula}:${pin}`));
  return Array.from(new Uint8Array(mac), x => x.toString(16).padStart(2, '0')).join('');
}
async function signIn(matricula: string, pin: string, loginEmail: string) {
  return publicAuth.auth.signInWithPassword({ email: loginEmail, password: await passwordFor(matricula,pin) });
}
async function tooManyFailures(matricula: string) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data, error } = await admin.from('auth_login_attempts').select('success,created_at')
    .eq('matricula',matricula).gte('created_at',since).order('created_at',{ascending:false}).limit(30);
  if (error) throw error;
  let failures = 0;
  for (const attempt of data ?? []) { if (attempt.success) break; failures++; }
  return failures >= 5;
}
async function recordLogin(matricula: string, success: boolean) {
  const { error } = await admin.from('auth_login_attempts').insert({matricula,success});
  if (error) throw error;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
  if (request.method !== 'POST') return json(405,{error:'Método não permitido'});
  try {
    const body = await request.json();
    const action = body.action;
    if (action === 'register') {
      const matricula = normalizeMat(body.matricula);
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g,' ') : '';
      if (!validMat(matricula) || fullName.length < 3 || fullName.length > 120 || !validPin(body.pin) || body.pin !== body.confirmPin)
        return json(400,{error:'Confira o nome, a matrícula e os PINs de 6 a 12 números.'});
      // Teto global conservador para impedir surtos de cadastros no piloto.
      // Complementar com proteção por IP/captcha no gateway antes de uso real.
      const { count:recentRegistrations, error:registrationError } = await admin.from('profiles')
        .select('id',{head:true,count:'exact'}).gte('created_at',new Date(Date.now()-15*60_000).toISOString());
      if(registrationError)throw registrationError;
      if((recentRegistrations??0)>=20)return json(429,{error:'Limite de novos cadastros atingido. Tente novamente em alguns minutos.'});
      const {data:knownMatricula}=await admin.from('profiles').select('id').eq('matricula',matricula).maybeSingle();
      if(knownMatricula)return json(409,{error:'Esta matrícula já está cadastrada.'});
      const authEmail = newInternalEmail();
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email: authEmail, password: await passwordFor(matricula,body.pin), email_confirm: true });
      if (createError || !created.user) return json(400,{error:'Não foi possível criar o cadastro.'});
      const id = created.user.id;
      const { error: insertError } = await admin.from('profiles').insert({id,matricula,full_name:fullName,auth_email:authEmail,role:'operador'});
      if (insertError) {
        await admin.auth.admin.deleteUser(id);
        if (insertError.code === '23505') return json(409,{error:'Esta matrícula já está cadastrada.'});
        throw insertError;
      }
      const { data, error } = await signIn(matricula,body.pin,authEmail);
      if (error || !data.session) return json(503,{error:'Cadastro criado, mas não foi possível iniciar a sessão. Faça login.'});
      return json(200,{session:data.session});
    }
    if (action === 'login') {
      const matricula = normalizeMat(body.matricula);
      const pin = body.pin;
      if (!validMat(matricula) || !validPin(pin)) return json(401,{error:'Matrícula ou PIN inválido.'});
      if (await tooManyFailures(matricula)) return json(429,{error:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'});
      const { data: profile } = await admin.from('profiles').select('id,auth_email').eq('matricula',matricula).maybeSingle();
      const loginResult = profile ? await signIn(matricula,pin,profile.auth_email) : null;
      const session = loginResult?.data?.session;
      await recordLogin(matricula,Boolean(session));
      if (!session) return json(401,{error:'Matrícula ou PIN inválido.'});
      return json(200,{session});
    }
    if (action === 'reset-pin') {
      const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
      if (!bearer) return json(401,{error:'Autenticação necessária'});
      const {data:{user},error:userError} = await admin.auth.getUser(bearer);
      if (userError || !user) return json(401,{error:'Sessão inválida'});
      const {data:cfg} = await admin.from('profiles').select('id,matricula,full_name,role,auth_email').eq('id',user.id).maybeSingle();
      if (!cfg || cfg.role !== 'configurador') return json(403,{error:'Apenas o configurador pode redefinir o PIN.'});
      const matricula = normalizeMat(body.targetMatricula);
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!validMat(matricula) || !validPin(body.newPin) || !validPin(body.adminPin) || reason.length < 8 || body.identityVerified !== true)
        return json(400,{error:'Verifique a identidade do operador e preencha todos os campos.'});
      if (await tooManyFailures(cfg.matricula)) return json(429,{error:'Muitas tentativas de confirmação. Aguarde 15 minutos.'});
      const confirmation = await signIn(cfg.matricula,body.adminPin,cfg.auth_email);
      await recordLogin(cfg.matricula,Boolean(confirmation.data.session));
      if (!confirmation.data.session) return json(403,{error:'PIN do configurador incorreto.'});
      const {data:target} = await admin.from('profiles').select('id,auth_email').eq('matricula',matricula).maybeSingle();
      if (!target) return json(404,{error:'Matrícula não encontrada.'});
      const {error:resetError} = await admin.auth.admin.updateUserById(target.id,{password:await passwordFor(matricula,body.newPin)});
      if (resetError) throw resetError;
      await admin.from('audit_events').insert({entity_table:'profiles',entity_id:target.id,operation:'PIN_RESET',actor_id:cfg.id,actor_name:cfg.full_name,new_data:{matricula,reason,identity_verified:true}});
      return json(200,{ok:true});
    }
    return json(400,{error:'Ação inválida'});
  } catch (err) {
    console.error('operator-auth error:',err);
    return json(500,{error:'Falha no servidor. Tente novamente ou informe o responsável.'});
  }
});
