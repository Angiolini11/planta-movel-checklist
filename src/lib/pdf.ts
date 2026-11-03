import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {MODULES,CONDITIONS} from './catalog';
import type {Shift,ShiftData} from './types';
import {formatDate,formatWhen,durationMins,displayDuration,productionPeriodLabel} from './time';
const red:[number,number,number]=[182,66,61];
const dark:[number,number,number]=[51,58,64];
const money=(v:number|null|undefined)=>v===null||v===undefined?'Não informado':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const cut=(s:string,n=150)=>s.length>n?s.slice(0,n-1)+'…':s;
export function makePdf(shift:Shift,data:ShiftData){
 const doc=new jsPDF({format:'a4',unit:'mm'});
 const W=210,margin=13;
 doc.setFillColor(...red);doc.rect(0,0,W,28,'F');
 doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('PLANTA MÓVEL  |  RELATÓRIO DE TURNO',margin,12);
 doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${formatDate(shift.shift_date)} · ${shift.kind==='diurno'?'Diurno (07h–19h)':'Noturno (19h–07h)'}`,margin,20);
 doc.setTextColor(...dark);doc.setFont('helvetica','bold');doc.setFontSize(10);
 doc.text(shift.status==='encerrado'?'Relatório de turno encerrado':'RELATÓRIO PARCIAL — turno em aberto',margin,36);
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);
 const names=data.participants.map(x=>x.operator_name).join(' · ')||'Nenhum participante cadastrado';
 const lines=doc.splitTextToSize(`Operadores: ${names}`,W-margin*2);
 doc.text(lines,margin,43);
 let y=43+lines.length*4.5;
 const table=(head:string[],body:(string|number)[][])=>{
   autoTable(doc,{startY:y+3,head:[head],body,margin:{left:margin,right:margin},theme:'grid',
     styles:{fontSize:7.7,cellPadding:2.4,overflow:'linebreak',lineColor:[222,226,229]},
     headStyles:{fillColor:dark,textColor:[255,255,255],fontStyle:'bold'},
     alternateRowStyles:{fillColor:[248,249,249]}});
   y=((doc as unknown as {lastAutoTable:{finalY:number}}).lastAutoTable?.finalY||y)+2;
 };
 const section=(title:string)=>{
  if(y>262){doc.addPage();y=16;}
  doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(...red);doc.text(title.toUpperCase(),margin,y+5);y+=8;
 };
 section('Situação dos equipamentos e horímetros');
 table(['Módulo','Condição','Inicial','Final','Diferença'],MODULES.map(m=>{
  const c=data.states.find(s=>s.module_code===m.code);
  const readings=data.meters.filter(r=>r.module_code===m.code);
  const initial=readings.find(r=>r.reading_type==='inicial');const final=readings.find(r=>r.reading_type==='final');
  const diff=initial&&final&&Number(final.value)>=Number(initial.value)?money(Number(final.value)-Number(initial.value)):'—';
  return [m.code,CONDITIONS.find(x=>x.value===c?.condition)?.label||'Não informado',money(initial?.value),money(final?.value),diff];
 }));
 section('Produção e materiais');
 const total=data.production.reduce((sum,r)=>sum+(r.tonnage===null?0:Number(r.tonnage)),0);
 table(['Material / atividade','Módulos','Período (início → fim)','Tonelagem (t)'],data.production.length?
  data.production.slice(0,9).map(r=>[(r.material==='Outro'?r.other_material:r.material)||'',r.modules.join(' / '),productionPeriodLabel(r.starts_at,r.ends_at),money(r.tonnage)]):[['Nenhum registro','—','—','—']]);
 if(data.production.length){doc.setFontSize(8);doc.setTextColor(...dark);doc.text(`Soma dos registros com tonelagem: ${money(total)} t (sem duplicar por módulo).`,margin,y+2);y+=5;}
 if(data.production.length>9){doc.setFontSize(8);doc.text(`+ ${data.production.length-9} registro(s) adicional(is) disponíveis no sistema.`,margin,y+2);y+=5;}
 section('Paradas e ocorrências');
 const events=[
  ...data.stops.map(s=>({time:s.starts_at||s.created_at,kind:`Parada · ${s.affected}`,detail:`${s.reason} · ${displayDuration(durationMins(s.starts_at,s.ends_at))}`})),
  ...data.occurrences.map(o=>({time:o.happened_at,kind:o.category,detail:o.description}))
 ].sort((a,b)=>a.time.localeCompare(b.time));
 table(['Horário','Tipo','Resumo'],events.length?events.slice(0,8).map(e=>[formatWhen(e.time),e.kind,cut(e.detail,85)]):[['—','Sem registros','—']]);
 if(events.length>8){doc.setFontSize(8);doc.setTextColor(...dark);doc.text(`+ ${events.length-8} registro(s) adicionais no histórico online.`,margin,y+2);y+=5;}
 section('Pendências em aberto');
 const pending=data.issues.filter(i=>i.status!=='resolvida');
 table(['Origem','Situação','Descrição'],pending.length?pending.slice(0,7).map(i=>[i.module_code||'Ocorrência',i.status==='aberta'?'Aberta':'Acompanhamento',cut(i.description,115)]):[['—','Nenhuma','—']]);
 if(pending.length>7){doc.setFontSize(8);doc.text(`+ ${pending.length-7} pendência(s) adicional(is) no sistema.`,margin,y+2);y+=5;}
 section('Passagem e encerramento');
 const pass=[...data.handoverNotes.map(n=>n.body),shift.close_notes||''].filter(Boolean);
 const notes=pass.length?pass.map(t=>cut(t,170)).slice(-4).join('  •  '):'Sem observações de passagem.';
 const wrap=doc.splitTextToSize(notes,W-2*margin);
 if(y+wrap.length*4+15>282){doc.addPage();y=16;}
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...dark);doc.text(wrap,margin,y+4);
 y+=wrap.length*4+6;
 doc.setFontSize(8);doc.text(`Encerramento: ${shift.closed_by_name?`${shift.closed_by_name} · ${formatWhen(shift.closed_at)}`:'Ainda não finalizado'}`,margin,y+5);
 if(shift.late_reason)doc.text(doc.splitTextToSize(`Justificativa tardia: ${shift.late_reason}`,W-2*margin),margin,y+11);
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){
  doc.setPage(i);doc.setDrawColor(220,220,220);doc.line(margin,287,W-margin,287);
  doc.setFontSize(7);doc.setTextColor(120,125,129);
  doc.text('Relatório resumido. Resumo operacional. Consulte os registros ativos no sistema.',margin,292);
  doc.text(`${i}/${pages}`,W-margin-4,292);
 }
 doc.save(`relatorio-planta-${shift.shift_date}-${shift.kind}.pdf`);
}
