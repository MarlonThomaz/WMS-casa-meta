import {supabase,isDemoMode,isSupabaseConfigured} from '../lib/supabase';
import type {StockInput,StockBasis,StockReport} from '../integrations/erpCsv';
export async function reconcileErpStock(rows:StockInput[],basis:StockBasis):Promise<StockReport>{
  if(isDemoMode||!isSupabaseConfigured)throw new Error('Conciliação disponível apenas em ambiente autenticado.');
  const {data,error}=await supabase.rpc('reconcile_erp_stock',{p_rows:rows,p_basis:basis});
  if(error)throw new Error(error.message);
  if(!data||data.basis!==basis||!Array.isArray(data.rows)||data.rows.length!==rows.length||
    !Number.isSafeInteger(data.unlisted_active)||data.unlisted_active<0||!Number.isFinite(Date.parse(data.compared_at)))
    throw new Error('Resposta de conciliação inválida ou incompleta.');
  const inputByLine=new Map(rows.map(r=>[r.line,r.sku]));
  for(const row of data.rows){
    if(inputByLine.get(row.line)!==row.sku||!['match','difference','unknown_sku','inactive','unit_mismatch'].includes(row.status))
      throw new Error('Resposta de conciliação não corresponde ao arquivo.');
    inputByLine.delete(row.line);
  }
  if(inputByLine.size)throw new Error('Resposta de conciliação incompleta.');
  return data as StockReport;
}
