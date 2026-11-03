import type { ModuleCode } from './catalog';
export type View = 'home'|'modules'|'module'|'production'|'stops'|'occurrences'|'handover'|'history'|'settings';
export interface Profile { id:string;matricula:string;full_name:string;role:'operador'|'configurador';created_at:string }
export interface Shift { id:string;shift_date:string;kind:'diurno'|'noturno';status:'aberto'|'encerrado';closed_by_name:string|null;closed_at:string|null;final_condition:string|null;close_notes:string|null;late_reason:string|null }
export interface Participant {id:string;shift_id:string;operator_id:string;operator_name:string;joined_at:string}
export interface ModuleState {id:string;shift_id:string;module_code:ModuleCode;condition:string;reason:string|null;revision:number;updated_by_name:string;updated_at:string}
export interface ChecklistResponse {id:string;shift_id:string;module_code:ModuleCode;item_index:number;status:string;detail:string|null;photo_path:string|null;revision:number;updated_by_name:string;updated_at:string}
export interface ModuleNote {id:string;shift_id:string;module_code:ModuleCode;body:string;operator_name:string;created_at:string;edited:boolean;revision:number}
export interface Hourmeter {id:string;shift_id:string;module_code:ModuleCode;reading_type:'inicial'|'final';value:number;operator_name:string;created_at:string;edited:boolean;revision:number}
export interface ProductionRecord {id:string;shift_id:string;material:string;other_material:string|null;modules:ModuleCode[];tonnage:number|null;notes:string|null;operator_name:string;created_at:string;edited:boolean;revision:number}
export interface Downtime {id:string;shift_id:string;affected:string;reason:string;starts_at:string|null;ends_at:string|null;notes:string|null;revision:number;operator_name:string;created_at:string;updated_at:string;edited:boolean}
export interface Occurrence {id:string;shift_id:string;category:string;happened_at:string;description:string;photo_path:string|null;generate_pending:boolean;operator_name:string;created_at:string;edited:boolean;revision:number}
export interface Issue {id:string;shift_id:string;origin:string;origin_id:string;module_code:ModuleCode|null;item_index:number|null;description:string;photo_path:string|null;status:'aberta'|'em_acompanhamento'|'resolvida';solution:string|null;revision:number;created_at:string;operator_name:string;updated_at:string;resolved_by_name:string|null;resolved_at:string|null}
export interface HandoverNote {id:string;shift_id:string;body:string;operator_name:string;created_at:string;edited:boolean;revision:number}
export interface EquipmentImage {module_code:ModuleCode;storage_path:string;updated_at:string}
export interface AuditEvent {id:number;shift_id:string|null;entity_table:string;entity_id:string;operation:string;old_data:Record<string,unknown>|null;new_data:Record<string,unknown>|null;actor_name:string|null;created_at:string}
export interface ShiftData {
  participants:Participant[];states:ModuleState[];answers:ChecklistResponse[];moduleNotes:ModuleNote[];
  meters:Hourmeter[];production:ProductionRecord[];stops:Downtime[];occurrences:Occurrence[];
  issues:Issue[];handoverNotes:HandoverNote[];audit:AuditEvent[];
}
export const EMPTY_DATA:ShiftData={participants:[],states:[],answers:[],moduleNotes:[],meters:[],production:[],stops:[],occurrences:[],issues:[],handoverNotes:[],audit:[]};
