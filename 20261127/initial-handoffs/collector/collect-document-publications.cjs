'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),z=require('node:zlib'),crypto=require('node:crypto');
process.env.UV_THREADPOOL_SIZE='1';
const root='F:/Dev/.bead-edit-20261111',coord=root+'/coordination-20261124',native=coord+'/git-publication-native-documents-20261127-v1',nativeSuper=native+'.supervisor',app=coord+'/git-publication-scotty-documents-20261127-2889282bfcec',appSuper=app+'.supervisor';
const paths=[native+'/result.json',nativeSuper+'/result.json',native+'/original-git-baseline.json',native+'/index-after.raw',app+'/result.json',appSuper+'/result.json'];
const start=Date.now(),floor=1073741824,cap=134217728,block=37500;
let peak=0,minimum=Infinity,samples=0,sent=false,timer,hard;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const error=(reason,exit=1)=>Object.assign(new Error(reason),{exit});
function check(){const rss=process.memoryUsage.rss(),free=os.freemem();peak=Math.max(peak,rss);minimum=Math.min(minimum,free);samples++;if(Date.now()-start>=15000)throw error('deadline',124);if(free<floor)throw error('free-memory',125);if(rss>cap)throw error('own-rss',126);}
function emit(value,code){if(sent)return;sent=true;const line=JSON.stringify(value)+'\n';if(line.length>65000){process.exit(127);return;}process.stdout.write(line,()=>{clearInterval(timer);clearTimeout(hard);process.exit(code);});}
function stop(e){if(sent){process.exit(e.exit||1);return;}emit({schema_version:1,status:'refused',reason:e.exit?e.message:'read-or-encoding-error',error_code:e.code||null,elapsed_ms:Date.now()-start,peak_rss_bytes:peak,minimum_free_bytes:Number.isFinite(minimum)?minimum:null},e.exit||1);}
const signature=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
async function stat(p){try{return await fs.lstat(p,{bigint:true});}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function main(){
 if(process.platform!=='win32')throw error('Windows-only');
 const args=process.argv.slice(1);if(args.length!==2||!/^(0|[1-9][0-9]*)$/.test(args[0])||!(args[1]==='-'||/^[a-f0-9]{64}$/.test(args[1])))throw error('invalid-chunk-arguments');
 const offset=Number(args[0]),expected=args[1];if(!Number.isSafeInteger(offset)||(offset>0&&expected==='-'))throw error('missing-chunk-identity');
 os.setPriority(process.pid,os.constants.priority.PRIORITY_BELOW_NORMAL);
 if(os.getPriority(process.pid)!==os.constants.priority.PRIORITY_BELOW_NORMAL)throw error('priority-not-set');
 check();timer=setInterval(()=>{try{check();}catch(e){stop(e);}},100);hard=setTimeout(()=>stop(error('deadline',124)),Math.max(1,15000-(Date.now()-start)));
 const parents=['F:/','F:/Dev',root,coord,native,nativeSuper,app,appSuper],parentStates=[];
 for(const p of parents){check();const s=await stat(p);if(s&&(s.isSymbolicLink()||!s.isDirectory()))throw error('unsafe-parent');parentStates.push([p,s?String(s.dev)+':'+String(s.ino):null]);}
 const files=[],stable=[];let total=0;
 for(const p of paths){
  check();const before=await stat(p);if(!before){files.push({path:p,present:false});stable.push([p,null]);continue;}
  if(before.isSymbolicLink()||!before.isFile())throw error('unsafe-file');
  if(before.size>2097152n||before.size<0n||total+Number(before.size)>4194304)throw error('raw-size-cap');
  const handle=await fs.open(p,'r');let raw;
  try{const held=await handle.stat({bigint:true});if(signature(held)!==signature(before))throw error('file-changed-before-read');raw=Buffer.alloc(Number(before.size));let at=0;while(at<raw.length){check();const read=await handle.read(raw,at,raw.length-at,at);if(read.bytesRead===0)throw error('short-read');at+=read.bytesRead;}check();if(raw.length!==Number(before.size)||signature(await handle.stat({bigint:true}))!==signature(before))throw error('file-changed-during-read');}finally{await handle.close();}
  const after=await stat(p);if(!after||signature(after)!==signature(before))throw error('file-changed-after-read');
  total+=raw.length;files.push({path:p,present:true,bytes:raw.length,sha256:sha(raw),base64:raw.toString('base64')});stable.push([p,signature(before)]);check();
 }
 for(const [p,identity] of parentStates){const s=await stat(p);if((s?String(s.dev)+':'+String(s.ino):null)!==identity||(s&&(s.isSymbolicLink()||!s.isDirectory())))throw error('parent-changed');}
 for(const [p,identity] of stable){check();const s=await stat(p);if((s?signature(s):null)!==identity||(s&&(s.isSymbolicLink()||!s.isFile())))throw error('snapshot-changed');}
 const payload=Buffer.from(JSON.stringify({schema_version:1,scope:'document-publications-fixed6-raw',files}),'utf8');check();
 const packed=await new Promise((resolve,reject)=>z.gzip(payload,{level:1},(e,b)=>e?reject(e):resolve(b)));check();
 const digest=sha(packed);if(expected!=='-'&&expected!==digest)throw error('package-changed');if(offset>=packed.length)throw error('chunk-out-of-range');
 const part=packed.subarray(offset,Math.min(packed.length,offset+block)),base64=part.toString('base64');check();
 emit({schema_version:1,status:offset===0&&part.length===packed.length?'complete':'chunk',encoding:'gzip+base64',scope:'document-publications-fixed6-raw',offset_bytes:offset,chunk_bytes:part.length,chunk_sha256:sha(part),total_bytes:packed.length,package_sha256:digest,next_offset_bytes:offset+part.length<packed.length?offset+part.length:null,uncompressed_bytes:payload.length,uncompressed_sha256:sha(payload),raw_file_bytes:total,files:files.map(({base64,...m})=>m),node:process.version,priority:'BelowNormal',node_heap_mib:64,elapsed_ms:Date.now()-start,peak_rss_bytes:peak,minimum_free_bytes:minimum,resource_samples:samples,payload_base64:base64},0);
}
main().catch(stop);

