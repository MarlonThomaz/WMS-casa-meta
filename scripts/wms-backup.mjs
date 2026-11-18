#!/usr/bin/env node
// No database credentials in arguments, output or manifest. Use standard libpq
// PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSFILE, preferably SSL verify-full hosted.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readFile,writeFile,stat,mkdtemp,rename,rm} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const scope=['public','auth'];
const postgresEnv={...process.env};
function run(command,args,{capture=false,quiet=false,env=postgresEnv}={}){
  const r=spawnSync(command,args,{env,encoding:'utf8',
    stdio:['ignore',capture?'pipe':quiet?'ignore':'inherit','inherit'],maxBuffer:16*1024*1024});
  if(r.error)throw new Error(command+' indisponível: '+r.error.message);
  if(r.status!==0)throw new Error(command+' falhou (código '+r.status+').');
  return capture?r.stdout.trim():'';
}
async function sha(path){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  return hash.digest('hex');
}
async function verify(dir){
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  if(manifest.version!==1||manifest.scope?.join(',')!==scope.join(',')||
     manifest.archive!=='wms.dump'||!/^([0-9a-f]{64})$/.test(manifest.sha256)||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<=0)
    throw new Error('Manifesto inválido.');
  const path=join(dir,'wms.dump');
  if((await stat(path)).size!==manifest.bytes||await sha(path)!==manifest.sha256)
    throw new Error('Arquivo corrompido ou manifesto incompatível.');
  run('pg_restore',['--list',path],{quiet:true});
  console.log('Backup válido: SHA-256, tamanho e catálogo do arquivo conferidos.');
  return path;
}
function requireConnection(){
  for(const k of ['PGHOST','PGPORT','PGUSER','PGDATABASE'])
    if(!process.env[k])throw new Error('Configure '+k+' no ambiente; não use URLs com senha na linha de comando.');
  if(!/^[A-Za-z0-9_.-]+$/.test(process.env.PGDATABASE))throw new Error('PGDATABASE deve ser somente o nome do banco.');
  if(!/^\d+$/.test(process.env.PGPORT))throw new Error('PGPORT inválida.');
}
async function backup(root){
  requireConnection();
  await mkdir(root,{recursive:true,mode:0o700});
  const dir=await mkdtemp(join(root,'.pending-wms-'));
  const archive=join(dir,'wms.dump');
  try{
    // Precreate private file. The custom format captures a consistent MVCC snapshot.
    await (await open(archive,'wx',0o600)).close();
    run('pg_dump',['--format=custom','--schema=public','--schema=auth','--no-password','--file',archive]);
    run('pg_restore',['--list',archive],{quiet:true});
    const bytes=(await stat(archive)).size;
    if(!bytes)throw new Error('Backup vazio.');
    const manifest={version:1,archive:'wms.dump',scope,createdAt:new Date().toISOString(),bytes,sha256:await sha(archive),
      note:'Logical WMS archive. Not a complete Supabase platform backup.'};
    await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
    const final=join(root,'wms-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+basename(dir).slice(-6));
    await rename(dir,final);
    console.log('Cópia criada: '+final);
  }catch(e){
    await rm(dir,{recursive:true,force:true});
    throw e;
  }
}

async function restoreLocal(dir,confirmed){
  requireConnection();
  const host=process.env.PGHOST,db=process.env.PGDATABASE;
  if(!confirmed||!['127.0.0.1','localhost','::1'].includes(host)||!/^wms_restore_[a-z0-9_]+$/.test(db)
    ||process.env.PGHOSTADDR||process.env.PGSERVICE||process.env.PGSERVICEFILE)
    throw new Error('Restauração recusada: exige --confirm-disposable, host local, banco wms_restore_* e nenhuma configuração de serviço/hostaddr.');
  const archive=await verify(dir);
  const target=['--host',host,'--port',process.env.PGPORT,'--username',process.env.PGUSER,'--dbname',db,'--no-password'];
  const existing=run('psql',[...target,'-X','-At','-v','ON_ERROR_STOP=1','-c',
    "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','v','m','S','f')"],{capture:true});
  if(existing!=='0')throw new Error('Restauração recusada: banco de destino não está vazio.');
  // No --clean, no drop, never restores over a non-empty WMS.
  run('pg_restore',[...target,'--exit-on-error','--single-transaction','--no-owner',archive]);
  const diagnostics=fileURLToPath(new URL('../supabase/diagnostics/verify_restored_wms.sql',import.meta.url));
  run('psql',[...target,'-X','-v','ON_ERROR_STOP=1','-f',diagnostics]);
  console.log('Restauração local validada. NÃO utilize esse banco como ambiente Supabase hospedado.');
}
try{
  const [command,dir,confirm]=process.argv.slice(2);
  if(!dir||!['backup','verify','restore-local'].includes(command))throw new Error('Uso: node scripts/wms-backup.mjs backup|verify|restore-local <diretório> [--confirm-disposable]');
  if(command==='backup')await backup(resolve(dir));
  else if(command==='verify')await verify(resolve(dir));
  else await restoreLocal(resolve(dir),confirm==='--confirm-disposable');
}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
