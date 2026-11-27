'use strict';
process.env.UV_THREADPOOL_SIZE='1';
const fs=require('node:fs/promises'),os=require('node:os'),crypto=require('node:crypto');
const task='F:/Dev/.bead-edit-20261111',retention=task+'/preservation-checkpoint-only-20261127-v1',phase=retention+'/phases/restore-original',original='F:/Dev/bead-rs',beads=original+'/.beads';
const start=Date.now(),seen=[],files=[],entries=[];let peak=0,minimum=Infinity,rawBytes=0,timer,hard,sent=false;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const signature=s=>s?[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':'):null;
async function stat(p){try{return await fs.lstat(p,{bigint:true})}catch(e){if(e.code==='ENOENT')return null;throw e}}
function check(){const rss=process.memoryUsage().rss,free=os.freemem();peak=Math.max(peak,rss);minimum=Math.min(minimum,free);if(Date.now()-start>=15000||rss>134217728||free<1073741824)throw Error('Resource bound')}
function emit(value,code){if(sent)return;sent=true;clearInterval(timer);clearTimeout(hard);const text=JSON.stringify(value)+'\n';if(Buffer.byteLength(text)>65000){process.exit(127);return}process.stdout.write(text,()=>process.exit(code))}
function stop(e){emit({status:'refused',reason:String(e.message),elapsed_ms:Date.now()-start,peak_rss_bytes:peak,minimum_free_bytes:Number.isFinite(minimum)?minimum:null},1)}
function record(p,s){seen.push([p,signature(s)]);return {path:p,present:!!s,...(s?{kind:s.isFile()?'file':s.isDirectory()?'directory':s.isSymbolicLink()?'symlink':'other',bytes:String(s.size),mtime_ns:String(s.mtimeNs)}:{})}}
async function inspect(p,mode){
 check();const s=await stat(p),v=record(p,s);if(!s||mode==='metadata'){files.push(v);return}
 if(!s.isFile()||s.isSymbolicLink())throw Error('Nonregular read target');
 const cap=mode==='raw'?32768:2097152;
 if(s.size>BigInt(cap)||(mode==='raw'&&rawBytes+Number(s.size)>32768)){v.content_omitted='bounded metadata only';files.push(v);return}
 const h=await fs.open(p,'r');let b;
 try{if(signature(await h.stat({bigint:true}))!==signature(s))throw Error('File changed before read');b=Buffer.alloc(Number(s.size));let at=0;while(at<b.length){check();const n=await h.read(b,at,b.length-at,at);if(!n.bytesRead)throw Error('Short read');at+=n.bytesRead}if(signature(await h.stat({bigint:true}))!==signature(s))throw Error('File changed during read')}finally{await h.close()}
 if(signature(await stat(p))!==signature(s))throw Error('File changed after read');v.sha256=hash(b);if(mode==='raw'){rawBytes+=b.length;v.base64=b.toString('base64')}files.push(v);check()
}
(async()=>{
 if(process.platform!=='win32')throw Error('Windows only');os.setPriority(0,os.constants.priority.PRIORITY_BELOW_NORMAL);check();timer=setInterval(()=>{try{check()}catch(e){stop(e)}},100);hard=setTimeout(()=>stop(Error('Deadline')),15000);
 for(const p of ['F:/','F:/Dev',task,retention,retention+'/phases',phase,original,beads,beads+'/checkpoint',original+'/.git']){const s=await stat(p);if(s&&(!s.isDirectory()||s.isSymbolicLink()))throw Error('Nonregular parent');record(p,s)}
 let truncated=false;const dir=await fs.opendir(phase,{bufferSize:16});for await(const entry of dir){check();if(entries.length===150){truncated=true;break}const s=await stat(phase+'/'+entry.name);entries.push([entry.name,s?.isFile()?'file':s?.isDirectory()?'directory':'other',s?String(s.size):null]);record(phase+'/'+entry.name,s)}
 for(const p of [beads+'/checkpoint/current.json',beads+'/checkpoint/previous.json',beads+'/config.json'])await inspect(p,'raw');
 for(const p of [original+'/.git/index',original+'/.git/config',beads+'/.gitignore'])await inspect(p,'hash');
 for(const n of ['beads.db','beads.db-wal','beads.db-shm','beads.db-journal','operation.lock'])await inspect(beads+'/'+n,'metadata');
 for(const p of [beads+'/checkpoint/publish.lock',original+'/.git/index.lock',retention+'/published'])await inspect(p,'metadata');
 const small=['authority-transfer-intended.json','mutation-attempt.json','init.started.json','init.exit.json','init.stdout','init.stderr','restore-original.started.json','restore-original.exit.json','restore-original.stdout','restore-original.stderr','status.started.json','status.exit.json','status.stdout','status.stderr','checkpoint-index-reconciliation.json','authority-transfer-complete.json','result.json','failure.json','restore-audit.json','retained-original-generation.json','previous-generation-diagnostic.json','initialized-empty-database.json'];
 for(const n of small)await inspect(phase+'/'+n,'raw');
 for(const n of ['after.json','original-git-before.json','original-git-after-init.json','original-git-after.json','inventory.stdout','inventory.json'])await inspect(phase+'/'+n,'metadata');
 for(const [p,s]of seen){check();if(signature(await stat(p))!==s)throw Error('Snapshot changed')}
 emit({status:'complete',scope:'restore-original-interruption-read-only',phase_entries:entries,phase_entries_truncated:truncated,files,raw_bytes:rawBytes,priority:'BelowNormal',node_heap_mib:64,elapsed_ms:Date.now()-start,peak_rss_bytes:peak,minimum_free_bytes:minimum},0)
})().catch(stop);
