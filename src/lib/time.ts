const zone='America/Sao_Paulo';
export function spParts(date:Date=new Date()) {
  const data = new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get=(type:string)=>data.find(p=>p.type===type)!.value;
  return {year:get('year'),month:get('month'),day:get('day'),hour:Number(get('hour')),minute:Number(get('minute'))};
}
export function previousDate(ymd:string){const dt=new Date(ymd+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-1);return dt.toISOString().slice(0,10);}
export function getCurrentShiftKey(date:Date=new Date()){
  const p=spParts(date),today=`${p.year}-${p.month}-${p.day}`;
  if(p.hour<7) return {date:previousDate(today),kind:'noturno' as const};
  return {date:today,kind:p.hour<19?'diurno' as const:'noturno' as const};
}
export function spInputNow(date:Date=new Date()){const p=spParts(date);return `${p.year}-${p.month}-${p.day}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;}
export function formatDate(value:string){if(!value)return '—';const [y,m,d]=value.split('-');return `${d}/${m}/${y}`;}
export function formatWhen(v:string|null|undefined){if(!v)return '—';return new Intl.DateTimeFormat('pt-BR',{timeZone:zone,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}
export function formatFullWhen(v:string|null|undefined){if(!v)return '—';return new Intl.DateTimeFormat('pt-BR',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}
export function formatHour(v:string|null|undefined){if(!v)return '—';return new Intl.DateTimeFormat('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(new Date(v));}
export function spInputToISO(local:string):string|null {if(!local)return null;const t=Date.parse(`${local.length===16?local+':00':local}-03:00`);return Number.isFinite(t)?new Date(t).toISOString():null;}
export function durationMins(start:string|null,end:string|null){if(!start||!end)return null;const v=(Date.parse(end)-Date.parse(start))/60000;return v>=0?v:null;}
export function displayDuration(minutes:number|null){if(minutes===null)return 'Não informada';return `${Math.floor(minutes/60)}h ${String(Math.round(minutes%60)).padStart(2,'0')}min`;}
export function shiftEnd(date:string,kind:string){return kind==='diurno'?`${date} às 19h`: `${date} às 19h → ${nextDate(date)} às 07h`;}
export function nextDate(ymd:string){const dt=new Date(ymd+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+1);return dt.toISOString().slice(0,10);}
export function isShiftEnded(s:{shift_date:string;kind:string},now:Date=new Date()){
 const current=getCurrentShiftKey(now);
 return s.shift_date<current.date || (s.shift_date===current.date && s.kind==='diurno' && current.kind==='noturno');
}
