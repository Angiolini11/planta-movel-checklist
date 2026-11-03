import {useEffect,useState} from 'react';
import {Archive,ChevronRight,Download,FileClock,History as HistoryIcon} from 'lucide-react';
import {MODULES,QUESTIONS} from '../lib/catalog';
import {supabase} from '../lib/supabase';
import {formatDate,isShiftEnded,productionPeriodLabel} from '../lib/time';
import {makePdf} from '../lib/pdf';
import {Panel,Button,Empty,Pill,Photo,Stamp,Loading} from '../components/Shared';
import type {Shift} from '../lib/types';
import type {ScreenProps} from './common';

export function HistoryScreen(props:ScreenProps&{chooseShift:(s:Shift)=>void}){
 const {shift,data,chooseShift}=props;
 const [list,setList]=useState<Shift[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [dateFilter,setDateFilter]=useState(''),[kindFilter,setKindFilter]=useState('');
 const [moduleFilter,setModuleFilter]=useState(''),[operatorFilter,setOperatorFilter]=useState('');
 useEffect(()=>{let alive=true;setLoading(true);
  supabase.from('shifts').select('*').order('shift_date',{ascending:false}).order('kind',{ascending:false}).limit(100).then(({data:rows,error:err})=>{if(!alive)return;setLoading(false);if(err)setError(err.message);else setList(rows as Shift[]);});
  return()=>{alive=false;};},[shift.id]);
 const filtered=list.filter(s=>(!dateFilter||s.shift_date===dateFilter)&&(!kindFilter||s.kind===kindFilter));
 const operatorNames=[...new Set(data.participants.map(p=>p.operator_name))].sort();
 const filteredAnswer=data.answers.filter(a=>(!moduleFilter||a.module_code===moduleFilter)&&(!operatorFilter||a.updated_by_name===operatorFilter));
 const matchOperator=(name:string)=>!operatorFilter||name===operatorFilter;
 const filteredIssues=data.issues.filter(i=>i.shift_id===shift.id&&(!moduleFilter||i.module_code===moduleFilter)&&matchOperator(i.operator_name));
 return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">CONSULTA DE REGISTROS</span><h1>Histórico de turnos</h1><p>Consulte os registros ativos dos turnos e relatórios anteriores.</p></div><HistoryIcon size={30}/></div>
  <Panel title="Localizar turno" sub="Últimos 100 turnos cadastrados. Use a data para restringir os resultados.">
   <div className="form-grid filter-grid"><label>Data<input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label><label>Turno<select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="">Todos</option><option value="diurno">Diurno</option><option value="noturno">Noturno</option></select></label></div>
   {loading?<Loading/>:error?<p className="error-box">{error}</p>:filtered.length?<div className="shift-picker-list">{filtered.slice(0,24).map(s=><button className={`shift-choice ${s.id===shift.id?'active':''}`} key={s.id} onClick={()=>chooseShift(s)}><FileClock size={20}/><div><strong>{formatDate(s.shift_date)} · {s.kind==='diurno'?'Diurno':'Noturno'}</strong><small>{s.status==='encerrado'?'Finalizado':isShiftEnded(s)?'Encerramento pendente':'Em andamento'}</small></div><ChevronRight size={17}/></button>)}</div>:<Empty text="Nenhum turno encontrado com os filtros informados."/>}
  </Panel>
  <div className="archive-bar"><div><Archive size={21}/><div><strong>Turno em consulta · {formatDate(shift.shift_date)} · {shift.kind}</strong><span>{shift.status==='encerrado'?'Somente leitura · encerrado':isShiftEnded(shift)?'Somente leitura · fechamento pendente':'Em andamento'}</span></div></div><Button variant="outline" onClick={()=>makePdf(shift,data)}><Download size={16}/> Baixar PDF</Button></div>
  <Panel title="Filtrar registros deste turno" sub="Os filtros abaixo se aplicam aos registros exibidos.">
   <div className="form-grid filter-grid"><label>Módulo<select value={moduleFilter} onChange={e=>setModuleFilter(e.target.value)}><option value="">Todos</option>{MODULES.map(x=><option key={x.code}>{x.code}</option>)}</select></label><label>Operador<select value={operatorFilter} onChange={e=>setOperatorFilter(e.target.value)}><option value="">Todos</option>{operatorNames.map(x=><option key={x}>{x}</option>)}</select></label></div>
  </Panel>
  <div className="two-col"><Panel title="Equipe participante" sub="Participação automática no turno ativo.">{data.participants.length?data.participants.filter(x=>matchOperator(x.operator_name)).map(p=><div key={p.id} className="record"><strong>{p.operator_name}</strong><Stamp date={p.joined_at}/></div>):<Empty/>}</Panel>
   <Panel title="Horímetros" sub="Últimas leituras e registros do turno.">{data.meters.filter(m=>(!moduleFilter||m.module_code===moduleFilter)&&matchOperator(m.operator_name)).length?data.meters.filter(m=>(!moduleFilter||m.module_code===moduleFilter)&&matchOperator(m.operator_name)).map(m=><div className="record" key={m.id}><strong>{m.module_code} · {m.reading_type}: {Number(m.value).toLocaleString('pt-BR')}</strong><Stamp name={m.operator_name} date={m.created_at}/></div>):<Empty/>}</Panel></div>
  <Panel title="Respostas dos checklists" sub="Registro atual de cada pergunta, inclusive justificativas e evidências privadas.">
   {filteredAnswer.length?<div className="record-list">{filteredAnswer.map(a=><div key={a.id} className="record"><div className="record-top"><strong>{a.module_code} · {a.item_index}. {QUESTIONS[a.module_code][a.item_index-1]?.title}</strong><Pill text={a.status.replaceAll('_',' ')} kind={a.status==='conforme'?'good':a.status==='anomalia'?'bad':'neutral'}/></div>{a.detail&&<p>{a.detail}</p>}<Photo path={a.photo_path} small/><Stamp name={a.updated_by_name} date={a.updated_at}/></div>)}</div>:<Empty text="Sem respostas para estes filtros."/>}
  </Panel>
  <div className="two-col"><Panel title="Produção" sub="Registros por material.">{data.production.filter(p=>!moduleFilter||p.modules.includes(moduleFilter as never)).filter(p=>matchOperator(p.operator_name)).map(p=><div className="record" key={p.id}><strong>{p.material==='Outro'?p.other_material:p.material} · {p.tonnage===null?'Não informado':p.tonnage+' t'}</strong><p className="muted">Período: {productionPeriodLabel(p.starts_at,p.ends_at)}</p>{p.notes&&<p>{p.notes}</p>}<Stamp name={p.operator_name} date={p.created_at}/></div>)}{!data.production.length&&<Empty/>}</Panel>
   <Panel title="Paradas e ocorrências" sub="Ocorrências registradas durante o turno.">{data.stops.filter(p=>(!moduleFilter||p.affected===moduleFilter||p.affected==='Planta inteira')&&matchOperator(p.operator_name)).map(p=><div className="record" key={p.id}><strong>Parada · {p.affected}</strong><p>{p.reason}</p><Stamp name={p.operator_name} date={p.created_at}/></div>)}{!moduleFilter&&data.occurrences.filter(p=>matchOperator(p.operator_name)).map(p=><div className="record" key={p.id}><strong>Ocorrência · {p.category}</strong><p>{p.description}</p><Stamp name={p.operator_name} date={p.created_at}/></div>)}{!data.stops.length&&!data.occurrences.length&&<Empty/>}</Panel></div>
  <Panel title="Anomalias e pendências originadas neste turno" sub="Pendências resolvidas continuam acessíveis.">
   {filteredIssues.length?filteredIssues.map(i=><div key={i.id} className="record"><div className="record-top"><strong>{i.module_code||'Ocorrência'}</strong><Pill text={i.status.replaceAll('_',' ')} kind={i.status==='resolvida'?'good':'warn'}/></div><p>{i.description}</p>{i.solution&&<p className="solution">Solução: {i.solution}</p>}<Stamp name={i.operator_name} date={i.created_at}/></div>):<Empty/>}
  </Panel>
  <div className="two-col"><Panel title="Observações dos módulos" sub="Cada nota mantém sua autoria.">{data.moduleNotes.filter(n=>(!moduleFilter||n.module_code===moduleFilter)&&matchOperator(n.operator_name)).map(n=><div key={n.id} className="record"><strong>{n.module_code}</strong><p>{n.body}</p><Stamp name={n.operator_name} date={n.created_at}/></div>)}{!data.moduleNotes.length&&<Empty/>}</Panel>
   <Panel title="Passagem final" sub="Registro de encerramento da equipe."><div className="record"><strong>{shift.closed_by_name||'Aguardando fechamento'}</strong><p>{shift.close_notes||'Sem observações finais.'}</p>{shift.late_reason&&<p>Justificativa tardia: {shift.late_reason}</p>}<Stamp date={shift.closed_at}/></div>{data.handoverNotes.filter(n=>matchOperator(n.operator_name)).map(n=><div className="record" key={n.id}><p>{n.body}</p><Stamp name={n.operator_name} date={n.created_at}/></div>)}</Panel></div>

 </div>;
}
