import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PIN,ORIGINAL_CHECKOUT,checkpoint,digest,parseIndexEntries,reconcileRawCheckpointIndex,verifyInitialPublicationIndex,verifyPublicationIndex} from './candidate/checkpoint-only-handoff-crlf-20261127.mjs';

const base='/tmp/beads-02e8a44557c8-git-finalization';
const memory='/tmp/beads-02e8a44557c8-memory-engineering';
const repo=path.join(base,'fixture-repository'),cpdir=path.join(repo,'.beads/checkpoint');
assert.equal(fs.existsSync(repo),false);fs.mkdirSync(repo,{recursive:true});
const env={...process.env,GIT_OPTIONAL_LOCKS:'0'};
for(const k of Object.keys(env))if(k.startsWith('GIT_') && k!=='GIT_OPTIONAL_LOCKS')delete env[k];
const commands=[];
function git(args,input=null) {
  const r=spawnSync('git',['--no-optional-locks','-C',repo,...args],{env,input,encoding:'utf8',maxBuffer:4*1024*1024,timeout:30000});
  commands.push({args,input_bytes:input===null?0:Buffer.byteLength(input),exit:r.status,stdout_bytes:Buffer.byteLength(r.stdout||''),stderr:r.stderr||''});
  assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);return r.stdout;
}
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const tree=JSON.parse(fs.readFileSync(path.join(base,'original-checkpoint-tree.json'),'utf8'));
const originalEntries=Object.fromEntries(tree.tree.filter(x=>x.type==='blob').map(x=>[x.path,{mode:x.mode,blob:x.sha,bytes:x.size}]));
git(['init','--quiet']);git(['config','core.autocrlf','true']);git(['config','core.filemode','false']);git(['config','user.name','Disposable fixture']);git(['config','user.email','fixture@invalid.example']);
fs.writeFileSync(path.join(repo,'.git/info/exclude'),'/.beads/checkpoint/publish.lock\n');
for(const [name,item] of Object.entries(ORIGINAL_CHECKOUT))assert.equal(git(['hash-object','-w','--no-filters',path.join(memory,'fixture/original-canonical',name)]).trim(),item.blob);
const objectTree=git(['mktree','--missing'],tree.tree.filter(x=>x.path.startsWith('objects/')).map(x=>`${x.mode} blob ${x.sha}\t${x.path.slice(8)}\n`).join('')).trim();
assert.equal(objectTree,tree.tree.find(x=>x.path==='objects').sha);
const checkpointTree=git(['mktree','--missing'],tree.tree.filter(x=>!x.path.includes('/')).map(x=>`${x.mode} ${x.type} ${x.sha}\t${x.path}\n`).join('')).trim();
assert.equal(checkpointTree,PIN.originalCheckpointTree);
const beadsTree=git(['mktree'],`040000 tree ${checkpointTree}\tcheckpoint\n`).trim();
const oldUnrelated=git(['hash-object','-w','--stdin'],'unrelated baseline\n').trim();
const rootTree=git(['mktree'],`040000 tree ${beadsTree}\t.beads\n100644 blob ${oldUnrelated}\tunrelated.txt\n`).trim();
const head=git(['commit-tree',rootTree,'-m','Disposable exact checkpoint tree fixture']).trim();git(['update-ref','HEAD',head]);git(['read-tree','HEAD']);
const unrelated=git(['hash-object','-w','--stdin'],'unrelated staged change\n').trim();
git(['update-index','--cacheinfo',`100644,${unrelated},unrelated.txt`]);fs.writeFileSync(path.join(repo,'unrelated.txt'),'unrelated staged change\n');
const state=(entries=originalEntries)=>({head:git(['rev-parse','HEAD']).trim(),checkpoint_tree:git(['rev-parse','HEAD:.beads/checkpoint']).trim(),index_path:path.join(repo,'.git/index'),index_sha256:sha(path.join(repo,'.git/index')),index_entries:parseIndexEntries(git(['ls-files','--stage','-z'])),status:git(['-c','status.renames=false','status','--porcelain=v1','-z','--untracked-files=all','--','.beads/checkpoint']),entries});
// The accepted clean pre-publication status is a supplied prerequisite. Exact
// original tree/index entries are real; omitted historical blobs represent the
// 49 already-absent paths without fetching 412 MiB of unrelated old object data.
const before=state();before.status='';
fs.mkdirSync(path.dirname(cpdir),{recursive:true});
fs.cpSync(path.join(memory,'profiles/semispace4/original-target/.beads/checkpoint'),cpdir,{recursive:true});
for(const name of Object.keys(ORIGINAL_CHECKOUT).filter(x=>x.startsWith('objects/')))if(!fs.existsSync(path.join(cpdir,name)))fs.copyFileSync(path.join(memory,'fixture/original-raw',name),path.join(cpdir,name));
const current=checkpoint(cpdir),pending=state();
const counts=status=>Object.fromEntries([...new Set(status.split('\0').filter(Boolean).map(x=>x.slice(0,2)))].map(k=>[k,status.split('\0').filter(x=>x.slice(0,2)===k).length]));
assert.deepEqual(counts(pending.status),{' M':2,' D':49,'??':346});
const output=name=>{const x=path.join(base,'fixture-'+name);fs.mkdirSync(x);return x;};
const callback=out=>(args,label,stdin)=>{const result=git(args,stdin?fs.readFileSync(stdin):null);fs.writeFileSync(path.join(out,label+'.stdout'),result);return result;};
const rejected=[];
for(const [name,alter] of [
  ['unrelated-index-change',value=>{value.index_entries['unrelated.txt']={mode:'100644',blob:oldUnrelated};}],
  ['unverified-working-path',value=>{value.status+='?? .beads/checkpoint/unowned.json\0';}],
  ['selected-artifact-deletion',value=>{value.status+=' D .beads/checkpoint/objects/'+PIN.originalRoot+'.jsonl\0';}],
]) {
  const value=structuredClone(pending);alter(value);const out=output(name),indexBefore=sha(before.index_path);const count=commands.length;
  assert.throws(()=>reconcileRawCheckpointIndex(before,value,cpdir,current.files,callback(out),out,path.join(memory,'fixture/original-canonical')));
  assert.equal(sha(before.index_path),indexBefore);assert.equal(commands.length,count);rejected.push({case:name,pre_mutation_rejection:true,index_unchanged:true});
}
const rawPrevious=sha(path.join(cpdir,'previous.json')),initialOut=output('initial');
const initial=reconcileRawCheckpointIndex(before,pending,cpdir,current.files,callback(initialOut),initialOut,path.join(memory,'fixture/original-canonical'));
const after=state();assert.equal(digest(after.index_entries),initial.expected_index_entries_sha256);
const initialProof=verifyInitialPublicationIndex(before,after,cpdir,path.join(memory,'fixture/original-raw'),path.join(memory,'fixture/original-canonical'));
assert.equal(after.index_entries['unrelated.txt'].blob,unrelated);assert.equal(sha(path.join(cpdir,'previous.json')),rawPrevious);
assert.equal(after.index_entries['.beads/checkpoint/previous.json'].blob,ORIGINAL_CHECKOUT['current.json'].blob);
assert.deepEqual(counts(after.status),{'M ':2,'D ':49,'A ':346});
const initialCommit=git(['commit-tree',git(['write-tree']).trim(),'-p',head,'-m','Disposable initial checkpoint publication']).trim();git(['update-ref','HEAD',initialCommit]);
const finalEntries={};for(const row of git(['ls-tree','-r','-l','-z','HEAD:.beads/checkpoint']).split('\0').filter(Boolean)){const m=/^(100644) blob ([a-f0-9]{40}) +([0-9]+)\t(.+)$/.exec(row);assert.ok(m);finalEntries[m[4]]={mode:m[1],blob:m[2],bytes:Number(m[3])};}
const finalBefore=state(finalEntries);assert.equal(finalBefore.status,'');
const firstPointer=fs.readFileSync(path.join(cpdir,'current.json'));
const second=path.join(memory,'profiles/baseline/original-target/.beads/checkpoint');
const secondCheckpoint=checkpoint(second);
for(const name of Object.keys(secondCheckpoint.files)){const dest=path.join(cpdir,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(second,name),dest);}
fs.writeFileSync(path.join(cpdir,'previous.json'),firstPointer);
for(const name of Object.keys(ORIGINAL_CHECKOUT).filter(x=>x.startsWith('objects/')))fs.unlinkSync(path.join(cpdir,name));
const finalCurrent=checkpoint(cpdir),finalPending=state(finalEntries),finalOut=output('final');
const final=reconcileRawCheckpointIndex(finalBefore,finalPending,cpdir,finalCurrent.files,callback(finalOut),finalOut);
const finalAfter=state(finalEntries);assert.equal(digest(finalAfter.index_entries),final.expected_index_entries_sha256);
const finalProof=verifyPublicationIndex(finalBefore,finalAfter,cpdir);
assert.deepEqual(fs.readFileSync(path.join(cpdir,'previous.json')),firstPointer);
assert.equal(finalAfter.index_entries['unrelated.txt'].blob,unrelated);
const result={status:'passed',node:process.version,git:git(['--version']).trim(),helper_sha256:sha(path.join(base,'candidate/checkpoint-only-handoff-crlf-20261127.mjs')),
 scope:'Focused real-Git staging fixture with existing synthetic continuation checkpoint files; no native commands, product builds or resource benchmark.',
 precondition_scope:'The accepted clean source status is supplied as a prerequisite. The exact original checkpoint tree and index metadata are reconstructed, while 49 deleted historical blobs are intentionally absent. All pending and post-stage index/status observations are real Git.',
 initial:{pending:counts(pending.status),staged:counts(after.status),paths:initial.changed_paths.length,original_checkpoint_tree:checkpointTree,raw_previous_sha256:rawPrevious,staged_previous_blob:after.index_entries['.beads/checkpoint/previous.json'].blob,proof:initialProof},
 final:{pending:counts(finalPending.status),staged:counts(finalAfter.status),paths:final.changed_paths.length,proof:finalProof},
 pre_mutation_rejections:rejected,unrelated_index_entry_preserved:true,maximum_git_argv_bytes:Math.max(...commands.map(x=>Buffer.byteLength(['git','--no-optional-locks','-C',repo,...x.args].join(' ')))),
 mutating_staging_commands:commands.filter(x=>['hash-object','update-index'].includes(x.args[0]) && (x.args.includes('--stdin-paths') || x.args.includes('--index-info')))};
fs.writeFileSync(path.join(base,'candidate/qualification-result.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(base,'fixture-commands.json'),JSON.stringify(commands,null,2)+'\n');
console.log(JSON.stringify({status:result.status,initial_paths:result.initial.paths,final_paths:result.final.paths,max_argv_bytes:result.maximum_git_argv_bytes,rejections:rejected.length}));
