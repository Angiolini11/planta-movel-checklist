import {supabase} from './supabase';
import type {Shift,ShiftData,EquipmentImage,Profile} from './types';

export async function getShift(date:string,kind:string,current:boolean):Promise<Shift|null>{
 if(current){
   const {data,error}=await supabase.rpc('join_current_shift');
   if(error)throw error;
   return data as Shift;
 }
 const {data,error}=await supabase.from('shifts').select('*').eq('shift_date',date).eq('kind',kind).maybeSingle();
 if(error)throw error;
 return data as Shift|null;
}
export async function getShiftData(id:string):Promise<ShiftData>{
 const specs=[
  ['shift_participants','joined_at'],['module_states','updated_at'],['checklist_responses','updated_at'],
  ['module_notes','created_at'],['hourmeter_readings','created_at'],['production_records','created_at'],
  ['downtime_records','created_at'],['occurrences','created_at'],['handover_notes','created_at'],
  // A fase piloto não exibe trilha de alterações no histórico operacional.
 ] as const;
 const queries=specs.map(([name,time])=>supabase.from(name).select('*').eq('shift_id',id).order(time,{ascending:false}).limit(500));
 // Todos os dados históricos da operação, inclusive pendências herdadas de turnos anteriores.
 const issuesHere=supabase.from('issues').select('*').eq('shift_id',id).order('created_at',{ascending:false}).limit(500);
 const issuesOpen=supabase.from('issues').select('*').neq('status','resolvida').order('created_at',{ascending:false}).limit(500);
 const responses=await Promise.all([...queries,issuesHere,issuesOpen]);
 for(const res of responses){if(res.error)throw res.error;}
 const [participants,states,answers,moduleNotes,meters,production,stops,occurrences,handoverNotes,localIssues,openIssues]=responses.map(x=>x.data??[]);
 const merged=new Map<string,unknown>();
 [...localIssues,...openIssues].forEach(i=>merged.set(i.id,i));
 return {participants,states,answers,moduleNotes,meters,production,stops,occurrences,handoverNotes,audit:[],issues:Array.from(merged.values())} as ShiftData;
}
export async function getImages(){
 const {data,error}=await supabase.from('equipment_images').select('*');
 if(error)throw error;
 return data as EquipmentImage[];
}
export async function getOperators(){
 const {data,error}=await supabase.from('profiles').select('id,matricula,full_name,role,created_at').order('full_name');
 if(error)throw error;
 return data as Profile[];
}
