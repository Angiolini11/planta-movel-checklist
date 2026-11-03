import {useEffect,useState} from 'react';
import {AlertTriangle,ArrowLeft,ArrowRight,CheckCircle2,ClipboardCheck,FileClock,Info,Plus,Save,ShieldAlert,Timer,Upload} from 'lucide-react';
import {ANSWERS,CONDITIONS,MODULES,QUESTIONS,type ModuleCode} from '../lib/catalog';
import {supabase,uploadPhoto} from '../lib/supabase';
import {Panel,Pill,Photo,Stamp,Empty,Button} from '../components/Shared';
import {formatWhen} from '../lib/time';
import type {ScreenProps} from './common';
import type {Hourmeter,ModuleNote} from '../lib/types';
import {annulRecord,RecordControls} from '../components/RecordControls';

export function moduleProgress(code:ModuleCode,data:ScreenProps['data']){
 const state=data.states.find(s=>s.module_code===code);
 const indexes=state&&state.condition!=='em_operacao'?[1,2,8]:[1,2,3,4,5,6,7,8];
 const done=indexes.filter(i=>data.answers.some(a=>a.module_code===code&&a.item_index===i)).length;
 const open=data.issues.filter(i=>i.module_code===code&&i.status!=='resolvida').length;
 return {done,total:indexes.length,open,state};
}
export function ModulesGrid({data,onOpen,images}:{data:ScreenProps['data'];onOpen:(code:ModuleCode)=>void;images:Record<string,string>}){
 return <div className="module-grid">{MODULES.map(m=>{
  const progress=moduleProgress(m.code,data);const pct=Math.round(progress.done/progress.total*100);
  return <button key={m.code} className="module-card" onClick={()=>onOpen(m.code)}>
   <div className="module-photo"><img src={images[m.code]||`${import.meta.env.BASE_URL}${m.image}`} alt={`Imagem do equipamento ${m.code}`}/><span className="code-label">{m.code}</span></div>
   <div className="module-card-body"><div className="module-top"><div><span className="eyebrow">MÓDULO {m.code}</span><h3>{m.title}</h3></div><ArrowRight size={19}/></div>
    <div className="module-card-row"><Pill text={progress.state?CONDITIONS.find(x=>x.value===progress.state?.condition)?.label||'—':'Condição não definida'} kind={progress.state?.condition==='em_operacao'?'good':'neutral'}/>
    {progress.open>0&&<span className="issue-count"><AlertTriangle size={13}/>{progress.open}</span>}</div>
    <div className="progress-label"><span>Checklist</span><strong>{progress.done}/{progress.total}</strong></div><div className="progress-track"><div style={{width:`${pct}%`}}/></div>
    <div className="module-bottom">Abrir checklist <ArrowRight size={15}/></div>
   </div></button>;
 })}</div>;
}

