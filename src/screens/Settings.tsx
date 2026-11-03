import {useEffect,useState} from 'react';
import {Camera,KeyRound,LockKeyhole,Settings2,ShieldCheck,Upload,Users} from 'lucide-react';
import {MODULES,type ModuleCode} from '../lib/catalog';
import {authAction,supabase,uploadPhoto} from '../lib/supabase';
import {getOperators} from '../lib/data';
import {formatDate,formatWhen} from '../lib/time';
import type {AuditEvent} from '../lib/types';
import {Panel,Button,Empty,Loading,Pill} from '../components/Shared';
import type {Profile} from '../lib/types';
import type {ScreenProps} from './common';

export function SettingsScreen(props:ScreenProps&{profile:Profile;images:Record<string,string>;reloadImages:()=>Promise<void>}){
 const {profile,busy,action,images,reloadImages}=props;
 const [operators,setOperators]=useState<Profile[]>([]),[loading,setLoading]=useState(true);
 const [target,setTarget]=useState(''),[adminPin,setAdminPin]=useState(''),[newPin,setNewPin]=useState('');
 const [reason,setReason]=useState(''),[verified,setVerified]=useState(false);
 const [adminEvents,setAdminEvents]=useState<AuditEvent[]>([]);
 const [files,setFiles]=useState<Partial<Record<ModuleCode,File|null>>>({});
 useEffect(()=>{getOperators().then(setOperators).catch(()=>setOperators([])).finally(()=>setLoading(false));loadAdminEvents();},[]);
 async function loadAdminEvents(){const {data}=await supabase.from('audit_events').select('*').in('entity_table',['profiles','equipment_images']).order('created_at',{ascending:false}).limit(30);setAdminEvents((data||[]) as AuditEvent[]);}
 async function upload(code:ModuleCode){const file=files[code];if(!file)return;
  const ok=await action(async()=>{
   const path=await uploadPhoto(file,'equipment');
   const {error}=await supabase.from('equipment_images').upsert({module_code:code,storage_path:path},{onConflict:'module_code'});
   if(error)throw error;
   await reloadImages();await loadAdminEvents();
  },`Imagem do ${code} atualizada.`);
  if(ok)setFiles(old=>({...old,[code]:null}));
 }
 async function resetPin(){const ok=await action(async()=>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw new Error('Sessão expirada. Entre novamente.');
  await authAction({action:'reset-pin',targetMatricula:target,newPin,adminPin,reason,identityVerified:verified},session.access_token);
 },'PIN redefinido. Informe o novo PIN diretamente ao operador identificado.');
 if(ok){setTarget('');setNewPin('');setAdminPin('');setReason('');setVerified(false);await loadAdminEvents();}
 }
 if(profile.role!=='configurador')return <Panel title="Acesso restrito"><p>Somente o responsável pelas configurações pode acessar esta seção.</p></Panel>;
 return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">ACESSO RESTRITO</span><h1>Configurações</h1><p>Fotografias oficiais, operadores e redefinição controlada de PIN.</p></div><Settings2 size={30}/></div>
  <div className="security-strip"><ShieldCheck size={20}/><div><strong>Perfil Configurador</strong><p>Permissões verificadas pelo banco e pela função de autenticação, não apenas pela tela.</p></div></div>
  <Panel title="Imagens dos equipamentos" sub="Substitua as ilustrações provisórias por fotografias autorizadas. JPEG, PNG ou WebP, até 10 MB.">
   <div className="settings-images">{MODULES.map(m=><div className="settings-image-card" key={m.code}><img src={images[m.code]||`${import.meta.env.BASE_URL}${m.image}`} alt={m.title}/><div><strong>{m.code} · {m.title}</strong><label className="file-label"><Camera size={16}/>{files[m.code]?.name||'Selecionar fotografia'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFiles(old=>({...old,[m.code]:e.target.files?.[0]||null}))}/></label><Button disabled={busy||!files[m.code]} variant="secondary" onClick={()=>upload(m.code)}><Upload size={15}/> Substituir imagem</Button></div></div>)}</div>
  </Panel>
  <Panel title="Operadores cadastrados" sub="Cadastros comuns recebem apenas o perfil Operador." aside={<Pill text={`${operators.length} registro(s)`}/> }>
   {loading?<Loading/>:operators.length?<div className="operators-list">{operators.map(o=><div className="operator-row" key={o.id}><div className="avatar">{o.full_name.slice(0,1).toUpperCase()}</div><div><strong>{o.full_name}</strong><span>Matrícula {o.matricula} · Desde {formatDate(o.created_at.slice(0,10))}</span></div><Pill text={o.role==='configurador'?'Configurador':'Operador'} kind={o.role==='configurador'?'blue':'neutral'}/></div>)}</div>:<Empty text="Não foi possível localizar operadores."/>}
  </Panel>
  <Panel title="Redefinição segura de PIN" sub="Confirme a identidade pessoalmente. O PIN antigo não pode ser consultado.">
   <div className="form-grid"><label>Matrícula do operador<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Selecione a matrícula</option>{operators.map(p=><option value={p.matricula} key={p.id}>{p.matricula} · {p.full_name}</option>)}</select></label>
    <label>Novo PIN (6 a 12 dígitos)<input type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,''))}/></label>
    <label>Seu PIN de Configurador (reconfirmação)<input type="password" inputMode="numeric" autoComplete="off" value={adminPin} onChange={e=>setAdminPin(e.target.value.replace(/\D/g,''))}/></label>
    <label>Motivo / protocolo da verificação<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: identidade conferida presencialmente"/></label></div>
   <label className="check-inline"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Confirmo que verifiquei a identidade do operador fora do sistema.</label>
   <p className="info-line"><LockKeyhole size={16}/> A redefinição fica registrada em auditoria, sem armazenar o PIN.</p>
   <Button disabled={busy||!target||!/^\d{6,12}$/.test(newPin)||!/^\d{6,12}$/.test(adminPin)||reason.trim().length<8||!verified} variant="secondary" onClick={resetPin}><KeyRound size={16}/> Redefinir PIN</Button>
  </Panel>
  <Panel title="Registros administrativos" sub="Alterações de fotografias oficiais e redefinições de PIN, sem PINs expostos.">{adminEvents.length?<div className="record-list compact">{adminEvents.map(a=><div className="record" key={a.id}><strong>{a.operation==='PIN_RESET'?'PIN redefinido':`Fotografia ${String(a.new_data?.module_code||'de equipamento')} substituída`}</strong><p className="muted">{a.actor_name||'Sistema'} · {formatWhen(a.created_at)}</p></div>)}</div>:<Empty text="Nenhuma alteração administrativa registrada."/>}</Panel>
  <div className="muted small-note"><Users size={15}/> Atenção: cadastro livre não comprova identidade. Utilize dados de teste até concluir as verificações e autorizações da empresa.</div>
 </div>;
}
