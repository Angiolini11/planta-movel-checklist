import type {Shift,ShiftData,View} from '../lib/types';
export interface ScreenProps {
 shift:Shift;
 data:ShiftData;
 canEdit:boolean;
 busy:boolean;
 action:(fn:()=>Promise<void>, success?:string)=>Promise<boolean>;
 navigate:(view:View)=>void;
}
