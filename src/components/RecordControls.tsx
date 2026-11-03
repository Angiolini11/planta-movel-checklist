import {Pencil,Trash2} from 'lucide-react';
import {Button,Pill} from './Shared';
import {supabase} from '../lib/supabase';
import type {ScreenProps} from '../screens/common';

export type EditableTable='hourmeter_readings'|'production_records'|'downtime_records'|'occurrences'|'module_notes'|'handover_notes'|'checklist_responses';

// Remove apenas o registro atual; sem cópia no histórico de interface.
// O banco aplica a autorização de participante do turno e bloqueia turnos encerrados.
export async function annulRecord(table:EditableTable, id:string, revision:number, action:ScreenProps['action']):Promise<boolean>{
 if(!window.confirm('Anular este registro? Ele deixará de aparecer no site e no relatório. Essa ação não pode ser desfeita.'))return false;
 return action(async()=>{
  const {data,error}=await supabase.from(table).delete().eq('id',id).eq('revision',revision).select('id');
  if(error)throw error;
  if(!data?.length)throw new Error('O registro foi alterado por outro operador ou já não existe. Atualize a página.');
 },'Registro anulado.');
}

export function RecordControls({canEdit,busy,edited,onEdit,onAnnul}:{canEdit:boolean;busy:boolean;edited?:boolean;onEdit:()=>void;onAnnul:()=>void}){
 return <div className="record-controls">
  {edited&&<Pill text="Editado" kind="neutral"/>}
  {canEdit&&<><Button variant="outline" disabled={busy} onClick={onEdit}><Pencil size={14}/> Editar</Button><Button variant="outline" disabled={busy} onClick={onAnnul}><Trash2 size={14}/> Anular</Button></>}
 </div>;
}
