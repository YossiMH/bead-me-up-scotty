'use strict';
process.env.UV_THREADPOOL_SIZE='1';
const fs=require('node:fs/promises'),os=require('node:os');
const root='F:/Dev/bead-rs/.beads/checkpoint',start=Date.now(),parents=[],seen=[],entries=[],queue=[['',0]];
let peak=0,minimum=Infinity,timer,hard,sent=false;
const signature=s=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
function check(){const rss=process.memoryUsage().rss,free=os.freemem();peak=Math.max(peak,rss);minimum=Math.min(minimum,free);if(Date.now()-start>=15000||rss>134217728||free<1073741824)throw Error('Resource bound')}
function emit(v,code){if(sent)return;sent=true;clearInterval(timer);clearTimeout(hard);const text=JSON.stringify(v)+'\n';if(Buffer.byteLength(text)>65000){process.exit(127);return}process.stdout.write(text,()=>process.exit(code))}
function stop(e){emit({status:'refused',reason:String(e.message),observed_entries:entries.length,elapsed_ms:Date.now()-start,peak_rss_bytes:peak,minimum_free_bytes:Number.isFinite(minimum)?minimum:null},1)}
(async()=>{
 if(process.platform!=='win32')throw Error('Windows only');os.setPriority(0,os.constants.priority.PRIORITY_BELOW_NORMAL);check();timer=setInterval(()=>{try{check()}catch(e){stop(e)}},100);hard=setTimeout(()=>stop(Error('Deadline')),15000);
 for(const p of ['F:/','F:/Dev','F:/Dev/bead-rs','F:/Dev/bead-rs/.beads',root]){check();const s=await fs.lstat(p,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink())throw Error('Nonregular ancestor');parents.push([p,String(s.dev),String(s.ino)])}
 while(queue.length){
  check();const [relative,depth]=queue.shift(),path=relative?root+'/'+relative:root;
  const before=await fs.lstat(path,{bigint:true});if(!before.isDirectory()||before.isSymbolicLink())throw Error('Nonregular directory');seen.push([path,signature(before)]);
  const directory=await fs.opendir(path,{bufferSize:16});
  for await(const item of directory){
   check();if(entries.length>=256)throw Error('Entry bound');
   const rel=relative?relative+'/'+item.name:item.name,full=root+'/'+rel,s=await fs.lstat(full,{bigint:true});
   if(s.isSymbolicLink()||(!s.isFile()&&!s.isDirectory()))throw Error('Nonregular tree entry');
   const kind=s.isFile()?'file':'directory';entries.push([rel,kind,String(s.size),String(s.dev),String(s.ino),String(s.mode),String(s.nlink),String(s.mtimeNs),String(s.ctimeNs)]);seen.push([full,signature(s)]);
   if(s.isDirectory()){if(depth>=7)throw Error('Depth bound');queue.push([rel,depth+1])}
  }
 }
 for(const [p,dev,ino]of parents){check();const s=await fs.lstat(p,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||String(s.dev)!==dev||String(s.ino)!==ino)throw Error('Ancestor changed')}
 for(const [p,sig]of seen){check();if(signature(await fs.lstat(p,{bigint:true}))!==sig)throw Error('Tree changed')}
 entries.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 emit({status:'complete',scope:'original-checkpoint-metadata-only',root,columns:['relative_path','kind','bytes','device','inode','mode','links','mtime_ns','ctime_ns'],entries,entry_limit:256,maximum_entry_depth:8,ordinary_ancestors:true,stable_metadata:true,file_contents_read:0,priority:'BelowNormal',node_heap_mib:64,elapsed_ms:Date.now()-start,peak_rss_bytes:peak,minimum_free_bytes:minimum},0)
})().catch(stop);
