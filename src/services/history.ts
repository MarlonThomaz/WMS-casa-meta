import { supabase,isSupabaseConfigured } from '../lib/supabase';

export type HistoryPage<T>={items:T[];total:number};
export const HISTORY_PAGE_SIZE=50;
export type HistoryFilters=Record<string,string>;
type Search={columns:string[];term:string;uuidColumn?:string};
export function historySearchExpression(columns:string[],term:string,uuidColumn?:string):string {
  // Quote the PostgREST value, escaping grammar characters and LIKE wildcards.
  const literal=term.trim().replace(/\\/g,'\\\\').replace(/%/g,'\\%').replace(/_/g,'\\_').replace(/\*/g,'\\*');
  const quoted='"'+('%'+literal+'%').replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  const expressions=columns.map(c=>c+'.ilike.'+quoted);
  if(uuidColumn && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(term.trim())) expressions.push(uuidColumn+'.eq.'+term.trim());
  return expressions.join(',');
}
export function localHistoryPage<T extends {id:string;created_at:string}>(rows:T[],page:number,size=HISTORY_PAGE_SIZE):HistoryPage<T>{
  const ordered=[...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
  return {items:ordered.slice((page-1)*size,page*size),total:ordered.length};
}
export async function historyPage<T>(table:string,page:number,filters:HistoryFilters={},search?:Search):Promise<HistoryPage<T>>{
  if(!isSupabaseConfigured)return {items:[],total:0};
  const offset=(Math.max(1,Math.trunc(page)||1)-1)*HISTORY_PAGE_SIZE;
  let query=supabase.from(table).select('*',{count:'exact'});
  for(const [col,value] of Object.entries(filters)) if(value && value!=='all')query=query.eq(col,value);
  if(search?.term.trim())query=query.or(historySearchExpression(search.columns,search.term,search.uuidColumn));
  const {data,error,count}=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+HISTORY_PAGE_SIZE-1);
  if(error){
    if(error.code==='PGRST103'&&offset>0&&count!==null)return {items:[],total:count};
    throw error;
  }
  if(count===null)throw new Error('Total de registros indisponível.');
  return {items:(data||[]) as T[],total:count};
}
export async function historyCounts<K extends string>(table:string,column:string,keys:readonly K[]):Promise<Record<K,number>>{
  const entries=await Promise.all(keys.map(async key=>{
    if(!isSupabaseConfigured)return [key,0] as const;
    const {count,error}=await supabase.from(table).select('id',{head:true,count:'exact'}).eq(column,key);
    if(error||count===null)throw new Error(error?.message||'Total de registros indisponível.');
    return [key,count] as const;
  }));
  return Object.fromEntries(entries) as Record<K,number>;
}
