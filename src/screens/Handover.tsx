import {useEffect,useState} from 'react';
import {AlertCircle,ArrowRight,CheckCircle2,ClipboardCheck,Download,FileCheck2,LockKeyhole,Plus,ShieldAlert,Timer} from 'lucide-react';
import {CONDITIONS,MODULES} from '../lib/catalog';
import {moduleProgress} from './Modules';
import {supabase} from '../lib/supabase';
import {formatFullWhen,formatWhen,isShiftEnded,productionPeriodLabel} from '../lib/time';
import {makePdf} from '../lib/pdf';
import {Panel,Button,Empty,Pill,Photo,Stamp} from '../components/Shared';
import type {ScreenProps} from './common';
import type {Issue,HandoverNote} from '../lib/types';
import {annulRecord,RecordControls} from '../components/RecordControls';

function IssueRow({issue,canEdit,busy,action}:Pick<ScreenProps,'canEdit'|'busy'|'action'>&{issue:Issue}){
 const [nextStatus,setNextStatus]=useState(issue.status);
 const [solution,setSolution]=useState(issue.solution||'');
 useEffect(()=>{setNextStatus(issue.status);setSolution(issue.solution||'');},[issue.id,issue.status,issue.solution]);
 async function save(){await action(async()=>{
  const {data:updated,error}=await supabase.from('issues').update({status:nextStatus,solution:nextStatus==='resolvida'?solution.trim():null}).eq('id',issue.id).eq('revision',issue.revision).select('id');
  if(error)throw error;if(!updated?.length)throw new Error('Outro operador atualizou esta pendência. Confira os dados atuais.');
 },'Acompanhamento atualizado.');}
 return <article className="record issue-record">
  <div className="record-top"><strong>{issue.module_code?`${issue.module_code} · Item ${issue.item_index}`:'Ocorrência geral'}</strong><Pill text={issue.status==='aberta'?'Aberta':issue.status==='em_acompanhamento'?'Em acompanhamento':'Resolvida'} kind={issue.status==='resolvida'?'good':'bad'}/></div>
  <p>{issue.description}</p><Photo path={issue.photo_path} small/><Stamp name={issue.operator_name} date={issue.created_at}/>
  {issue.status==='resolvida'&&<p className="solution">Solução: {issue.solution} · {issue.resolved_by_name} ({formatWhen(issue.resolved_at)})</p>}
  {canEdit&&issue.status!=='resolvida'&&<div className="issue-editor"><label>Andamento<select value={nextStatus} onChange={e=>setNextStatus(e.target.value as Issue['status'])}><option value="aberta">Aberta</option><option value="em_acompanhamento">Em acompanhamento</option><option value="resolvida">Resolvida</option></select></label>
   {nextStatus==='resolvida'&&<label>Descrição da solução<textarea rows={2} value={solution} onChange={e=>setSolution(e.target.value)} placeholder="O que foi realizado para solucionar?"/></label>}
   <Button disabled={busy||(nextStatus==='resolvida'&&solution.trim().length<3)} onClick={save} variant="secondary"><CheckCircle2 size={15}/> Atualizar pendência</Button></div>}
 </article>;
}
export function HandoverScreen(props:ScreenProps&{canClose:boolean}){
 const {shift,data,canEdit,canClose,busy,action,navigate}=props;
 const [note,setNote]=useState('');const [editNote,setEditNote]=useState<HandoverNote|null>(null);const [closeNote,setCloseNote]=useState('');const [mode,setMode]=useState<'mantidas'|'alteradas'>('mantidas');
 const [changesConfirmed,setChangesConfirmed]=useState(false);const [lateReason,setLateReason]=useState('');const [showConfirm,setShowConfirm]=useState(false);
 useEffect(()=>{setNote('');setEditNote(null);setCloseNote('');setMode('mantidas');setChangesConfirmed(false);setLateReason('');setShowConfirm(false);},[shift.id]);
 const overdue=isShiftEnded(shift)&&shift.status==='aberto';
 const issues=data.issues.filter(i=>i.status!=='resolvida');
 const incomplete=MODULES.filter(m=>{const p=moduleProgress(m.code,data);return p.done<p.total;});
 async function saveNote(){const okay=await action(async()=>{
  if(editNote){const {data:updated,error}=await supabase.from('handover_notes').update({body:note.trim()}).eq('id',editNote.id).eq('revision',editNote.revision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Registro alterado por outra pessoa. Atualize antes de salvar.');}
  else{const {error}=await supabase.from('handover_notes').insert({shift_id:shift.id,body:note.trim()});if(error)throw error;}
 },editNote?'Observação de passagem editada.':'Observação de passagem registrada.');if(okay){setNote('');setEditNote(null);}}
 async function close(){const success=await action(async()=>{
  const {error}=await supabase.rpc('close_shift',{p_shift_id:shift.id,p_final_condition:mode,p_notes:closeNote.trim(),p_changes_confirmed:changesConfirmed,p_late_reason:overdue?lateReason.trim():null});
  if(error)throw error;
 },'Passagem de turno finalizada.');if(success)setShowConfirm(false);}
 return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">CONTINUIDADE OPERACIONAL</span><h1>Passagem de turno</h1><p>Resumo automático com registros compartilhados da equipe.</p></div><FileCheck2 size={32}/></div>
  <div className="actions-banner"><div><strong>{shift.status==='encerrado'?'Turno encerrado':overdue?'Encerramento pendente':'Turno em andamento'}</strong><p>{shift.status==='encerrado'?`Finalizado por ${shift.closed_by_name}, em ${formatFullWhen(shift.closed_at)}.`:overdue?'O próximo turno pode trabalhar normalmente. Um participante pode encerrar este com justificativa.':'As informações abaixo são atualizadas durante o turno.'}</p></div><Button variant="outline" onClick={()=>makePdf(shift,data)}><Download size={16}/> Baixar PDF {shift.status==='aberto'?'parcial':''}</Button></div>
  <Panel title="Condição dos módulos" sub="Situação informada pela equipe, não é uma autorização de liberação.">
   <div className="status-grid">{MODULES.map(m=>{const st=data.states.find(s=>s.module_code===m.code);const a=data.answers.filter(x=>x.module_code===m.code);const h=data.meters.filter(x=>x.module_code===m.code).sort((x,y)=>y.created_at.localeCompare(x.created_at));const start=h.find(x=>x.reading_type==='inicial'),end=h.find(x=>x.reading_type==='final');return <div className="status-item" key={m.code}><strong>{m.code}</strong><span>{CONDITIONS.find(x=>x.value===st?.condition)?.label||'Condição não informada'}</span><small>Checklist: {a.length} item(ns) respondido(s)</small><small>Horímetro: {start?.value??'—'} → {end?.value??'—'}</small></div>;})}</div>
  </Panel>
  <div className="two-col"><Panel title="Produção" sub="Materiais e atividades registrados.">{data.production.length?<div className="record-list compact">{data.production.map(x=><div className="record" key={x.id}><div className="record-top"><strong>{x.material==='Outro'?x.other_material:x.material}</strong><span>{x.tonnage===null?'—':`${x.tonnage} t`}</span></div><p className="muted">{x.modules.join(' · ')}</p><p className="muted">{productionPeriodLabel(x.starts_at,x.ends_at)}</p></div>)}</div>:<Empty text="Sem informação de produção."/>}</Panel>
   <Panel title="Paradas e ocorrências" sub="Registros importantes realizados no turno."><div className="record-list compact">{[...data.stops.map(s=>({id:s.id,title:`Parada · ${s.affected}`,desc:s.reason,time:s.created_at})),...data.occurrences.map(o=>({id:o.id,title:`Ocorrência · ${o.category}`,desc:o.description,time:o.happened_at}))].sort((a,b)=>b.time.localeCompare(a.time)).map(x=><div className="record" key={x.id}><strong>{x.title}</strong><p>{x.desc}</p><Stamp date={x.time}/></div>)}{!data.stops.length&&!data.occurrences.length&&<Empty text="Sem registros de parada ou ocorrência."/>}</div></Panel></div>
  <Panel title={`Pendências abertas (${issues.length})`} sub="Inclui pendências de turnos anteriores ainda não resolvidas.">
   {issues.length?<div className="record-list">{issues.map(i=><IssueRow key={i.id} issue={i} canEdit={canEdit} busy={busy} action={action}/>)}</div>:<div className="positive-empty"><CheckCircle2 size={18}/> Nenhuma pendência em aberto.</div>}
  </Panel>
  <Panel title="Observações para a equipe seguinte" sub="Mensagens independentes, com autor e horário.">
   {canEdit&&<div className="form-stack"><textarea rows={3} placeholder="Informação relevante para quem assumir o próximo turno..." value={note} onChange={e=>setNote(e.target.value)}/><Button onClick={saveNote} disabled={busy||note.trim().length<3}><Plus size={16}/> {editNote?"Salvar edição":"Adicionar observação"}</Button>{editNote&&<Button variant="outline" onClick={()=>{setEditNote(null);setNote('');}}>Cancelar</Button>}</div>}
   {data.handoverNotes.length?<div className="record-list">{data.handoverNotes.map(n=><div key={n.id} className="record"><p>{n.body}</p><Stamp name={n.operator_name} date={n.created_at}/><RecordControls canEdit={canEdit} busy={busy} edited={n.edited} onEdit={()=>{setEditNote(n);setNote(n.body);}} onAnnul={()=>{void annulRecord("handover_notes",n.id,n.revision,action).then(ok=>{if(ok&&editNote?.id===n.id){setEditNote(null);setNote('');}});}}/></div>)}</div>:<Empty text="Nenhuma observação de passagem registrada."/>}
  </Panel>
  {shift.status==='encerrado'?<Panel title="Encerramento registrado"><div className="closed-info"><LockKeyhole size={22}/><div><strong>Turno finalizado</strong><p>{shift.closed_by_name} · {formatFullWhen(shift.closed_at)}</p><p>Condições finais: {shift.final_condition==='alteradas'?'Alteradas':'Mantidas'}</p>{shift.close_notes&&<p>Observações finais: {shift.close_notes}</p>}{shift.late_reason&&<p>Justificativa tardia: {shift.late_reason}</p>}</div></div></Panel>:
  <Panel title="Inspeção final e encerramento" sub="Apenas um operador participante pode finalizar este turno; o fechamento é irreversível para registros comuns.">
   {incomplete.length>0&&<div className="warning-panel"><ShieldAlert size={20}/><div><strong>Checklists ainda incompletos: {incomplete.map(x=>x.code).join(', ')}</strong><p>Confira as verificações aplicáveis e registre justificativas para itens não verificados. Não trate este resumo como liberação operacional.</p></div></div>}
   {canClose?<><div className="choice-grid"><label className={`choice-card ${mode==='mantidas'?'chosen':''}`}><input type="radio" checked={mode==='mantidas'} onChange={()=>setMode('mantidas')}/> <CheckCircle2 size={19}/> Condições mantidas</label><label className={`choice-card ${mode==='alteradas'?'chosen':''}`}><input type="radio" checked={mode==='alteradas'} onChange={()=>setMode('alteradas')}/> <AlertCircle size={19}/> Condições alteradas</label></div>
    {mode==='alteradas'&&<div className="warning-panel"><ShieldAlert size={20}/><div><strong>Atualize os itens modificados.</strong><p>Registre as alterações nos checklists correspondentes antes de encerrar. O servidor verifica se houve atualização de checklist no turno.</p><div className="inline-actions">{MODULES.map(m=><button key={m.code} className="small-link" onClick={()=>navigate('modules')}>{m.code} <ArrowRight size={13}/></button>)}</div><label className="check-inline"><input type="checkbox" checked={changesConfirmed} onChange={e=>setChangesConfirmed(e.target.checked)}/> Confirmo que as alterações foram registradas</label></div></div>}
    <label>Observação final (opcional)<textarea rows={3} value={closeNote} onChange={e=>setCloseNote(e.target.value)} placeholder="Orientação final para a equipe seguinte..."/></label>
    {overdue&&<label>Justificativa do encerramento tardio (obrigatória)<textarea rows={3} value={lateReason} onChange={e=>setLateReason(e.target.value)} placeholder="Explique por que o turno não foi encerrado no horário..."/></label>}
    {!showConfirm?<Button disabled={busy||(mode==='alteradas'&&!changesConfirmed)||(overdue&&lateReason.trim().length<5)} onClick={()=>setShowConfirm(true)}><ClipboardCheck size={16}/> Revisar e finalizar passagem</Button>:
    <div className="confirm-box"><strong>Confirma o encerramento definitivo deste turno?</strong><p>Os registros comuns serão bloqueados. Pendências em aberto continuarão no próximo turno.</p><div className="action-row"><Button onClick={close} disabled={busy} variant="danger"><LockKeyhole size={16}/> Sim, encerrar turno</Button><Button variant="outline" onClick={()=>setShowConfirm(false)}>Cancelar</Button></div></div>}</>:
    <p className="info-line"><Timer size={17}/> Somente um participante deste turno pode fazer o encerramento. O histórico continua disponível para consulta.</p>}
  </Panel>}
 </div>;
}
