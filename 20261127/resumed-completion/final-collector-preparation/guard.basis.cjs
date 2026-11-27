'use strict';
const f=require('node:fs'),c=require('node:crypto'),o=require('node:os'),p=require('node:path'),x=require('node:child_process');
const r='F:/Dev/bead-rs',g='C:/Program Files/Git/cmd/git.exe',start=Date.now(),seen=new Map();
let total=0,peak=0,minimum=Infinity;
const fail=s=>{throw Error(s);},sig=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');
function check(){const m=process.memoryUsage.rss(),a=o.freemem();peak=Math.max(peak,m);minimum=Math.min(minimum,a);if(Date.now()-start>=14000||m>134217728||a<1073741824)fail('resource-budget');}
function stat(q){try{return f.lstatSync(q,{bigint:true});}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function identity(q){check();const s=stat(q);if(!s){seen.set(q,null);return {exists:false,bytes:null,sha256:null};}if(s.isSymbolicLink()||!s.isFile()||s.size>67108864n)fail('file-shape-or-size');total+=Number(s.size);if(total>100663296)fail('aggregate-read-size');const h=c.createHash('sha256'),b=Buffer.alloc(65536),fd=f.openSync(q,'r');let read=0;try{if(sig(f.fstatSync(fd,{bigint:true}))!==sig(s))fail('file-changed');for(let n;(n=f.readSync(fd,b,0,b.length,null))>0;){read+=n;if(read>Number(s.size))fail('file-grew');h.update(b.subarray(0,n));check();}if(read!==Number(s.size)||sig(f.fstatSync(fd,{bigint:true}))!==sig(s))fail('file-changed');}finally{f.closeSync(fd);}seen.set(q,sig(s));return {exists:true,bytes:Number(s.size),sha256:h.digest('hex')};}
try{
 if(process.platform!=='win32')fail('Windows-only');o.setPriority(process.pid,o.constants.priority.PRIORITY_BELOW_NORMAL);if(o.getPriority(process.pid)!==o.constants.priority.PRIORITY_BELOW_NORMAL)fail('priority');check();
 for(const q of ['F:/','F:/Dev',r,r+'/.git',r+'/.beads']){const s=stat(q);if(!s||s.isSymbolicLink()||!s.isDirectory())fail('unsafe-parent');seen.set(q,sig(s));}
 if(identity(g).sha256!=='20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c')fail('Git-identity');
 const env={...process.env};for(const k of Object.keys(env))if(k.toLowerCase().startsWith('git_'))delete env[k];Object.assign(env,{GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',GIT_NO_LAZY_FETCH:'1',GIT_NO_REPLACE_OBJECTS:'1'});
 function git(a,optional=false){check();const t=x.spawnSync(g,['--no-optional-locks','-C',r,'-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1',...a],{env,windowsHide:true,shell:false,encoding:'utf8',timeout:Math.max(1,Math.min(2000,14000-(Date.now()-start))),maxBuffer:8192});check();if(t.error||!(t.status===0||optional&&t.status===1)||t.stderr)fail('Git-read-failed');return t.stdout.trim();}
 const head=git(['rev-parse','HEAD']),branch=git(['symbolic-ref','--quiet','HEAD']);
 const index=identity(r+'/.git/index'),config=identity(r+'/.git/config');
 const private_state=['config.json','.gitignore','beads.db','beads.db-wal','beads.db-shm','beads.db-journal'].map(n=>({path:'.beads/'+n,...identity(r+'/.beads/'+n)}));
 const fsmonitor=git(['config','--get','core.fsmonitor'],true).toLowerCase();if(!['','false','0'].includes(fsmonitor))fail('fsmonitor-needs-review');
 if(git(['config','--includes','--null','--name-only','--get-regexp','^hook\\.'],true))fail('configured-hooks-need-review');
 let hooks=git(['config','--path','--get','core.hooksPath'],true);if(!hooks)hooks=git(['rev-parse','--path-format=absolute','--git-path','hooks']);hooks=p.resolve(r,hooks);
 const accepted_hooks=[];for(const n of ['post-index-change','reference-transaction','post-merge','pre-push','pre-commit','prepare-commit-msg','commit-msg','post-commit']){const q=p.join(hooks,n),v=identity(q);if(v.exists)accepted_hooks.push({name:n,path:q,sha256:v.sha256});}
 for(const [q,s] of seen){check();const t=stat(q);if((t?sig(t):null)!==s)fail('snapshot-changed');}
 console.log(JSON.stringify({schema_version:1,status:'observed',utc:new Date().toISOString(),repository:r,head,branch,index_sha256:index.sha256,git_config_sha256:config.sha256,private_state,fsmonitor,configuration_hook_names:[],hook_directory:hooks,accepted_hooks,priority:'BelowNormal',elapsed_ms:Date.now()-start,peak_rss_bytes:peak,minimum_free_bytes:minimum}));
}catch(e){console.error(e.message);process.exitCode=1;}
