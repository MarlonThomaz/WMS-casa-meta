import {supabase,isSupabaseConfigured,isDemoMode} from '../lib/supabase';
import type {ImportRow,ImportIssue} from '../import/catalogCsv';
export type ImportResult={total:number;ready:number;skipped:number;created:number;issues:ImportIssue[];dryRun:boolean};
export async function importCatalog(rows:ImportRow[],dryRun=true):Promise<ImportResult>{
  if(!isSupabaseConfigured||isDemoMode)throw new Error('Importação disponível apenas em ambiente autenticado.');
  const {data,error}=await supabase.rpc('import_product_catalog',{p_rows:rows,p_dry_run:dryRun});
  if(error)throw new Error(error.message);
  if(!data||!Array.isArray(data.issues)||data.total!==rows.length||data.dryRun!==dryRun||
    ![data.ready,data.skipped,data.created].every((n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0))
    throw new Error('Resposta de importação inválida; consulte novamente antes de repetir.');
  return data as ImportResult;
}
