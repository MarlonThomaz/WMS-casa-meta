import {useRef,useState} from 'react';
import {Download,FileUp,AlertCircle,CheckCircle,X} from 'lucide-react';
import {CSV_TEMPLATE,MAX_FILE_BYTES,parseCatalog,type ImportRow,type ImportIssue} from '../import/catalogCsv';
import {importCatalog,type ImportResult} from '../services/catalogImport';

function download(name:string,text:string,type:string){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function CatalogImportModal({onClose,onImported}:{onClose:()=>void;onImported:()=>void|Promise<void>}){
  const [rows,setRows]=useState<ImportRow[]>([]);
  const [fileName,setFileName]=useState('');
  const [localIssues,setLocalIssues]=useState<ImportIssue[]>([]);
  const [result,setResult]=useState<ImportResult|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [committed,setCommitted]=useState(false);
  const lock=useRef(false);
  const issues=[...localIssues,...(result?.issues||[])];
  const validated=Boolean(result?.dryRun&&issues.length===0&&result.ready>0&&!committed);
  const selectFile=async(file:File)=>{
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');setLocalIssues([]);setRows([]);setResult(null);setCommitted(false);setFileName(file.name);
    try{
      if(!file.name.toLowerCase().endsWith('.csv'))throw new Error('Salve sua planilha no formato CSV UTF-8.');
      if(file.size>MAX_FILE_BYTES)throw new Error('Arquivo acima de 5 MB.');
      const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      const parsed=parseCatalog(text);setRows(parsed.rows);setLocalIssues(parsed.issues);
      if(parsed.issues.length===0)setResult(await importCatalog(parsed.rows,true));
    }catch(e){setError(e instanceof Error?e.message:'Falha na leitura do CSV.');}
    finally{lock.current=false;setBusy(false);}
  };
  const preview=async()=>{
    if(lock.current||!rows.length||localIssues.length)return;
    lock.current=true;setBusy(true);setError('');setResult(null);
    try{setResult(await importCatalog(rows,true));}
    catch(e){setError(e instanceof Error?e.message:'Falha na validação.');}
    finally{lock.current=false;setBusy(false);}
  };
  const commit=async()=>{
    if(lock.current||!validated||!result)return;
    if(!window.confirm('Cadastrar '+result.ready+' novos produtos sem saldo inicial? Produtos existentes não serão modificados.'))return;
    lock.current=true;setBusy(true);setError('');setResult(null);
    try{
      const response=await importCatalog(rows,false);setResult(response);
      if(response.issues.length===0){
        setCommitted(true);
        try{await onImported();}catch{setError('Importação concluída. Atualize o inventário para carregar os novos produtos.');}
      }
    }catch(e){
      setError((e instanceof Error?e.message:'Falha de comunicação')+'. Não repita a gravação sem validar novamente; o servidor pode ter concluído a operação.');
    }finally{lock.current=false;setBusy(false);}
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
    <section role="dialog" aria-modal="true" aria-labelledby="import-title" className="bg-white rounded-xl w-full max-w-4xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div><h2 id="import-title" className="text-xl font-bold">Importação de produtos</h2>
          <p className="text-sm text-slate-600">CSV UTF-8 · até 5.000 produtos · sem alteração de estoque</p></div>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Fechar importação" className="p-2 disabled:opacity-40"><X className="w-5 h-5"/></button>
      </div>
      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900">Use SKU e código de barras como texto na planilha, inclusive zeros à esquerda. Não inclua quantidades físicas. O arquivo é validado antes de qualquer gravação; produtos idênticos já existentes são ignorados, conflitos bloqueiam o arquivo inteiro.</div>
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" disabled={busy} onClick={()=>download('modelo-produtos-annona.csv',CSV_TEMPLATE,'text/csv;charset=utf-8')} className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg"><Download className="w-4 h-4"/> Baixar modelo CSV</button>
        <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer">
          <FileUp className="w-4 h-4"/> Selecionar arquivo
          <input type="file" accept=".csv,text/csv" disabled={busy} className="sr-only" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void selectFile(file);}}/>
        </label>
        <span className="text-sm break-all text-slate-500">{fileName}</span>
      </div>
      {busy&&<p role="status" className="text-sm text-blue-700">Processando arquivo. Não feche a tela.</p>}
      {error&&<p role="alert" className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</p>}
      {result&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="p-3 border rounded-lg">Linhas <strong className="block text-xl">{result.total}</strong></div>
        <div className="p-3 border rounded-lg">{committed?'Criados':'Novos'} <strong className="block text-xl">{committed?result.created:result.ready}</strong></div>
        <div className="p-3 border rounded-lg">Já idênticos <strong className="block text-xl">{result.skipped}</strong></div>
        <div className="p-3 border rounded-lg">Conflitos <strong className="block text-xl">{result.issues.length}</strong></div>
      </div>}
      {committed&&<p role="status" className="flex gap-2 p-3 bg-green-50 text-green-800 rounded-lg"><CheckCircle className="w-5 h-5"/> Importação concluída. {result?.created??0} produtos cadastrados; nenhum saldo alterado.</p>}
      {issues.length>0&&<div className="space-y-2">
        <p className="flex gap-2 text-sm text-red-700 font-medium"><AlertCircle className="w-4 h-4"/> {issues.length} problema(s). Corrija o CSV e selecione novamente.</p>
        <div className="max-h-48 overflow-auto border rounded-lg"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="p-2 text-left">Linha</th><th className="p-2 text-left">SKU</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{issues.slice(0,100).map((issue,i)=><tr key={i} className="border-t"><td className="p-2">{issue.line}</td><td className="p-2 break-all">{issue.sku}</td><td className="p-2">{issue.message}</td></tr>)}</tbody></table></div>
        <button type="button" className="text-blue-700 underline text-sm" onClick={()=>download('validacao-annona.json',JSON.stringify(issues,null,2),'application/json')}>Baixar relatório completo</button>
      </div>}
      {rows.length>0&&<div>
        <h3 className="font-medium text-sm mb-2">Amostra: {Math.min(rows.length,10)} de {rows.length} linhas lidas</h3>
        <div className="overflow-auto border rounded-lg"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="p-2 text-left">SKU</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Unidade</th><th className="p-2 text-left">Barcode</th></tr></thead><tbody>{rows.slice(0,10).map(r=><tr key={r.line} className="border-t"><td className="p-2">{r.sku}</td><td className="p-2">{r.name}</td><td className="p-2">{r.unit_base}</td><td className="p-2">{r.barcode||'—'}</td></tr>)}</tbody></table></div>
      </div>}
      {!committed&&result?.dryRun&&issues.length===0&&result.ready===0&&<p className="text-sm text-slate-600">Todos os produtos informados já existem com os mesmos dados; não há nada para cadastrar.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 border rounded-lg">{committed?'Fechar':'Cancelar'}</button>
        {!committed&&<button type="button" disabled={busy||!rows.length||localIssues.length>0} onClick={()=>void preview()} className="px-3 py-2 border rounded-lg disabled:opacity-40">Validar novamente</button>}
        {!committed&&<button type="button" disabled={busy||!validated} onClick={()=>void commit()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40">Importar {result?.ready??0} produtos</button>}
      </div>
    </section>
  </div>;
}