type Draft={status:string;detail:string;photo:File|null;baseRevision:number|null};
export function ModuleScreen({code,images,...props}:ScreenProps&{code:ModuleCode;images:Record<string,string>}){
 const {shift,data,canEdit,busy,action,navigate}=props;
 const m=MODULES.find(x=>x.code===code)!;
 const state=data.states.find(x=>x.module_code===code);
 const [condition,setCondition]=useState(state?.condition||'');
 const [conditionReason,setConditionReason]=useState(state?.reason||'');
 const [conditionEdited,setConditionEdited]=useState(false);
 const [conditionBaseRevision,setConditionBaseRevision]=useState<number|null>(null);
 const [drafts,setDrafts]=useState<Record<number,Draft>>({});
 const [note,setNote]=useState('');
 const [editNote,setEditNote]=useState<ModuleNote|null>(null);
 const [editMeter,setEditMeter]=useState<Hourmeter|null>(null);
 const [meterType,setMeterType]=useState<'inicial'|'final'>('inicial');
 const [meterValue,setMeterValue]=useState('');
 useEffect(()=>{setCondition(state?.condition||'');setConditionReason(state?.reason||'');setConditionEdited(false);setConditionBaseRevision(null);setDrafts({});setNote('');setEditMeter(null);setEditNote(null);},[code,shift.id]);
 useEffect(()=>{if(!conditionEdited){setCondition(state?.condition||'');setConditionReason(state?.reason||'');}},[state?.revision,state?.id,state?.condition,state?.reason,conditionEdited]);
 function changeConditionDraft(field:'condition'|'reason',value:string){
  if(!conditionEdited){setConditionBaseRevision(state?.revision??null);setConditionEdited(true);}
  if(field==='condition')setCondition(value);else setConditionReason(value);
 }
 const applicable=state&&state.condition!=='em_operacao'?[1,2,8]:[1,2,3,4,5,6,7,8];
 const responses=data.answers.filter(r=>r.module_code===code);
 const answered=applicable.filter(n=>responses.some(r=>r.item_index===n)).length;
 const progress=moduleProgress(code,data);
 const meters=data.meters.filter(r=>r.module_code===code).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const initial=meters.find(x=>x.reading_type==='inicial');const final=meters.find(x=>x.reading_type==='final');
 const diff=initial&&final?Number(final.value)-Number(initial.value):null;
 function edit(index:number,partial:Partial<Draft>){
  const existing=responses.find(r=>r.item_index===index);
  setDrafts(old=>{
   const current:Draft=old[index]??{
    status:existing?.status||'',
    detail:existing?.detail||'',
    photo:null,
    baseRevision:existing?.revision??null
   };
   return {...old,[index]:{...current,...partial}};
  });
 }
 async function saveCondition(){
  if(!condition) return;
  if(condition!=='em_operacao'&&conditionReason.trim().length<3)return;
  const okay=await action(async()=>{
    if((state?.revision??null)!==conditionBaseRevision)throw new Error('Outro operador mudou a condição do equipamento. Confira os dados atualizados antes de repetir.');
    const values={condition,reason:condition==='em_operacao'?null:conditionReason.trim()};
    if(state){const {data:updated,error}=await supabase.from('module_states').update(values).eq('id',state.id).eq('revision',state.revision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Outro operador modificou essa condição. Atualize e confira antes de salvar.');}
    else{const {error}=await supabase.from('module_states').insert({...values,shift_id:shift.id,module_code:code});if(error)throw error;}
  },'Condição do equipamento atualizada.');
  if(okay){setConditionEdited(false);setConditionBaseRevision(null);}
 }
 async function saveAnswer(index:number,status:string,detail:string,photo:File|null,baseRevision:number|null){
  if(!canEdit||!state||!status)return;
  if(status!=='conforme'&&detail.trim().length<3)return;
  const okay=await action(async()=>{
    const old=responses.find(r=>r.item_index===index);
    if((old?.revision??null)!==baseRevision)throw new Error('A resposta mudou desde que você começou a editar. Confira os dados atualizados.');
    const path=photo?await uploadPhoto(photo,'anomalies'):old?.photo_path||null;
    const values={status,detail:status==='conforme'?null:detail.trim(),photo_path:status==='anomalia'?path:null};
    if(old){const {data:updated,error}=await supabase.from('checklist_responses').update(values).eq('id',old.id).eq('revision',baseRevision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Conflito: outra pessoa alterou esta resposta. Confira os dados antes de repetir.');}
    else{const {error}=await supabase.from('checklist_responses').insert({...values,shift_id:shift.id,module_code:code,item_index:index});if(error)throw error;}
  },`Item ${index} salvo.`);
  if(okay)setDrafts(prev=>{const next={...prev};delete next[index];return next;});
 }
 async function saveMeter(){
  const parsed=Number(meterValue.replace(',','.'));
  if(!meterValue.trim()||!Number.isFinite(parsed)||parsed<0)return;
  if(meterType==='final'&&initial&&parsed<Number(initial.value))return;
  if(meterType==='inicial'&&final&&Number(final.value)<parsed)return;
  const ok=await action(async()=>{
   if(editMeter){const {data:updated,error}=await supabase.from('hourmeter_readings').update({value:parsed}).eq('id',editMeter.id).eq('revision',editMeter.revision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Horímetro alterado por outro operador. Atualize antes de editar.');}
   else{const {error}=await supabase.from('hourmeter_readings').insert({shift_id:shift.id,module_code:code,reading_type:meterType,value:parsed});if(error)throw error;}
  },editMeter?'Leitura corrigida.':'Leitura registrada.');
  if(ok){setMeterValue('');setEditMeter(null);}
 }
 async function saveNote(){
  if(note.trim().length<3)return;
  const ok=await action(async()=>{
   if(editNote){const {data:updated,error}=await supabase.from('module_notes').update({body:note.trim()}).eq('id',editNote.id).eq('revision',editNote.revision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Observação alterada por outra pessoa. Atualize antes de editar.');}
   else{const {error}=await supabase.from('module_notes').insert({shift_id:shift.id,module_code:code,body:note.trim()});if(error)throw error;}
  },editNote?'Observação editada.':'Observação adicionada.');
  if(ok){setNote('');setEditNote(null);}
 }
 return <div className="page-stack">
  <button className="back-link" onClick={()=>navigate('modules')}><ArrowLeft size={16}/> Voltar aos módulos</button>
  <div className="module-detail-hero"><img src={images[code]||`${import.meta.env.BASE_URL}${m.image}`} alt={m.title}/><div><span className="eyebrow">CHECKLIST DE EQUIPAMENTO</span><h1>{code}</h1><p>{m.title}</p><div className="detail-hero-pills"><Pill text={`${answered}/${applicable.length} verificados`} kind={answered===applicable.length?'good':'neutral'}/>{progress.open>0&&<Pill text={`${progress.open} pendência(s)`} kind="bad"/>}</div></div></div>
  <Panel title="Condição do módulo" sub="Defina antes de preencher. A situação atual será exibida para a equipe.">
   <div className="form-grid"><label>Condição operacional<select value={condition} disabled={!canEdit||busy} onChange={e=>changeConditionDraft('condition',e.target.value)}><option value="">Selecione a condição</option>{CONDITIONS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
   {condition&&condition!=='em_operacao'&&<label>Justificativa obrigatória<input value={conditionReason} onChange={e=>changeConditionDraft('reason',e.target.value)} placeholder="Explique a condição do equipamento" disabled={!canEdit}/></label>}</div>
   {canEdit&&<Button onClick={saveCondition} disabled={busy||!conditionEdited||!condition||(condition!=='em_operacao'&&conditionReason.trim().length<3)} variant="secondary"><Save size={16}/> Salvar condição</Button>}
   {state&&<div className="tiny-separator"><Stamp name={state.updated_by_name} date={state.updated_at}/></div>}
   {state&&state.condition!=='em_operacao'&&<p className="info-line"><Info size={16}/> Checklist adaptado. As verificações de segurança aplicáveis continuam visíveis. Caso o módulo volte a operar, registre a mudança e faça as verificações exigidas antes do uso.</p>}
  </Panel>
  <Panel title="Inspeção do módulo" sub="As orientações são preliminares; siga os procedimentos e bloqueios da empresa." aside={<strong className="counter">{answered}/{applicable.length}</strong>}>
   <div className="progress-track large"><div style={{width:`${Math.round(answered/applicable.length*100)}%`}}/></div>
   {!state&&<p className="info-line"><ShieldAlert size={16}/> Registre a condição do equipamento para ajustar as verificações aplicáveis.</p>}
   <div className="question-list">{QUESTIONS[code].filter((_,i)=>applicable.includes(i+1)).map((q,j)=>{
    const i=QUESTIONS[code].indexOf(q)+1;
    const saved=responses.find(a=>a.item_index===i);
    const d=drafts[i];const val=d?.status??saved?.status??'';const detail=d?.detail??saved?.detail??'';
    return <article key={i} className={`question-card ${val==='anomalia'?'question-alert':''}`}>
     <div className="question-head"><span className="question-number">{String(i).padStart(2,'0')}</span><div className="question-title"><h3>{q.title}</h3><details className="tip"><summary><Info size={14}/> O que verificar</summary><p>{q.help}</p></details></div>{saved&&<CheckCircle2 className="saved-icon" size={17}/>}</div>
     <div className="answer-grid">{ANSWERS.map(opt=><button key={opt.value} type="button" disabled={!canEdit||busy||!state} className={`answer-btn answer-${opt.value} ${val===opt.value?'selected':''}`} onClick={()=>{
       const base=d?.baseRevision??saved?.revision??null;
       edit(i,{status:opt.value,baseRevision:base});
       if(opt.value==='conforme')void saveAnswer(i,'conforme','',null,base);
     }}>{opt.label}</button>)}</div>
     {val&&val!=='conforme'&&<div className="answer-detail"><label>{val==='anomalia'?'Descrição obrigatória da anomalia':'Justificativa obrigatória'}<textarea rows={2} disabled={!canEdit} placeholder="Descreva de forma objetiva..." value={detail} onChange={e=>edit(i,{detail:e.target.value})}/></label>
      {val==='anomalia'&&<><label className="file-label"><Upload size={15}/> {d?.photo?.name||'Adicionar fotografia (opcional)'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!canEdit} onChange={e=>edit(i,{photo:e.target.files?.[0]||null})}/></label>{saved?.photo_path&&<Photo path={saved.photo_path} small/>}</>}
      {canEdit&&<Button disabled={busy||detail.trim().length<3} onClick={()=>saveAnswer(i,val,detail,d?.photo||null,d?.baseRevision??saved?.revision??null)}><Save size={15}/> Salvar resposta</Button>}</div>}
     {saved&&<div className="question-foot"><Stamp date={saved.updated_at}/>{saved.revision>1&&<span className="edit-flag">Editado</span>}{canEdit&&<button type="button" className="small-link" onClick={()=>{void annulRecord('checklist_responses',saved.id,saved.revision,action).then(ok=>{if(ok)setDrafts(old=>{const next={...old};delete next[i];return next;});});}}>Anular resposta</button>}</div>}
    </article>;
   })}</div>
   <p className="safety-note"><ShieldAlert size={16}/> O checklist registra observações. Não significa liberação operacional nem substitui os procedimentos internos de segurança.</p>
  </Panel>
  <div className="two-col">
   <Panel title="Horímetros" sub="É possível corrigir ou anular leituras do turno ainda aberto.">
    <div className="meter-summary"><div><span>Inicial</span><strong>{initial?Number(initial.value).toLocaleString('pt-BR'):'—'}</strong></div><div><span>Final</span><strong>{final?Number(final.value).toLocaleString('pt-BR'):'—'}</strong></div><div><span>Diferença</span><strong className={diff!==null&&diff<0?'text-danger':''}>{diff===null?'—':diff<0?'Inválida':diff.toLocaleString('pt-BR',{maximumFractionDigits:2})+' h'}</strong></div></div>
    {canEdit&&<div className="meter-form"><label>Leitura<select disabled={!!editMeter} value={meterType} onChange={e=>setMeterType(e.target.value as 'inicial'|'final')}><option value="inicial">Inicial</option><option value="final">Final</option></select></label><label>Valor<input inputMode="decimal" placeholder="Ex.: 4580,5" value={meterValue} onChange={e=>setMeterValue(e.target.value)}/></label>
    <Button disabled={busy||!meterValue||!Number.isFinite(Number(meterValue.replace(',','.')))||Number(meterValue.replace(',','.'))<0} onClick={saveMeter}><Timer size={16}/> {editMeter?"Salvar edição":"Registrar"}</Button>{editMeter&&<Button variant="outline" onClick={()=>{setEditMeter(null);setMeterValue('');}}>Cancelar</Button>}</div>}
    {initial&&final&&diff!==null&&diff<0&&<p className="error-box">Horímetro final menor que o inicial. Confira as leituras.</p>}
    <div className="record-list compact">{meters.map(r=><div className="record" key={r.id}><div><strong>{r.reading_type==='inicial'?'Inicial':'Final'}: {Number(r.value).toLocaleString('pt-BR')}</strong><Stamp name={r.operator_name} date={r.created_at}/></div><RecordControls canEdit={canEdit} busy={busy} edited={r.edited} onEdit={()=>{setEditMeter(r);setMeterType(r.reading_type);setMeterValue(String(r.value));}} onAnnul={()=>{void annulRecord("hourmeter_readings",r.id,r.revision,action).then(ok=>{if(ok&&editMeter?.id===r.id){setEditMeter(null);setMeterValue('');}});}}/></div>)}</div>
   </Panel>
   <Panel title="Observações gerais" sub="Cada observação é independente e não substitui as anteriores.">
    {canEdit&&<div className="form-stack"><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Observação opcional sobre este módulo..."/><Button disabled={busy||note.trim().length<3} onClick={saveNote}><Plus size={15}/> {editNote?"Salvar edição":"Adicionar observação"}</Button>{editNote&&<Button variant="outline" onClick={()=>{setEditNote(null);setNote('');}}>Cancelar</Button>}</div>}
    <div className="record-list">{data.moduleNotes.filter(n=>n.module_code===code).length?data.moduleNotes.filter(n=>n.module_code===code).map(n=><div className="record" key={n.id}><p>{n.body}</p><Stamp name={n.operator_name} date={n.created_at}/><RecordControls canEdit={canEdit} busy={busy} edited={n.edited} onEdit={()=>{setEditNote(n);setNote(n.body);}} onAnnul={()=>{void annulRecord("module_notes",n.id,n.revision,action).then(ok=>{if(ok&&editNote?.id===n.id){setEditNote(null);setNote('');}});}}/></div>):<Empty text="Nenhuma observação neste módulo."/>}</div>
   </Panel>
  </div>
  <Panel title="Pendências deste módulo" sub="Resolução exige descrição e permanece no histórico.">
   {data.issues.filter(i=>i.module_code===code).length?data.issues.filter(i=>i.module_code===code).map(i=><div className="record" key={i.id}><div className="record-top"><strong>Item {i.item_index} · {i.status==='resolvida'?'Resolvida':i.status==='aberta'?'Aberta':'Em acompanhamento'}</strong><Pill text={i.status.replaceAll('_',' ')} kind={i.status==='resolvida'?'good':'bad'}/></div><p>{i.description}</p><Stamp name={i.operator_name} date={i.created_at}/>{i.solution&&<p className="solution">Solução: {i.solution}</p>}</div>):<Empty text="Nenhuma anomalia registrada para este módulo."/>}
  </Panel>
  <div className="action-row"><Button variant="outline" onClick={()=>navigate('modules')}><ArrowLeft size={15}/> Voltar</Button><Button variant="secondary" onClick={()=>navigate('handover')}><FileClock size={16}/> Passagem de turno <ArrowRight size={15}/></Button></div>
 </div>;
}
