import {HISTORY_PAGE_SIZE} from '../services/history';
export default function HistoryPagination({page,total,loading,onChange}:{page:number;total:number;loading:boolean;onChange:(page:number)=>void}){
  const pages=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE));
  return <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t text-sm">
    <span aria-live="polite">{loading?'Consultando histórico…':`${total} registro(s) · Página ${page} de ${pages}`}</span>
    <div className="flex gap-2">
      <button type="button" disabled={loading||page<=1} onClick={()=>onChange(page-1)} className="px-3 py-2 border rounded disabled:opacity-40">Anterior</button>
      <button type="button" disabled={loading||page>=pages} onClick={()=>onChange(page+1)} className="px-3 py-2 border rounded disabled:opacity-40">Próxima</button>
    </div>
  </div>;
}
