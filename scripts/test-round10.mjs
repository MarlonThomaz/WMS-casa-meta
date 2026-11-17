import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise real client service functions with a PostgREST-like capped backend.
const source=readFileSync(new URL('../src/services/stockCounts.ts',import.meta.url),'utf8')
  .replace("import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';",
    "const supabase=globalThis.mockCountBackend, isSupabaseConfigured=true, isDemoMode=false;")
  .replace(/import \{ demoId, demoLocations, demoProducts, demoStockCountLines, demoStockCounts \} from '..\/demoStore';/,
    "const demoId=()=>'',demoLocations=[],demoProducts=[],demoStockCountLines=[],demoStockCounts=[];");
const rows=Array.from({length:6000},(_,i)=>({
  id:'row-'+i,stock_count_id:'count-1',product_id:'p-'+i,location_id:'l-'+i,
  system_quantity:'5',counted_quantity:i===5999?'0':'5',discrepancy:i===5999?'-5':'0',
  notes:null,counted_at:i<5999?'2026-11-17T12:00:00Z':null,created_at:'2026-11-17T00:00:00Z',
  product_sku:'SKU-'+String(i+1).padStart(5,'0'), product_name:'Produto '+(i+1),location_code:'END-'+(i+1),
}));
const rpcCalls=[];
let failProgress=false,completed=false;
let selectedTables=[];
globalThis.mockCountBackend={
  rpc:async(name,params)=>{
    rpcCalls.push([name,params]);
    if(name==='search_stock_count_lines'){
      assert.equal(params.p_count_id,'count-1');
      const q=(params.p_query||'').toLowerCase();
      const filtered=rows.filter(r=>[r.product_sku,r.product_name,r.location_code].some(v=>v.toLowerCase().includes(q)));
      return {data:filtered.slice(params.p_offset,params.p_offset+params.p_limit).map(r=>({...r,total_count:String(filtered.length)})),error:null};
    }
    if(name==='get_stock_count_progress'){
      if(failProgress)return {data:null,error:{message:'network error'}};
      return {data:[{total_lines:'6000',confirmed_lines:completed?'6000':'5999',discrepancy_lines:completed?'1':'0'}],error:null};
    }
    if(name==='process_stock_count_adjustments'){completed=true;return {error:null};}
    throw new Error('Unexpected RPC '+name);
  },
  from(name){
    selectedTables.push(name);assert.equal(name,'stock_counts');
    let filters=[],opts={},offset=0,end=0;
    const q={
      select(_cols,options){opts=options||{};return this;},eq(col,val){filters.push([col,val]);return this;},
      order(){return this;},range(a,b){offset=a;end=b;return this;},
      async maybeSingle(){return {data:{id:'count-1',status:'in_progress'},error:null};},
      then(resolve){
        if(opts.head)return Promise.resolve({count:filters.length?300:1200,error:null}).then(resolve);
        return Promise.resolve({count:1200,data:Array.from({length:end-offset+1},(_,i)=>({id:'c'+(offset+i),location_id:'L',locations:{code:'END-1200'}})),error:null}).then(resolve);
      }
    };return q;
  },
};
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const s=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const page1=await s.getStockCountLinesPage('count-1','',1,50);
const last=await s.getStockCountLinesPage('count-1','',120,50);
assert.equal(page1.items.length,50);
assert.equal(page1.total,6000);
assert.equal(last.items.at(-1).products.sku,'SKU-06000');
assert.equal(last.items.at(-1).difference,-5);
assert.equal(last.items.at(-1).counted_quantity,0);
assert.equal(last.items.at(-1).counted_at,null);
assert.equal((await s.getStockCountLinesPage('count-1','',121,50)).total,6000);
const filtered=await s.getStockCountLinesPage('count-1','SKU-06000',1,50);
assert.equal(filtered.total,1);
assert.equal(filtered.items[0].locations.code,'END-6000');
assert.equal((await s.getStockCountLinesPage('count-1','absent',1,50)).total,0);
assert.equal(s.canCompleteCount(await s.getStockCountProgress('count-1')),false,'one unconfirmed line on the last page must block completion');
assert.equal(s.canCompleteCount({total:0,confirmed:0,discrepancies:0}),false);
assert.equal(s.canCompleteCount(null),false);
assert.equal(s.canCompleteCount({total:6000,confirmed:6000,discrepancies:1}),true);
const list=await s.getStockCountsPage(24,50);
assert.equal(list.total,1200);
assert.equal(list.items[0].location_code,'END-1200');
assert.equal(list.items[0].id,'c1150');
assert.equal((await s.getStockCountStats()).total,1200);
assert.equal((await s.getStockCountById('count-1')).id,'count-1');
assert.ok(selectedTables.every(t=>t==='stock_counts'),'header/history never load all stock count lines');
assert.equal((await s.completeStockCount('count-1')).discrepancies,1);
failProgress=true;
const orig=console.warn;
console.warn=()=>{};
try { assert.equal((await s.completeStockCount('count-1')).discrepancies,null,'committed operation is not reported failed when a follow-up read fails'); }
finally {console.warn=orig;}
assert.ok(rpcCalls.some(([name,params])=>name==='search_stock_count_lines'&&params.p_offset===5950));
console.log('Round 10 regression: 6000 physical count lines, global progress, zero, filtering, 1200 histories and post-commit recovery passed.');
