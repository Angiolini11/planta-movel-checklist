import {createClient} from '@supabase/supabase-js';
export const URL=import.meta.env.VITE_SUPABASE_URL?.trim()||'';
export const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()||'';
export const CONFIGURED=Boolean(URL.startsWith('https://')&&KEY&& !URL.includes('SEU-PROJETO')&&!KEY.includes('COLE_A_'));
export const supabase=createClient(URL||'https://placeholder.supabase.co',KEY||'placeholder',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
export async function authAction(payload:Record<string,unknown>,accessToken?:string){
  const response=await fetch(`${URL}/functions/v1/operator-auth`,{
   method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,...(accessToken?{'Authorization':`Bearer ${accessToken}`}:{})},body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({error:'Falha de comunicação'}));
  if(!response.ok)throw new Error(data.error||'Não foi possível concluir a operação.');
  return data;
}
export async function uploadPhoto(file:File, folder:'anomalies'|'occurrences'|'equipment'){
  if(file.size>10*1024*1024) throw new Error('A imagem deve ter no máximo 10 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use JPEG, PNG ou WebP.');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=`${folder}/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from('plant-photos').upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  return path;
}
export async function getPhotoUrl(path:string){
  const {data,error}=await supabase.storage.from('plant-photos').createSignedUrl(path,3600);
  if(error)throw error;
  return data.signedUrl;
}
export function niceError(err:unknown){
 const message=err instanceof Error?err.message:String(err);
 if(/Failed to fetch|NetworkError|fetch failed/i.test(message))return 'Sem conexão com o servidor. Confira a internet e tente novamente.';
 if(/row-level security|permission denied|42501/i.test(message))return 'Ação não autorizada. Verifique se o turno ainda está aberto e se você participa dele.';
 if(/duplicate key|23505/i.test(message))return 'Este registro foi alterado simultaneamente. Atualize a página e confira.';
 return message;
}
