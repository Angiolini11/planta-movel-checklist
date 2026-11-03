import {useEffect,useState} from 'react';
import {Camera,Clock3,Plus,Save,Upload} from 'lucide-react';
import {MATERIALS,MODULES,OCCURRENCE_CATEGORIES,STOP_REASONS,type ModuleCode} from '../lib/catalog';
import {supabase,uploadPhoto} from '../lib/supabase';
import {displayDuration,durationMins,formatWhen,productionPeriodError,productionPeriodLabel,spInputNow,spInputToISO,spParts} from '../lib/time';
import {Panel,Button,Empty,Pill,Photo,Stamp} from '../components/Shared';
import type {ScreenProps} from './common';
import type {Downtime,ProductionRecord,Occurrence} from '../lib/types';
import {annulRecord,RecordControls} from '../components/RecordControls';

export function ProductionScreen(props:ScreenProps){
 const {shift,data,canEdit,busy,action}=props;
 const [edit,setEdit]=useState<ProductionRecord|null>(null);
 const [material,setMaterial]=useState('Hematita Bocaina');const [other,setOther]=useState('');
 const [modules,setModules]=useState<ModuleCode[]>(['QA452']);const [tonnage,setTonnage]=useState('');const [notes,setNotes]=useState('');
 const [productionStart,setProductionStart]=useState('');const [productionEnd,setProductionEnd]=useState('');
 function reset(){setEdit(null);setMaterial('Hematita Bocaina');setOther('');setModules(['QA452']);setTonnage('');setNotes('');setProductionStart('');setProductionEnd('');}
 useEffect(reset,[shift.id]);
 function editRecord(p:ProductionRecord){setEdit(p);setMaterial(p.material);setOther(p.other_material||'');setModules(p.modules);setTonnage(p.tonnage===null?'':String(p.tonnage));setNotes(p.notes||'');setProductionStart(toSPInput(p.starts_at));setProductionEnd(toSPInput(p.ends_at));window.scrollTo({top:0,behavior:'smooth'});}
 const badTonnage=tonnage.trim()!==''&&(!Number.isFinite(Number(tonnage.replace(',','.')))||Number(tonnage.replace(',','.'))<0);
 const startISO=spInputToISO(productionStart),endISO=spInputToISO(productionEnd);
 const periodError=(productionStart&&!startISO)||(productionEnd&&!endISO)?'Informe uma data e um horário válidos.':productionPeriodError(startISO,endISO,shift);
 const productionMinutes=durationMins(startISO,endISO);
 async function save(){
  const ok=await action(async()=>{
    const values={material,other_material:material==='Outro'?other.trim():null,modules,
    tonnage:tonnage.trim()===''?null:Number(tonnage.replace(',','.')),notes:notes.trim()||null,starts_at:startISO,ends_at:endISO};
    if(edit){const {data:updated,error}=await supabase.from('production_records').update(values).eq('id',edit.id).eq('revision',edit.revision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Registro modificado por outra pessoa. Atualize antes de editar.');}
    else{const {error}=await supabase.from('production_records').insert({...values,shift_id:shift.id});if(error)throw error;}
  },edit?'Produção atualizada.':'Atividade de produção registrada.');
  if(ok)reset();
 }
 const total=data.production.reduce((s,r)=>s+(r.tonnage===null?0:Number(r.tonnage)),0);
 const count=data.production.filter(r=>r.tonnage!==null).length;
 return <div className="page-stack">
  <div className="stats-row"><div className="stat-card"><span>Registros no turno</span><strong>{data.production.length}</strong></div><div className="stat-card"><span>Tonelagem informada</span><strong>{total.toLocaleString('pt-BR',{maximumFractionDigits:2})} t</strong><small>{count} registro(s) com tonelagem</small></div></div>
  {canEdit&&<Panel title={edit?"Editar atividade":"Nova atividade"} sub="A tonelagem é opcional: deixe em branco quando indisponível; use 0 quando for realmente zero.">
    <div className="form-grid"><label>Material processado<select value={material} onChange={e=>setMaterial(e.target.value)}>{MATERIALS.map(x=><option key={x}>{x}</option>)}</select></label>
    {material==='Outro'&&<label>Nome do material<input value={other} onChange={e=>setOther(e.target.value)} placeholder="Informe o material"/></label>}
    <label>Tonelagem produzida (t) · opcional<input inputMode="decimal" value={tonnage} onChange={e=>setTonnage(e.target.value)} placeholder="Ex.: 320,5 ou deixar vazio"/>{badTonnage&&<span className="field-error">Informe um número positivo ou zero.</span>}</label></div>
    <div className="form-grid production-times">
     <label>Início da produção · opcional<input type="datetime-local" value={productionStart} onChange={e=>setProductionStart(e.target.value)}/></label>
     <label>Término da produção · opcional<input type="datetime-local" value={productionEnd} onChange={e=>setProductionEnd(e.target.value)}/></label>
    </div>
    <p className="muted production-times-hint">Para uma atividade em andamento, registre apenas o início e complete o término depois. Se passar da meia-noite, escolha a data seguinte.</p>
    {periodError&&<p className="error-box">{periodError}</p>}
    {!periodError&&startISO&&endISO&&productionMinutes!==null&&<p className="info-line"><Clock3 size={16}/> Duração da atividade: <strong>{displayDuration(productionMinutes)}</strong></p>}
    <fieldset className="module-picker"><legend>Módulos utilizados</legend>{MODULES.map(m=><label key={m.code} className="check-tile"><input type="checkbox" checked={modules.includes(m.code)} onChange={e=>setModules(old=>e.target.checked?[...old,m.code]:old.filter(x=>x!==m.code))}/><span>{m.code}</span><small>{m.title}</small></label>)}</fieldset>
    <label>Observações (opcional)<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Descrição da atividade, material ou operação..."/></label>
    <div className="action-row"><Button disabled={busy||badTonnage||!!periodError||!modules.length||(material==='Outro'&&other.trim().length<2)} onClick={save}><Plus size={17}/> {edit?"Salvar edição":"Registrar atividade"}</Button>{edit&&<Button variant="outline" onClick={reset}>Cancelar</Button>}</div>
   </Panel>}
  <Panel title="Produção registrada" sub="Registros individuais identificados por operador e horário.">
   {data.production.length? <div className="record-list">{data.production.map(p=><article key={p.id} className="record"><div className="record-top"><strong>{p.material==='Outro'?p.other_material:p.material}</strong><Pill text={p.tonnage===null?'Tonelagem não informada':`${Number(p.tonnage).toLocaleString('pt-BR')} t`} kind="neutral"/></div><p className="muted">Equipamentos: {p.modules.join(' · ')}</p><p className="muted">Período: {productionPeriodLabel(p.starts_at,p.ends_at)}{p.starts_at&&p.ends_at?` · ${displayDuration(durationMins(p.starts_at,p.ends_at))}`:''}</p>{p.notes&&<p>{p.notes}</p>}<Stamp name={p.operator_name} date={p.created_at}/><RecordControls canEdit={canEdit} busy={busy} edited={p.edited} onEdit={()=>editRecord(p)} onAnnul={()=>{void annulRecord("production_records",p.id,p.revision,action);}}/></article>)}</div>:<Empty text="Nenhuma atividade de produção registrada."/>}
  </Panel>
 </div>;
}
function toSPInput(iso:string|null){if(!iso)return '';const p=spParts(new Date(iso));return `${p.year}-${p.month}-${p.day}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;}
export function StopsScreen(props:ScreenProps){
 const {shift,data,canEdit,busy,action}=props;
 const [edit,setEdit]=useState<Downtime|null>(null);
 const [affected,setAffected]=useState('Planta inteira');const [reason,setReason]=useState(STOP_REASONS[0]);
 const [start,setStart]=useState('');const [end,setEnd]=useState('');const [notes,setNotes]=useState('');
 function reset(){setEdit(null);setAffected('Planta inteira');setReason(STOP_REASONS[0]);setStart('');setEnd('');setNotes('');}
 useEffect(reset,[shift.id]);
 const startISO=spInputToISO(start),endISO=spInputToISO(end);
 const mins=durationMins(startISO,endISO);const invalid=!!start&&!!end&&mins===null;
 async function save(){const ok=await action(async()=>{
   const values={affected,reason,starts_at:startISO,ends_at:endISO,notes:notes.trim()||null};
   if(edit){const {data:updated,error}=await supabase.from('downtime_records').update(values).eq('id',edit.id).eq('revision',edit.revision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Outro operador alterou esta parada. Atualize os dados e confira antes de salvar.');}
   else{const {error}=await supabase.from('downtime_records').insert({...values,shift_id:shift.id});if(error)throw error;}
  },edit?'Parada editada.':'Parada registrada.');if(ok)reset();}
 function editRecord(s:Downtime){setEdit(s);setAffected(s.affected);setReason(s.reason);setStart(toSPInput(s.starts_at));setEnd(toSPInput(s.ends_at));setNotes(s.notes||'');window.scrollTo({top:0,behavior:'smooth'});}
 return <div className="page-stack">
  {canEdit&&<Panel title={edit?'Complementar parada':'Registrar parada'} sub="Os horários são opcionais. Se atravessar meia-noite, selecione a data seguinte para o término.">
   <div className="form-grid"><label>Módulo afetado<select value={affected} onChange={e=>setAffected(e.target.value)}><option>Planta inteira</option>{MODULES.map(m=><option key={m.code}>{m.code}</option>)}</select></label>
    <label>Motivo<select value={reason} onChange={e=>setReason(e.target.value)}>{STOP_REASONS.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Início · opcional<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Fim · opcional<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
   {invalid&&<p className="error-box">Fim anterior ao início. Se a parada atravessou a meia-noite, informe a data correta do término.</p>}
   {!!start&&!!end&&mins!==null&&<p className="info-line"><Clock3 size={16}/> Duração calculada: <strong>{displayDuration(mins)}</strong></p>}
   <label>Observações<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalhes adicionais..."/></label>
   <div className="action-row"><Button onClick={save} disabled={busy||invalid||!reason.trim()}><Save size={16}/> {edit?'Salvar complementação':'Registrar parada'}</Button>{edit&&<Button variant="outline" onClick={reset}>Cancelar edição</Button>}</div>
  </Panel>}
  <Panel title="Paradas registradas" sub="Somente os registros atuais aparecem nesta lista.">
   {data.stops.length?<div className="record-list">{data.stops.map(s=><article key={s.id} className="record"><div className="record-top"><strong>{s.affected} · {s.reason}</strong><Pill text={displayDuration(durationMins(s.starts_at,s.ends_at))}/></div><p className="muted">Início: {formatWhen(s.starts_at)} · Fim: {formatWhen(s.ends_at)}</p>{s.notes&&<p>{s.notes}</p>}<Stamp name={s.operator_name} date={s.created_at}/><RecordControls canEdit={canEdit} busy={busy} edited={s.edited} onEdit={()=>editRecord(s)} onAnnul={()=>{void annulRecord("downtime_records",s.id,s.revision,action).then(ok=>{if(ok&&edit?.id===s.id)reset();});}}/></article>)}</div>:<Empty text="Nenhuma parada registrada neste turno."/>}
  </Panel>
 </div>;
}
export function OccurrencesScreen(props:ScreenProps){
 const {shift,data,canEdit,busy,action}=props;
 const [edit,setEdit]=useState<Occurrence|null>(null);
 const [category,setCategory]=useState(OCCURRENCE_CATEGORIES[0]);const [happened,setHappened]=useState(spInputNow());
 const [description,setDescription]=useState('');const [pending,setPending]=useState(false);const [photo,setPhoto]=useState<File|null>(null);
 function reset(){setEdit(null);setCategory(OCCURRENCE_CATEGORIES[0]);setHappened(spInputNow());setDescription('');setPending(false);setPhoto(null);}
 useEffect(reset,[shift.id]);
 function editRecord(o:Occurrence){setEdit(o);setCategory(o.category);setHappened(toSPInput(o.happened_at));setDescription(o.description);setPending(o.generate_pending);setPhoto(null);window.scrollTo({top:0,behavior:'smooth'});}
 async function save(){const ok=await action(async()=>{
   const path=photo?await uploadPhoto(photo,'occurrences'):null;
   const values={category,happened_at:spInputToISO(happened),description:description.trim(),generate_pending:pending,photo_path:path||edit?.photo_path||null};
   if(edit){const {data:updated,error}=await supabase.from('occurrences').update(values).eq('id',edit.id).eq('revision',edit.revision).select('id');if(error)throw error;if(!updated?.length)throw new Error('Ocorrência alterada por outro operador. Confira os dados atuais.');}
   else{const {error}=await supabase.from('occurrences').insert({...values,shift_id:shift.id});if(error)throw error;}
  },edit?'Ocorrência atualizada.':'Ocorrência registrada.');if(ok)reset();}
 return <div className="page-stack">
  {canEdit&&<Panel title={edit?"Editar ocorrência":"Nova ocorrência"} sub="A pendência para o próximo turno é opcional.">
   <div className="form-grid"><label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}>{OCCURRENCE_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Data e hora da ocorrência<input type="datetime-local" value={happened} onChange={e=>setHappened(e.target.value)}/></label></div>
   <label>Descrição obrigatória<textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="O que aconteceu? Informe o essencial."/></label>
   <div className="two-controls"><label className="file-label"><Camera size={16}/>{photo?photo.name:'Fotografia opcional'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label><label className="check-inline"><input type="checkbox" checked={pending} onChange={e=>setPending(e.target.checked)}/> Gerar pendência para o próximo turno</label></div>
   <div className="action-row"><Button disabled={busy||description.trim().length<3||!spInputToISO(happened)} onClick={save}><Upload size={16}/> {edit?"Salvar edição":"Registrar ocorrência"}</Button>{edit&&<Button variant="outline" onClick={reset}>Cancelar</Button>}</div>
  </Panel>}
  <Panel title="Ocorrências do turno" sub="Ordenadas pela data e horário do acontecimento.">
   {data.occurrences.length?<div className="record-list">{[...data.occurrences].sort((a,b)=>a.happened_at.localeCompare(b.happened_at)).map(o=><article key={o.id} className="record"><div className="record-top"><strong>{o.category}</strong>{o.generate_pending&&<Pill text="Gerou pendência" kind="warn"/>}</div><p>{o.description}</p><p className="muted">Acontecimento: {formatWhen(o.happened_at)}</p><Photo path={o.photo_path}/><Stamp name={o.operator_name} date={o.created_at}/><RecordControls canEdit={canEdit} busy={busy} edited={o.edited} onEdit={()=>editRecord(o)} onAnnul={()=>{void annulRecord("occurrences",o.id,o.revision,action).then(ok=>{if(ok&&edit?.id===o.id)reset();});}}/></article>)}</div>:<Empty text="Nenhuma ocorrência geral registrada."/>}
  </Panel>
 </div>;
}
