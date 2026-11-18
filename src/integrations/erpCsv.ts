import {parseCsv,parseCatalog,MAX_ROWS,type ImportRow,type ImportIssue} from '../import/catalogCsv';

export type Mode='catalog'|'stock';
export type Field='sku'|'name'|'description'|'category'|'unit_base'|'min_stock'|'max_stock'|'barcode'|'quantity';
export type Mapping=Partial<Record<Field,number>>;
export type SourceFile={headers:string[];rows:{line:number;cells:string[]}[]};
export type StockInput={line:number;sku:string;unit:string;quantity:string};
export type StockBasis='physical'|'available';
export type StockStatus='match'|'difference'|'unknown_sku'|'inactive'|'unit_mismatch';
export type StockResultRow={line:number;sku:string;erp_unit:string;erp_quantity:string;wms_unit:string|null;
  wms_physical:string|null;wms_reserved:string|null;wms_available:string|null;difference:string|null;status:StockStatus};
export type StockReport={basis:StockBasis;compared_at:string;rows:StockResultRow[];unlisted_active:number};
export const fields={
  catalog:['sku','name','description','category','unit_base','min_stock','max_stock','barcode'],
  stock:['sku','unit_base','quantity'],
} as const;
export const required={catalog:['sku','name'],stock:['sku','unit_base','quantity']} as const;
export const labels:Record<Field,string>={sku:'SKU / código interno',name:'Nome',description:'Descrição adicional',
  category:'Categoria',unit_base:'Unidade base',min_stock:'Estoque mínimo',max_stock:'Estoque máximo',
  barcode:'Código de barras',quantity:'Saldo do ERP'};
const aliases:Record<Field,string[]>={
  sku:['sku','codigo','codigo_produto','codigo_interno','cod_produto','referencia'],
  name:['nome','name','produto','descricao_produto','nome_produto','descricao'],
  description:['description','descricao_adicional','observacao'],
  category:['categoria','category','grupo'],unit_base:['unidade','unit_base','unidade_base','un','und'],
  min_stock:['estoque_minimo','min_stock'],max_stock:['estoque_maximo','max_stock'],
  barcode:['codigo_barras','barcode','ean','gtin','codigo_de_barras'],
  quantity:['saldo','quantidade','estoque','saldo_fisico','saldo_disponivel'],
};
const norm=(s:string)=>s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
export function readSource(text:string):SourceFile{
  const rec=parseCsv(text);
  if(rec.length<2)throw new Error('CSV deve ter cabeçalho e linhas de dados.');
  if(rec.length-1>MAX_ROWS)throw new Error('Limite de 5.000 linhas por arquivo.');
  const headers=rec[0].cells.map(c=>c.trim());
  if(headers.length>100||headers.some(h=>!h)||new Set(headers.map(norm)).size!==headers.length)
    throw new Error('Cabeçalho vazio, duplicado ou acima de 100 colunas.');
  for(const row of rec.slice(1))if(row.cells.length!==headers.length)
    throw new Error('Linha '+row.line+': quantidade de colunas diferente do cabeçalho.');
  return {headers,rows:rec.slice(1)};
}
export function suggestMapping(source:SourceFile,mode:Mode):Mapping{
  const result:Mapping={};const used=new Set<number>();
  for(const field of fields[mode]){
    const matches=source.headers.map((h,i)=>aliases[field].includes(norm(h))?i:-1).filter(i=>i>=0&&!used.has(i));
    if(matches.length===1){result[field]=matches[0];used.add(matches[0]);}
  }
  return result;
}
export function validateMapping(source:SourceFile,mode:Mode,mapping:Mapping){
  const selected:number[]=[];
  for(const field of fields[mode]){
    const index=mapping[field];
    if(index===undefined){
      if((required[mode] as readonly Field[]).includes(field))throw new Error('Selecione a coluna '+labels[field]+'.');
      continue;
    }
    if(!Number.isInteger(index)||index<0||index>=source.headers.length||selected.includes(index))
      throw new Error('Cada campo deve utilizar uma coluna válida e distinta.');
    selected.push(index);
  }
}
const csvCell=(value:string)=>'"'+value.replace(/"/g,'""')+'"';
export function mappedCatalog(source:SourceFile,mapping:Mapping):{rows:ImportRow[];issues:ImportIssue[]}{
  validateMapping(source,'catalog',mapping);
  const chosen=fields.catalog.filter(f=>mapping[f]!==undefined);
  const header=chosen.join(';');
  // Use canonical Round 11 validation. Keep original source line numbers.
  const rows:ImportRow[]=[],issues:ImportIssue[]=[];
  const valid=source.rows.filter(row=>{
    if(!row.cells[mapping.sku!].trim()||!row.cells[mapping.name!].trim()){
      issues.push({line:row.line,message:'SKU e nome são obrigatórios.'});return false;
    }
    return true;
  });
  if(!valid.length)return {rows,issues};
  const text=header+'\n'+valid.map(row=>chosen.map(f=>csvCell(row.cells[mapping[f]!])).join(';')).join('\n');
  const lineMap=new Map(parseCsv(text).slice(1).map((row,i)=>[row.line,valid[i].line]));
  const parsed=parseCatalog(text);
  return {rows:parsed.rows.map(r=>({...r,line:lineMap.get(r.line)!})),
    issues:[...issues,...parsed.issues.map(r=>({...r,line:lineMap.get(r.line)!}))]};
}
export function mappedStock(source:SourceFile,mapping:Mapping):{rows:StockInput[];issues:ImportIssue[]}{
  validateMapping(source,'stock',mapping);
  const rows:StockInput[]=[],issues:ImportIssue[]=[];
  const seen=new Map<string,StockInput[]>();
  for(const row of source.rows){
    const sku=row.cells[mapping.sku!].trim(),unit=row.cells[mapping.unit_base!].trim();
    const raw=row.cells[mapping.quantity!].trim();
    // Preserve decimal exactly; do not use binary float or silently accept blanks/thousands.
    if(!sku||sku.length>128||!unit||unit.length>32||/[\u0000]/.test(sku+unit)||!/^\d{1,12}(?:[.,]\d{1,6})?$/.test(raw)){
      issues.push({line:row.line,sku,message:'SKU, unidade e saldo não negativo são obrigatórios (até 12 inteiros e 6 decimais, sem milhares).'});continue;
    }
    const item={line:row.line,sku,unit,quantity:raw.replace(',','.')};
    rows.push(item);
    const key=sku.toLowerCase();seen.set(key,[...(seen.get(key)||[]),item]);
  }
  for(const duplicates of seen.values())if(duplicates.length>1)
    duplicates.forEach(r=>issues.push({line:r.line,sku:r.sku,message:'SKU repetido: exporte uma única linha por SKU no armazém selecionado.'}));
  return {rows,issues};
}
export const statusLabels:Record<StockStatus,string>={match:'Conciliado',difference:'Divergência',
  unknown_sku:'SKU não cadastrado',inactive:'SKU inativo',unit_mismatch:'Unidade diferente'};
