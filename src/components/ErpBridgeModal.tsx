import {useRef,useState} from 'react';
import {X,FileUp,Download} from 'lucide-react';
import {MAX_FILE_BYTES,type ImportRow,type ImportIssue} from '../import/catalogCsv';
import {fields,required,labels,readSource,suggestMapping,mappedCatalog,mappedStock,statusLabels,
  type Field,type Mapping,type Mode,type SourceFile,type StockBasis,type StockReport,type StockStatus} from '../integrations/erpCsv';
import {importCatalog,type ImportResult} from '../services/catalogImport';
import {reconcileErpStock} from '../services/erpIntegration';

function download(name:string,content:string,type='application/json'){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// Only a human inspection export. JSON preserves exact source data/decimals.
function cell(value:unknown){
  let s=value==null?'':String(value);
  if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s)&&!/^-\d+(?:\.\d+)?$/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
export default function ErpBridgeModal({onClose,onImported}:{onClose:()=>void;onImported:()=>void|Promise<void>}){
  const [mode,setMode]=useState<Mode>('catalog');
  const [source,setSource]=useState<SourceFile|null>(null);
  const [name,setName]=useState('');
  const [mapping,setMapping]=useState<Mapping>({});
  const [basis,setBasis]=useState<StockBasis>('physical');
  const [scope,setScope]=useState('');
  const [snapshot,setSnapshot]=useState('');
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [issues,setIssues]=useState<ImportIssue[]>([]);
  const [catalog,setCatalog]=useState<ImportResult|null>(null);
  const [catalogRows,setCatalogRows]=useState<ImportRow[]>([]);
  const [report,setReport]=useState<StockReport|null>(null);
  const [filter,setFilter]=useState<StockStatus|'all'>('all');
  const [page,setPage]=useState(1);
  const lock=useRef(false);
  const clear=()=>{setError('');setIssues([]);setCatalog(null);setCatalogRows([]);setReport(null);setFilter('all');setPage(1);};
  const changeMode=(next:Mode)=>{if(lock.current)return;clear();setMode(next);setMapping(source?suggestMapping(source,next):{});setAccepted(false);};
  const selectFile=async(file:File)=>{
    if(lock.current)return;lock.current=true;setBusy(true);clear();setSource(null);setMapping({});setAccepted(false);setName(file.name);
    try{
      if(!file.name.toLowerCase().endsWith('.csv'))throw new Error('Exporte a consulta do ERP para Excel e salve como CSV UTF-8.');
      if(file.size>MAX_FILE_BYTES)throw new Error('Arquivo acima de 5 MB.');
      const parsed=readSource(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()));
      setSource(parsed);setMapping(suggestMapping(parsed,mode));
    }catch(e){setError(e instanceof Error?e.message:'Arquivo inválido.');}
    finally{lock.current=false;setBusy(false);}
  };
  const validate=async()=>{
    if(!source||lock.current||!accepted)return;
    lock.current=true;setBusy(true);clear();
    try{
      if(mode==='catalog'){
        const parsed=mappedCatalog(source,mapping);setIssues(parsed.issues);
        if(!parsed.issues.length){setCatalogRows(parsed.rows);const result=await importCatalog(parsed.rows,true);setCatalog(result);setIssues(result.issues);}
      }else{
        if(!scope.trim()||!snapshot||!Number.isFinite(Date.parse(snapshot))||Date.parse(snapshot)>Date.now())
          throw new Error('Informe armazém/empresa e data/hora de referência do relatório (não futura).');
        const parsed=mappedStock(source,mapping);setIssues(parsed.issues);
        if(!parsed.issues.length)setReport(await reconcileErpStock(parsed.rows,basis));
      }
    }catch(e){setError(e instanceof Error?e.message:'Falha na validação.');}
    finally{lock.current=false;setBusy(false);}
  };
  const commit=async()=>{
    if(lock.current||!catalog?.dryRun||catalog.ready<=0||issues.length||!accepted)return;
    if(!window.confirm('Importar '+catalog.ready+' produtos novos? Nenhum saldo físico será alterado.'))return;
    lock.current=true;setBusy(true);setError('');setCatalog(null);
    try{
      const result=await importCatalog(catalogRows,false);
      setCatalog(result);setIssues(result.issues);
      if(!result.issues.length){try{await onImported();}catch{setError('Importação concluída. Atualize a tela de inventário.');}}
    }catch(e){setError((e instanceof Error?e.message:'Falha de comunicação')+'. Valide novamente o mesmo arquivo antes de repetir.');}
    finally{lock.current=false;setBusy(false);}
  };
  const displayed=report?.rows.filter(r=>filter==='all'||r.status===filter)||[];
  const pages=Math.max(1,Math.ceil(displayed.length/50));
  const counts=report?Object.fromEntries(Object.keys(statusLabels).map(s=>[s,report.rows.filter(r=>r.status===s).length])):{};
  const exportReport=(format:'json'|'csv')=>{
    if(!report)return;
    const metadata={source:'ERP CSV — mapeamento manual',file:name,warehouse:scope.trim(),erp_snapshot:new Date(snapshot).toISOString(),...report};
    if(format==='json')download('annona-conciliacao.json',JSON.stringify(metadata,null,2));
    else{
      const headers=['linha','sku','unidade_erp','saldo_erp','unidade_wms','fisico_wms','reservado_wms','disponivel_wms','diferenca_erp_menos_wms','situacao','tipo_saldo','armazem','referencia_erp','consulta_wms'];
      const content=[headers.map(cell).join(';'),...report.rows.map(r=>[r.line,r.sku,r.erp_unit,r.erp_quantity,r.wms_unit,r.wms_physical,r.wms_reserved,r.wms_available,r.difference,statusLabels[r.status],report.basis,metadata.warehouse,metadata.erp_snapshot,report.compared_at].map(cell).join(';'))].join('\r\n');
      download('annona-conciliacao.csv','\ufeff'+content,'text/csv;charset=utf-8');
    }
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
    <section role="dialog" aria-modal="true" aria-labelledby="erp-title" className="bg-white rounded-xl w-full max-w-5xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4">
      <header className="flex justify-between gap-3"><div><h2 id="erp-title" className="text-xl font-bold">Integração ERP · Aton (por arquivo)</h2>
        <p className="text-sm text-slate-500">Importação assistida e conciliação · API direta ainda não configurada</p></div>
        <button type="button" aria-label="Fechar" disabled={busy} onClick={onClose} className="p-2 disabled:opacity-40"><X className="w-5 h-5"/></button></header>
      <div className="flex flex-wrap gap-2">
        {(['catalog','stock'] as Mode[]).map(m=><button key={m} type="button" disabled={busy} aria-pressed={mode===m} className={'px-3 py-2 border rounded-lg '+(mode===m?'bg-blue-600 text-white':'bg-white')} onClick={()=>changeMode(m)}>{m==='catalog'?'Catálogo de produtos':'Conciliar estoque'}</button>)}
      </div>
      <p className="p-3 bg-blue-50 rounded-lg text-blue-900 text-sm">Exporte do ERP somente os registros da empresa e armazém correspondentes a este WMS. Salve como CSV UTF-8, mantendo SKU e barcode como texto. As sugestões de colunas precisam ser conferidas. Não há sincronização automática.</p>
      <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer"><FileUp className="w-4 h-4"/> Selecionar CSV
        <input type="file" accept=".csv,text/csv" disabled={busy} className="sr-only" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void selectFile(file);}}/>
      </label>
      <span className="ml-2 text-sm break-all">{name}{source?' · '+source.rows.length+' linhas':''}</span>
      {source&&<>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields[mode].map(field=><label key={field} className="text-sm font-medium">{labels[field]}{(required[mode] as readonly Field[]).includes(field)?' *':''}
            <select value={mapping[field]??''} disabled={busy} onChange={e=>{clear();setAccepted(false);setMapping(m=>({...m,[field]:e.target.value===''?undefined:Number(e.target.value)}));}} className="w-full block mt-1 border rounded p-2">
              <option value="">Não usar</option>{source.headers.map((h,i)=><option key={i} value={i}>{h}</option>)}
            </select><span className="text-xs text-slate-500 block break-all">Exemplo: {mapping[field]!==undefined?source.rows[0]?.cells[mapping[field]!]:'—'}</span>
          </label>)}
        </div>
        {mode==='stock'&&<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm">Armazém/empresa (referência)<input value={scope} maxLength={120} disabled={busy} onChange={e=>{clear();setAccepted(false);setScope(e.target.value);}} className="block w-full border rounded p-2"/></label>
          <label className="text-sm">Data/hora da exportação (local)<input type="datetime-local" value={snapshot} disabled={busy} onChange={e=>{clear();setAccepted(false);setSnapshot(e.target.value);}} className="block w-full border rounded p-2"/></label>
          <label className="text-sm">Tipo de saldo<select value={basis} disabled={busy} onChange={e=>{clear();setAccepted(false);setBasis(e.target.value as StockBasis);}} className="block w-full border rounded p-2"><option value="physical">Físico (inclui reserva)</option><option value="available">Disponível (desconta reserva)</option></select></label>
        </div>}
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" disabled={busy} checked={accepted} onChange={e=>{clear();setAccepted(e.target.checked);}}/>
          {mode==='stock'?'Conferi as colunas, o tipo de saldo, as unidades e que o arquivo corresponde à totalidade do armazém deste WMS. Entendo que diferenças podem decorrer de operações entre os horários.':'Conferi o mapeamento, os códigos e a empresa/armazém. Confirmo que este arquivo contém somente os produtos que quero cadastrar.'}</label>
        <button type="button" disabled={busy||!accepted} onClick={()=>void validate()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40">{mode==='catalog'?'Validar catálogo':'Comparar saldos (somente leitura)'}</button>
      </>}
      {busy&&<p role="status" className="text-blue-700 text-sm">Processando arquivo…</p>}
      {error&&<p role="alert" className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</p>}
      {issues.length>0&&<div className="bg-red-50 p-3 rounded text-sm text-red-800">
        <strong>{issues.length} problema(s) — nenhuma gravação realizada.</strong>
        <div className="max-h-48 overflow-y-auto">{issues.slice(0,100).map((r,i)=><p key={i}>Linha {r.line} {r.sku||''}: {r.message}</p>)}</div>
        <button type="button" onClick={()=>download('annona-erros.json',JSON.stringify(issues,null,2))} className="underline">Baixar relatório de erros</button></div>}
      {catalog&&<div className="p-3 border rounded bg-slate-50 space-y-2">
        <p>{catalog.total} produtos · {catalog.dryRun?catalog.ready+' novos':catalog.created+' criados'} · {catalog.skipped} já idênticos · {catalog.issues.length} conflitos</p>
        <button type="button" disabled={busy||!catalog.dryRun||catalog.ready<=0||issues.length>0||!accepted} onClick={()=>void commit()} className="px-4 py-2 bg-green-700 text-white rounded disabled:opacity-40">Confirmar importação</button>
        {!catalog.dryRun&&!issues.length&&<p className="text-green-700 font-medium">Importação concluída sem alteração de saldos.</p>}
      </div>}
      {report&&<div className="space-y-3">
        <p className="text-sm text-slate-600">Comparação WMS: {new Date(report.compared_at).toLocaleString('pt-BR')} · {report.rows.length} linhas · {report.unlisted_active} SKUs ativos não listados no arquivo (não considerados zero).</p>
        <div className="flex flex-wrap gap-2">{Object.entries(counts).map(([s,n])=><button key={s} type="button" onClick={()=>{setFilter(s as StockStatus);setPage(1);}} className="border rounded px-3 py-2 text-sm">{statusLabels[s as StockStatus]}: <strong>{n}</strong></button>)}
          <button type="button" onClick={()=>{setFilter('all');setPage(1);}} className="border rounded px-3 py-2 text-sm">Todos</button>
        </div>
        <div className="overflow-x-auto border rounded"><table className="w-full text-sm"><thead><tr className="bg-slate-50">{['SKU','ERP','WMS físico','WMS reservado','WMS disponível','ERP − WMS','Situação'].map(h=><th key={h} className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{displayed.slice((page-1)*50,page*50).map(r=><tr key={r.line} className="border-t"><td className="p-2">{r.sku}</td><td className="p-2">{r.erp_quantity} {r.erp_unit}</td><td className="p-2">{r.wms_physical??'—'} {r.wms_unit}</td><td className="p-2">{r.wms_reserved??'—'}</td><td className="p-2">{r.wms_available??'—'}</td><td className="p-2">{r.difference??'—'}</td><td className="p-2">{statusLabels[r.status]}</td></tr>)}</tbody></table></div>
        <div className="flex gap-2 items-center text-sm"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="border rounded px-2 py-1 disabled:opacity-40">Anterior</button> {page}/{pages} <button type="button" disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="border rounded px-2 py-1 disabled:opacity-40">Próxima</button></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>exportReport('json')} className="inline-flex gap-2 px-3 py-2 border rounded"><Download className="w-4 h-4"/> JSON completo</button>
          <button type="button" onClick={()=>exportReport('csv')} className="px-3 py-2 border rounded">CSV para conferência</button>
        </div>
        <p className="text-xs text-slate-500">Relatório para conferência, não é arquivo de atualização do ERP. Preserve SKU como texto ao abrir no Excel. Nenhum saldo foi alterado.</p>
      </div>}
    </section>
  </div>;
}
