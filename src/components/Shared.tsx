import {useEffect,useState} from 'react';
import {AlertTriangle,Check,Clock,ExternalLink,ImageOff,LoaderCircle} from 'lucide-react';
import {getPhotoUrl} from '../lib/supabase';
import {formatWhen} from '../lib/time';

export function Pill({text,kind='neutral'}:{text:string;kind?:'good'|'warn'|'neutral'|'bad'|'blue'}){
 return <span className={`pill pill-${kind}`}>{kind==='good'?<Check size={13}/>:kind==='bad'?<AlertTriangle size={13}/>:null}{text}</span>;
}
export function Empty({text='Ainda não há registros para este turno.'}:{text?:string}){
 return <div className="empty"><ImageOff size={26}/><span>{text}</span></div>;
}
export function Loading({text='Carregando dados...'}:{text?:string}){
 return <div className="loading"><LoaderCircle className="spin" size={26}/><span>{text}</span></div>;
}
export function Panel({title,sub,children,aside}:{title:string;sub?:string;children:React.ReactNode;aside?:React.ReactNode}){
 return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{aside}</div>{children}</section>;
}
export function Stamp({name,date}:{name?:string|null;date?:string|null}){
 return <span className="stamp"><Clock size={12}/>{date?formatWhen(date):'—'}{name&&<> · {name}</>}</span>;
}
export function Photo({path,small=false}:{path:string|null|undefined;small?:boolean}){
 const [url,setUrl]=useState('');
 useEffect(()=>{let alive=true;if(!path){setUrl('');return;}getPhotoUrl(path).then(u=>{if(alive)setUrl(u);}).catch(()=>{if(alive)setUrl('');});return()=>{alive=false;};},[path]);
 if(!path)return null;
 if(!url)return <span className="muted">Imagem privada: carregando...</span>;
 return <a href={url} target="_blank" rel="noopener noreferrer" className={small?'photo-small':'photo-link'}><img src={url} alt="Fotografia do registro" loading="lazy"/>{!small&&<span>Ver fotografia <ExternalLink size={14}/></span>}</a>;
}
export function Button({children,onClick,disabled=false,variant='primary',className='',type='button'}:{children:React.ReactNode;onClick?:()=>void;disabled?:boolean;variant?:'primary'|'secondary'|'outline'|'danger';className?:string;type?:'button'|'submit'}){
 return <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant} ${className}`}>{children}</button>;
}
