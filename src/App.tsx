import {useCallback,useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {Activity,AlertTriangle,Archive,ArrowRight,BarChart3,Bell,CheckCircle2,ChevronDown,ClipboardCheck,Clock3,Cloud,Download,Factory,FileClock,History,Home,KeyRound,LogIn,LogOut,Menu,MoreHorizontal,RefreshCw,Settings2,ShieldCheck,ShieldAlert,UserPlus,Users,X} from 'lucide-react';
import {MODULES,type ModuleCode} from './lib/catalog';
import {EMPTY_DATA,type Profile,type Shift,type ShiftData,type View} from './lib/types';
import {CONFIGURED,authAction,getPhotoUrl,niceError,supabase} from './lib/supabase';
import {getImages,getShift,getShiftData} from './lib/data';
import {formatDate,formatWhen,getCurrentShiftKey,isShiftEnded,shiftEnd} from './lib/time';
import {makePdf} from './lib/pdf';
import {Loading,Panel,Pill,Button} from './components/Shared';
import {ModulesGrid,ModuleScreen,moduleProgress} from './screens/Modules';
import {ProductionScreen,StopsScreen,OccurrencesScreen} from './screens/Operations';
import {HandoverScreen} from './screens/Handover';
import {HistoryScreen} from './screens/History';
import {SettingsScreen} from './screens/Settings';
import './style.css';

const NAV:[View,string,React.ReactNode][]=[
 ['home','Início',<Home size={20}/>],['modules','Equipamentos',<ClipboardCheck size={20}/>],
 ['production','Registros',<BarChart3 size={20}/>],['handover','Passagem',<FileClock size={20}/>],['history','Histórico',<History size={20}/>]
];
function FormLogin({onLoggedIn}:{onLoggedIn:()=>void}){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [name,setName]=useState(''),[mat,setMat]=useState(''),[pin,setPin]=useState(''),[confirmPin,setConfirm]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);
  try{
    if(mode==='register'&&pin!==confirmPin)throw new Error('Os PINs não coincidem.');
    const payload=mode==='login'?{action:'login',matricula:mat,pin}:{action:'register',matricula:mat,fullName:name,pin,confirmPin};
    const result=await authAction(payload);
    const {error:sessionError}=await supabase.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});
    if(sessionError)throw sessionError;
    onLoggedIn();
  }catch(e){setError(niceError(e));}finally{setBusy(false);}
 }
 return <div className="login-shell"><div className="login-brand"><div className="login-brandmark"><Factory size={32}/></div><span>SISTEMA OPERACIONAL</span><h1>Controle da<br/>Planta Móvel.</h1><p>Checklists digitais, registros de produção e passagem de turno em um só lugar.</p><div className="login-module-tags">{MODULES.map(m=><span key={m.code}>{m.code}</span>)}</div><small>Piloto independente · Não é um sistema oficial do fabricante.</small></div>
  <div className="login-side"><div className="login-box"><div className="login-intro"><span className="eyebrow">ACESSO DOS OPERADORES</span><h2>{mode==='login'?'Bem-vindo de volta':'Criar meu cadastro'}</h2><p>{mode==='login'?'Entre com a sua matrícula e PIN individual.':'Cadastro livre para a versão piloto.'}</p></div>
   <div className="auth-switch"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');}}>Entrar</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');}}>Cadastrar</button></div>
   <form onSubmit={submit} className="auth-form">{mode==='register'&&<label>Nome completo<input required minLength={3} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome e sobrenome" autoComplete="name"/></label>}
    <label>Matrícula<input required minLength={3} maxLength={40} autoCapitalize="characters" value={mat} onChange={e=>setMat(e.target.value.toUpperCase().replace(/[^A-Z0-9._-]/g,''))} placeholder="Digite sua matrícula" autoComplete="username"/></label>
    <label>PIN individual<input required type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="De 6 a 12 números" autoComplete={mode==='login'?'current-password':'new-password'}/></label>
    {mode==='register'&&<label>Confirmar PIN<input required type="password" inputMode="numeric" pattern="[0-9]{6,12}" value={confirmPin} onChange={e=>setConfirm(e.target.value.replace(/\D/g,''))} placeholder="Repita o PIN" autoComplete="new-password"/></label>}
    {error&&<div className="error-box"><AlertTriangle size={16}/>{error}</div>}
    <Button type="submit" disabled={busy} className="submit-wide">{mode==='login'?<LogIn size={17}/>:<UserPlus size={17}/>} {busy?'Processando...':mode==='login'?'Acessar sistema':'Criar conta'}</Button>
    <p className="login-help"><KeyRound size={14}/> Esqueceu o PIN? Procure o responsável pelas configurações para verificar sua identidade e redefinir.</p>
   </form></div><span className="login-footer">Planta Móvel · Checklist e Controle de Turno · v3.0</span></div>
 </div>;
}
function SetupScreen(){return <div className="setup-wrapper"><div className="setup-card"><div className="setup-logo"><Factory size={28}/> PLANTA MÓVEL</div><h1>Aplicação pronta para conectar</h1><p>O sistema possui banco de dados, autenticação e formulários reais. É necessário configurar as credenciais públicas do seu projeto Supabase antes de utilizá-lo.</p><ol><li>Crie um projeto gratuito no Supabase e execute o arquivo SQL de migração.</li><li>Configure e publique a Edge Function <code>operator-auth</code> com o segredo do PIN.</li><li>Copie <code>.env.example</code> para <code>.env.local</code> e preencha as chaves públicas.</li></ol><p className="setup-note"><ShieldAlert size={18}/> Não coloque dados reais da operação durante a fase de testes e homologação.</p><span>As instruções completas estão no README do projeto.</span></div></div>}
function Dashboard({profile,shift,data,images,onOpen,navigate}:{profile:Profile;shift:Shift;data:ShiftData;images:Record<string,string>;onOpen:(m:ModuleCode)=>void;navigate:(v:View)=>void}){
 const issues=data.issues.filter(i=>i.status!=='resolvida');
 const done=MODULES.filter(m=>{const p=moduleProgress(m.code,data);return p.done===p.total;}).length;
 const status=shift.status==='encerrado'?'Turno finalizado':isShiftEnded(shift)?'Encerramento pendente':'Turno ativo';
 return <div className="page-stack dashboard-simple">
  <div className="dashboard-welcome">
   <div><span className="eyebrow">PAINEL DO TURNO · {status.toUpperCase()}</span><h1>Olá, {profile.full_name.split(' ')[0]}!</h1><p>Escolha um equipamento ou registre as atividades da equipe.</p></div>
   <span className="welcome-icon"><Factory size={32}/></span>
  </div>
  {issues.length>0&&<button className="alert-strip" onClick={()=>navigate('handover')}><AlertTriangle size={19}/><span><strong>{issues.length} pendência(s) em acompanhamento</strong><small>Consultar pendências na passagem de turno</small></span><ArrowRight size={18}/></button>}
  <div className="section-title"><div><span className="eyebrow">01 · EQUIPAMENTOS</span><h2>Checklists dos módulos</h2><p>Toque na foto do equipamento para preencher ou revisar.</p></div></div>
  <ModulesGrid data={data} images={images} onOpen={onOpen}/>
  <div className="section-title"><div><span className="eyebrow">02 · ATIVIDADES</span><h2>Registros e passagem</h2><p>Todos os registros continuam compartilhados com o mesmo turno.</p></div></div>
  <div className="simple-links">
   {[{label:'Produção, paradas e ocorrências',desc:'Registrar, consultar, editar ou anular',icon:<ClipboardCheck size={22}/>,view:'production' as View},
     {label:'Passagem de turno',desc:'Resumo automático, pendências e PDF',icon:<FileClock size={22}/>,view:'handover' as View},
     {label:'Consultar histórico',desc:'Turnos e relatórios anteriores',icon:<History size={22}/>,view:'history' as View}].map(q=><button key={q.label} className="simple-link" onClick={()=>navigate(q.view)}><span className="simple-link-icon">{q.icon}</span><span className="simple-link-copy"><strong>{q.label}</strong><small>{q.desc}</small></span><ArrowRight size={18}/></button>)}
  </div>
  <details className="overview-details"><summary>Resumo do turno <ChevronDown size={16}/></summary><div className="overview-grid">
   <div><strong>{done}/3</strong><span>Checklists completos</span></div><div><strong>{issues.length}</strong><span>Pendências abertas</span></div><div><strong>{data.production.length}</strong><span>Registros de produção</span></div><div><strong>{data.participants.length}</strong><span>Participantes</span></div>
  </div></details>
  <p className="disclaimer"><ShieldAlert size={17}/> O registro digital não substitui autorização operacional ou procedimento de segurança.</p>
 </div>;
}
function RecordNavigation({view,navigate}:{view:View;navigate:(v:View)=>void}){
 const tabs:[View,string,React.ReactNode][]=[['production','Produção',<BarChart3 size={18}/>],['stops','Paradas',<Clock3 size={18}/>],['occurrences','Ocorrências',<AlertTriangle size={18}/>]];
 return <div className="record-center"><div className="record-center-head"><span className="eyebrow">REGISTROS DO TURNO</span><h1>Atividades da equipe</h1><p>Escolha o tipo de informação. Os dados continuam disponíveis para todos os participantes do turno.</p></div><nav className="record-tabs" aria-label="Tipos de registro">{tabs.map(([id,label,icon])=><button key={id} type="button" className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>navigate(id)}>{icon}<span>{label}</span></button>)}</nav></div>;
}
function Shell(){
 const initial=getCurrentShiftKey();
 const [session,setSession]=useState<Session|null>(null),[initializing,setInitializing]=useState(true),[profile,setProfile]=useState<Profile|null>(null),[profileError,setProfileError]=useState('');
 const [date,setDate]=useState(initial.date),[kind,setKind]=useState<'diurno'|'noturno'>(initial.kind);
 const [shift,setShift]=useState<Shift|null>(null),[data,setData]=useState<ShiftData>(EMPTY_DATA);
 const [images,setImages]=useState<Record<string,string>>({});
 const [view,setView]=useState<View>('home'),[module,setModule]=useState<ModuleCode>('QJ341');
 const [connected,setConnected]=useState(false);
 const [shiftSelectorOpen,setShiftSelectorOpen]=useState(false);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[toast,setToast]=useState<{text:string;isError:boolean}|null>(null),[extra,setExtra]=useState(false);
 const reloadToken=useRef(0);
 useEffect(()=>{if(!CONFIGURED){setInitializing(false);return;}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setInitializing(false);}).catch(()=>setInitializing(false));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_evt,next)=>{setSession(next);setInitializing(false);});
  return()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{let alive=true;
  if(!session?.user.id){setProfile(null);setProfileError('');return;}
  supabase.from('profiles').select('id,matricula,full_name,role,created_at').eq('id',session.user.id).single()
   .then(({data:row,error})=>{if(!alive)return;if(error||!row){setProfile(null);setProfileError('Conta autenticada sem perfil operacional. Contate o configurador.');}else{setProfile(row as Profile);setProfileError('');}});
  return()=>{alive=false;};
 },[session?.user.id]);
 const notify=useCallback((text:string,isError=false)=>{setToast({text,isError});},[]);
 const reloadImages=useCallback(async()=>{
  const paths=await getImages(),output:Record<string,string>={};
  await Promise.all(paths.map(async row=>{try{output[row.module_code]=await getPhotoUrl(row.storage_path);}catch{ /* fallback local */ }}));
  setImages(output);
 },[]);
 useEffect(()=>{if(profile)reloadImages().catch(()=>{});},[profile?.id,reloadImages]);
 const refresh=useCallback(async()=>{
  if(!profile)return;
  const token=++reloadToken.current;
  try{
   const current=getCurrentShiftKey();
   const selectedIsCurrent=date===current.date&&kind===current.kind;
   const found=await getShift(date,kind,selectedIsCurrent);
   if(token!==reloadToken.current)return;
   if(found){const latest=await getShiftData(found.id);if(token!==reloadToken.current)return;setShift(found);setData(latest);}
   else {setShift(null);setData(EMPTY_DATA);}
   setConnected(true);
  }catch(error){if(token===reloadToken.current)setConnected(false);throw error;}
 },[profile?.id,date,kind]);
 useEffect(()=>{if(!profile)return;let active=true;setLoading(true);
  refresh().catch(e=>{if(active)notify(niceError(e),true);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;reloadToken.current++;};
 },[refresh,notify,profile?.id]);
 useEffect(()=>{if(!profile)return;
  const i=setInterval(()=>{void refresh().catch(()=>{});},20000);
  const r=setInterval(()=>{void reloadImages().catch(()=>{});},40*60*1000);
  const channel=supabase.channel('planta-movel-live').on('postgres_changes',{event:'*',schema:'public'},(payload)=>{if(payload.table==='equipment_images')void reloadImages().catch(()=>{});else void refresh().catch(()=>{});}).subscribe();
  return()=>{clearInterval(i);clearInterval(r);void supabase.removeChannel(channel);};
 },[profile?.id,refresh,reloadImages]);
 async function action(fn:()=>Promise<void>,message='Registro salvo com sucesso.'):Promise<boolean>{
  if(busy)return false;
  setBusy(true);
  try{await fn();notify(message);try{await refresh();}catch{notify('Registro salvo, mas não foi possível atualizar a tela. Use Atualizar.',true);}return true;}
  catch(e){notify(niceError(e),true);return false;}
  finally{setBusy(false);}
 }
 const current=getCurrentShiftKey();
 const selectedIsCurrent=date===current.date&&kind===current.kind;
 const isParticipant=!!shift&&data.participants.some(p=>p.operator_id===profile?.id);
 const canEdit=!!shift&&selectedIsCurrent&&shift.status==='aberto'&&isParticipant;
 const canClose=!!shift&&shift.status==='aberto'&&isParticipant&&(selectedIsCurrent||isShiftEnded(shift));
 function go(v:View){setView(v);setExtra(false);window.scrollTo({top:0,behavior:'instant'});}
 function openModule(code:ModuleCode){setModule(code);go('module');}
 function chooseShift(s:Shift){setDate(s.shift_date);setKind(s.kind);go('history');}
 function goCurrent(){const k=getCurrentShiftKey();setDate(k.date);setKind(k.kind);setShiftSelectorOpen(false);go('home');}
 async function logout(){setExtra(false);await supabase.auth.signOut();setProfile(null);setShift(null);setData(EMPTY_DATA);go('home');}
 const titleView:Record<View,string>={home:'Início',modules:'Equipamentos',module:'Checklist',production:'Registros',stops:'Registros',occurrences:'Registros',handover:'Passagem de turno',history:'Histórico',settings:'Configurações'};
 if(!CONFIGURED)return <SetupScreen/>;
 if(initializing)return <div className="auth-loading"><Factory size={36}/><Loading text="Iniciando sistema..."/></div>;
 if(!session)return <FormLogin onLoggedIn={()=>{}}/>;
 if(profileError)return <div className="setup-wrapper"><div className="setup-card"><p className="error-box">{profileError}</p><Button onClick={logout}>Sair desta sessão</Button></div></div>;
 if(!profile)return <div className="auth-loading"><Loading text="Identificando operador..."/></div>;
 const screenProps={shift:shift!,data,canEdit,busy,action,navigate:go};
 return <div className="app-shell">
  <header className="topbar"><div className="topbar-inner"><div className="brand" onClick={goCurrent} role="button" tabIndex={0}><span className="brand-icon"><Factory size={21}/></span><span><strong>PLANTA <em>MÓVEL</em></strong><small>CONTROLE OPERACIONAL</small></span></div>
   <div className="topbar-right"><span className="top-date"><Cloud size={15}/> {connected?'CONECTADO':'CONEXÃO NÃO CONFIRMADA'}</span><button onClick={()=>void refresh().catch(e=>notify(niceError(e),true))} className="top-icon" title="Atualizar dados"><RefreshCw size={18} className={loading?'spin':''}/></button><span className="top-profile"><span className="mini-avatar">{profile.full_name.charAt(0)}</span><span>{profile.full_name.split(' ')[0]}<small>{profile.matricula}</small></span></span><button className="top-icon" onClick={()=>setExtra(v=>!v)} aria-label="Abrir menu de opções"><MoreHorizontal size={23}/></button></div></div></header>
  {extra&&<div className="extra-menu"><div className="extra-user"><strong>{profile.full_name}</strong><span>Matrícula {profile.matricula} · {profile.role==='configurador'?'Configurador':'Operador'}</span></div>{profile.role==='configurador'&&<button onClick={()=>go('settings')}><Settings2 size={17}/> Configurações</button>}<button onClick={goCurrent}><Clock3 size={17}/> Ir para turno atual</button><button onClick={logout}><LogOut size={17}/> Sair do sistema</button></div>}
  <nav className="desktop-nav" aria-label="Navegação principal"><div className="desktop-nav-inner">{NAV.map(([id,label,icon])=><button key={id} onClick={()=>go(id)} className={(view===id||(id==='modules'&&view==='module')||(id==='production'&&['stops','occurrences'].includes(view)))?'active':''}>{icon}<span>{label}</span></button>)}</div></nav>
  <div className="workspace"><div className="workspace-inner"><div className="shift-toolbar simple-shift-toolbar"><div className="shift-current"><span className="shift-date-label"><Clock3 size={16}/> {formatDate(date)} · {kind==='diurno'?'Diurno (07h–19h)':'Noturno (19h–07h)'}</span><Pill text={!shift?'Sem registro':shift.status==='encerrado'?'Encerrado':isShiftEnded(shift)?'Encerramento pendente':'Em andamento'} kind={shift?.status==='encerrado'?'good':shift&&isShiftEnded(shift)?'warn':'blue'}/></div><button type="button" className="shift-edit-toggle" aria-expanded={shiftSelectorOpen} onClick={()=>setShiftSelectorOpen(v=>!v)}>{shiftSelectorOpen?'Fechar':'Alterar data / turno'} <ChevronDown size={16}/></button>{shiftSelectorOpen&&<div className="shift-controls"><label>Data de referência<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Turno<select value={kind} onChange={e=>setKind(e.target.value as 'diurno'|'noturno')}><option value="diurno">Diurno · 07h às 19h</option><option value="noturno">Noturno · 19h às 07h</option></select></label><button className="shift-current-button" type="button" onClick={goCurrent}>Ir para turno atual</button></div>}</div>
   {!selectedIsCurrent&&<button className="view-archive" onClick={goCurrent}><Archive size={16}/> Você está consultando outro turno. Clique para voltar ao turno atual. <ArrowRight size={15}/></button>}
   {loading&&!shift?<Loading/>:!shift?<div className="no-shift"><Archive size={33}/><h2>Turno sem registros</h2><p>Não há dados cadastrados para {formatDate(date)} ({kind}). Somente o turno atual pode ser iniciado e editado.</p><Button variant="outline" onClick={goCurrent}>Ir para o turno atual</Button></div>:<>
    {view==='home'&&<Dashboard profile={profile} shift={shift} data={data} images={images} onOpen={openModule} navigate={go}/>}
    {view==='modules'&&<div className="page-stack"><div className="page-title"><div><span className="eyebrow">EQUIPAMENTOS DA PLANTA</span><h1>Selecionar módulo</h1><p>Três equipamentos, com registros compartilhados por turno.</p></div><ClipboardCheck size={30}/></div><ModulesGrid data={data} onOpen={openModule} images={images}/><p className="disclaimer"><ShieldAlert size={16}/> As orientações são preliminares e exigem validação pelos procedimentos da empresa.</p></div>}
    {view==='module'&&<ModuleScreen {...screenProps} code={module} images={images}/>}
    {(['production','stops','occurrences'] as View[]).includes(view)&&<div className="page-stack"><RecordNavigation view={view} navigate={go}/>{view==='production'&&<ProductionScreen {...screenProps}/>}
    {view==='stops'&&<StopsScreen {...screenProps}/>}
    {view==='occurrences'&&<OccurrencesScreen {...screenProps}/>}</div>}
    {view==='handover'&&<HandoverScreen {...screenProps} canClose={canClose}/>}
    {view==='history'&&<HistoryScreen {...screenProps} chooseShift={chooseShift}/>}
    {view==='settings'&&<SettingsScreen {...screenProps} profile={profile} images={images} reloadImages={reloadImages}/>}
   </>}
   <footer className="page-footer"><span>PLANTA MÓVEL · VERSÃO PILOTO 3.0</span><span>{shift?`${formatDate(shift.shift_date)} · ${shiftEnd(shift.shift_date,shift.kind)}`:'Sem turno ativo'}</span></footer>
  </div></div>
  <nav className="bottom-nav" aria-label="Menu principal">{NAV.map(([id,label,icon])=><button key={id} onClick={()=>go(id)} className={view===id||(id==='modules'&&view==='module')||(id==='production'&&['stops','occurrences'].includes(view))?'active':''}>{icon}<span>{label}</span></button>)}</nav>
  {toast&&<div className={`toast ${toast.isError?'toast-error':''}`} role="status"><span>{toast.isError?<AlertTriangle size={20}/>:<CheckCircle2 size={20}/>}</span><p>{toast.text}</p><button aria-label="Dispensar aviso" onClick={()=>setToast(null)}><X size={18}/></button></div>}
 </div>;
}
export default function App(){return <Shell/>;}
