// CSV only, preserving SKU/barcode as text. Strict grammar prevents shifted columns.
export type ImportRow={line:number;sku:string;name:string;description:string|null;category:string|null;
  unit_base:string;min_stock:number;max_stock:number|null;barcode:string|null};
export type ImportIssue={line:number;sku?:string|null;message:string};
export const MAX_ROWS=5000;
export const MAX_FILE_BYTES=5*1024*1024;
export const CSV_TEMPLATE='\ufeffsku;nome;descricao;categoria;unidade;estoque_minimo;estoque_maximo;codigo_barras\r\n000123;Produto exemplo;Descrição;Ferramentas;un;0;50;0123456789012\r\n';

function delimiterOf(text:string):string {
  let quote=false,comma=0,semi=0;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quote&&text[i+1]==='"')i++;else quote=!quote;}
    else if(!quote){if(c==='\n'||c==='\r')break;if(c===',')comma++;if(c===';')semi++;}
  }
  return semi>=comma?';':',';
}
export function parseCsv(text:string):{line:number;cells:string[]}[] {
  text=text.replace(/^\ufeff/,'');
  const delimiter=delimiterOf(text);
  const records:{line:number;cells:string[]}[]=[];
  let cells:string[]=[],value='',quoted=false,closed=false,line=1,start=1;
  const cell=()=>{cells.push(value);value='';closed=false;};
  const record=()=>{cell();if(cells.some(v=>v.trim()!==''))records.push({line:start,cells});cells=[];};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
      else{value+=c;if(c==='\n'||(c==='\r'&&text[i+1]!=='\n'))line++;}
      continue;
    }
    if(c===delimiter){cell();continue;}
    if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;record();line++;start=line;continue;}
    if(closed)throw new Error('CSV inválido na linha '+line+': caractere após aspas.');
    if(c==='"'){if(value!=='')throw new Error('CSV inválido na linha '+line+': aspas fora de campo.');quoted=true;}
    else value+=c;
  }
  if(quoted)throw new Error('CSV inválido: campo entre aspas não fechado.');
  if(value!==''||cells.length||closed)record();
  return records;
}
const aliases:Record<string,keyof Omit<ImportRow,'line'>>={
  sku:'sku',nome:'name',name:'name',descricao:'description',description:'description',
  categoria:'category',category:'category',unidade:'unit_base',unit_base:'unit_base',
  estoque_minimo:'min_stock',min_stock:'min_stock',estoque_maximo:'max_stock',max_stock:'max_stock',
  codigo_barras:'barcode',barcode:'barcode',
};
const normalize=(s:string)=>s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_');
function decimal(raw:string,allowEmpty:boolean):number|null {
  if(!raw)return allowEmpty?null:0;
  if(!/^\d+(?:[.,]\d+)?$/.test(raw))throw new Error('Informe números não negativos, sem separador de milhares.');
  const n=Number(raw.replace(',','.'));
  if(!Number.isFinite(n))throw new Error('Número fora do intervalo.');
  return n;
}
export function parseCatalog(text:string):{rows:ImportRow[];issues:ImportIssue[]} {
  const records=parseCsv(text);
  if(records.length<2)throw new Error('O arquivo deve ter cabeçalho e pelo menos um produto.');
  if(records.length-1>MAX_ROWS)throw new Error('Limite de 5.000 produtos por arquivo.');
  const headers=records[0].cells.map(c=>aliases[normalize(c)]);
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length||!headers.includes('sku')||!headers.includes('name'))
    throw new Error('Cabeçalho inválido: use o modelo; SKU e nome são obrigatórios. Não inclua saldo ou endereço.');
  const rows:ImportRow[]=[],issues:ImportIssue[]=[];
  for(const record of records.slice(1)){
    const {line,cells}=record;
    if(cells.length!==headers.length){issues.push({line,message:'Quantidade de colunas diferente do cabeçalho'});continue;}
    const v=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));
    try{
      if(!v.sku||v.sku.length>128||!v.name||v.name.length>500)throw new Error('SKU e nome obrigatórios (máximos 128 e 500 caracteres).');
      if((v.description?.length??0)>2000||(v.category?.length??0)>200||(v.unit_base?.length??0)>32||(v.barcode?.length??0)>200)
        throw new Error('Campo excede o tamanho permitido.');
      if(Object.values(v).some(s=>s.includes('\u0000')))throw new Error('Caractere inválido no arquivo.');
      const min=decimal(v.min_stock||'',false)!,max=decimal(v.max_stock||'',true);
      if(max!==null&&max<min)throw new Error('Estoque máximo menor que mínimo.');
      rows.push({line,sku:v.sku,name:v.name,description:v.description||null,category:v.category||null,unit_base:v.unit_base||'un',
        min_stock:min,max_stock:max,barcode:v.barcode||null});
    }catch(e){issues.push({line,sku:v.sku,message:e instanceof Error?e.message:'Linha inválida'});}
  }
  const skus=new Map<string,ImportRow[]>(),codes=new Map<string,ImportRow[]>();
  for(const row of rows){const key=row.sku.toLowerCase();skus.set(key,[...(skus.get(key)||[]),row]);
    if(row.barcode)codes.set(row.barcode,[...(codes.get(row.barcode)||[]),row]);}
  for(const group of skus.values())if(group.length>1)group.forEach(r=>issues.push({line:r.line,sku:r.sku,message:'SKU repetido no arquivo'}));
  for(const group of codes.values())if(group.length>1)group.forEach(r=>issues.push({line:r.line,sku:r.sku,message:'Código de barras repetido no arquivo'}));
  return {rows,issues};
}
