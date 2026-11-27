import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  PIN, canonical, digest, checkpoint, databaseSnapshot, requireAbsentDatabase,
  verifyRestoredCorpus, verifyRestoredDatabase, verifyPromotedPrevious,
  parseIndexEntries, verifyPublicationIndex, ORIGINAL_CHECKOUT, originalManifest,
  verifyOriginalCheckout, verifyOriginalRetention, verifyOriginalRawPromotion, verifyInitialPublicationIndex,
} from './checkpoint-only-handoff-crlf-20261127.mjs';

// A single disposable qualification of the observed checkpoint-only recovery.
// It uses the already-qualified release and public original records; every
// native write is beneath a fresh caller-selected cloud scratch directory.
const options=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,args)=>{
  if(index%2===0){assert.match(value,/^--[a-z-]+$/);assert.ok(args[index+1]);pairs.push([value.slice(2),args[index+1]]);}return pairs;
},[]));
assert.equal(process.argv.slice(2).length,12);
assert.equal(process.version,'v25.2.1');assert.ok(process.execArgv.includes('--max-old-space-size=128'));
const repository=path.resolve(options.repository);
const binary=path.resolve(options.binary),original=path.resolve(options.original),config=path.resolve(options.config),planFile=path.resolve(options.plan),output=path.resolve(options.output);
const binaryHash=digest(fs.readFileSync(binary));
assert.equal(binaryHash,'fa0514a3d105d8951d2bc302c1f4ce46fb9e6ed4be21a2a89300d16b77a1ac1c');
assert.equal(process.platform,'linux','This retained qualification binds the accepted Linux artifact');
assert.equal(digest(fs.readFileSync(planFile)),PIN.planSha);
assert.ok(!fs.existsSync(output));fs.mkdirSync(output);
const started=Date.now(),deadline=started+180000,steps=[];
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const hash=file=>digest(fs.readFileSync(file));
const equal=(a,b,message)=>assert.equal(canonical(a),canonical(b),message);
const env={...process.env};
for(const key of Object.keys(env))if(key.toLowerCase().startsWith('git_') || ['beads_repo','bead_workspace_root','node_options','node_path'].includes(key.toLowerCase()))delete env[key];
env.GIT_OPTIONAL_LOCKS='0';
const run=(cwd,args,label,{git=false,json=true,expectFailure=false}={})=>{
  assert.ok(cwd.startsWith(output+path.sep));assert.ok(Date.now()<deadline);
  assert.equal(hash(binary),binaryHash);
  const result=spawnSync(git?'git':binary,args,{cwd,env,shell:false,windowsHide:true,timeout:Math.min(30000,deadline-Date.now()),maxBuffer:16*1024*1024});
  fs.writeFileSync(path.join(output,label+'.stdout'),result.stdout||Buffer.alloc(0),{flag:'wx'});
  fs.writeFileSync(path.join(output,label+'.stderr'),result.stderr||Buffer.alloc(0),{flag:'wx'});
  const step={label,args,cwd,program:git?'git':binary,status:result.status,error:result.error?.message||null};steps.push(step);save(label+'.exit.json',step);
  assert.equal(result.error,undefined);if(expectFailure)assert.notEqual(result.status,0,label);else assert.equal(result.status,0,label);
  if(expectFailure)return result.stderr.toString('utf8');
  return json?JSON.parse(result.stdout.toString('utf8')):result.stdout.toString('utf8');
};
const git=(cwd,args,label)=>run(cwd,['--no-optional-locks',...args],label,{git:true,json:false});
const indexState=(cwd,label)=>{
  const indexPath=git(cwd,['rev-parse','--path-format=absolute','--git-path','index'],label+'-index-path').trim();
  const before=hash(indexPath),entries={};
  for(const row of git(cwd,['ls-tree','-r','-l','-z','HEAD:.beads/checkpoint'],label+'-tree-entries').split('\0').filter(Boolean)){
    const match=/^(100644) blob ([a-f0-9]{40}) +([0-9]+)\t(.+)$/.exec(row);assert.ok(match);entries[match[4]]={mode:match[1],blob:match[2],bytes:Number(match[3])};
  }
  const value={head:git(cwd,['rev-parse','HEAD'],label+'-head').trim(),checkpoint_tree:git(cwd,['rev-parse','HEAD:.beads/checkpoint'],label+'-tree').trim(),
    entries,index_path:indexPath,index_sha256:before,
    index_entries:parseIndexEntries(git(cwd,['ls-files','--stage','-z'],label+'-entries')),
    status:git(cwd,['-c','status.renames=false','status','--porcelain=v1','-z','--untracked-files=all','--','.beads/checkpoint'],label+'-status')};
  assert.equal(hash(indexPath),before);save(label+'.json',value);return value;
};
const makeWorkspace=name=>{const directory=path.join(output,name);fs.mkdirSync(directory);fs.mkdirSync(path.join(directory,'.beads'));fs.copyFileSync(config,path.join(directory,'.beads/config.json'));return directory;};
const nativeRestore=(target,source,cp,actor,label)=>{
  const window={started_ms:Date.now()};
  const report=run(target,['restore','--source',source,'--generation',cp.pointer.generation_id,'--actor',actor,'--prefix','beadrs','--format','json'],label);
  window.finished_ms=Date.now();return {report,window};
};
const aligned=(cwd,cp,label)=>{
  const status=run(cwd,['sync','status','--format','json'],label);
  assert.equal(status.relationship,'aligned');assert.equal(status.dirty,false);assert.equal(status.checkpoint_consistent,true);assert.equal(status.root_verified,true);
  assert.equal(status.covered_sequence,status.live_sequence);assert.equal(status.live_sequence,cp.pointer.snapshot_sequence);
  assert.equal(status.generation_id,cp.pointer.generation_id);assert.equal(status.root_hash,cp.pointer.active_root.sha256);assert.deepEqual(status.unresolved_tombstones,[]);
};
try {
  let originalBefore=checkpoint(original);const originalFingerprint=digest(originalBefore);
  assert.equal(originalBefore.pointer.generation_id,PIN.originalGeneration);assert.equal(originalBefore.pointer.snapshot_sequence,29609);
  assert.equal(originalBefore.pointer.active_root.sha256,PIN.originalRoot);
  assert.deepEqual(Object.fromEntries(Object.entries(originalBefore.corpus).map(([k,v])=>[k,Object.keys(v).length])),{issue:954,event:11264,provenance_receipt:5,attempt_outcome:413});
  const configHash=hash(config);
  const source=makeWorkspace('synthetic-continuation');
  run(source,['--no-auto-flush','init','--prefix','beadrs'],'source-init',{json:false});
  nativeRestore(source,original,originalBefore,'checkpoint-only-cloud-source','source-original-restore');
  const plan=JSON.parse(fs.readFileSync(planFile,'utf8')),remaining=new Set(plan.tasks.map(t=>t.key)),ordered=[];
  while(remaining.size){const next=[...remaining].find(key=>plan.blocking_edges.filter(e=>e.blocked===key).every(e=>!remaining.has(e.blocker)));assert.ok(next);ordered.push(next);remaining.delete(next);}
  const operations=[...plan.tasks.map(task=>({op:'create',local_id:task.key,title:task.title,description:task.description,issue_type:'task',priority:2,
    resource_keys:task.resource_keys,labels:['checkpoint-only-cloud-qualification']})),
    ...plan.blocking_edges.map(edge=>({op:'dep_add',blocked:'$'+edge.blocked,blocker:'$'+edge.blocker,kind:'blocks'})),
    ...ordered.filter(key=>key!=='preserve-and-clean').map(key=>({op:'close',id:'$'+key,reason:'Disposable cloud qualification fixture; this operation does not represent acceptance or closure of a real continuation task.'}))];
  const manifest=path.join(output,'fixture-manifest.json');save('fixture-manifest.json',{manifest_version:1,operations});
  const created=run(source,['--no-auto-flush','manifest','commit','--input',manifest,'--format','json'],'source-fixture-manifest');
  assert.equal(created.committed,true);assert.equal(created.operations,200);
  run(source,['sync','flush-only'],'source-flush',{json:false});
  let sourceCheckpoint=path.join(source,'.beads/checkpoint'),incoming=checkpoint(sourceCheckpoint),sourceDB=await databaseSnapshot(path.join(source,'.beads/beads.db'));
  assert.equal(incoming.pointer.issue_count,1009);assert.equal(incoming.pointer.attempt_outcome_count,413);assert.ok(incoming.pointer.snapshot_sequence<29609);
  for(const type of Object.keys(originalBefore.corpus))for(const [id,value] of Object.entries(originalBefore.corpus[type]))assert.equal(incoming.corpus[type][id],value);
  save('source-checkpoint.json',{pointer:incoming.pointer,files:incoming.files});save('source-database.json',sourceDB);
  const target=makeWorkspace('checkpoint-only-original'),targetCheckpoint=path.join(target,'.beads/checkpoint');
  git(target,['init','--quiet'],'target-git-init');git(target,['config','user.name','Checkpoint qualification'],'target-git-name');git(target,['config','user.email','checkpoint-qualification@example.invalid'],'target-git-email');
  git(target,['config','core.autocrlf','true'],'target-git-autocrlf');
  const objectDirectory=fs.realpathSync(path.join(repository,'.git/objects'));assert.ok(fs.statSync(objectDirectory).isDirectory());
  fs.writeFileSync(path.join(target,'.git/objects/info/alternates'),objectDirectory+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(target,'.beads/.gitignore'),'beads.db*\ncheckpoint/publish.lock\n');
  fs.writeFileSync(path.join(target,'unrelated.txt'),'Unrelated Git entry must survive native recovery.\n');
  git(target,['add','--','.beads/config.json','.beads/.gitignore','unrelated.txt'],'target-git-add-unrelated');
  // Reuse the exact complete original checkpoint tree without checking out or
  // building unrelated product source. All 53 immutable blobs are present.
  git(target,['read-tree','--prefix=.beads/checkpoint/',PIN.originalCheckpointTree],'target-read-original-tree');
  git(target,['checkout-index','--all','--force'],'target-checkout-original-tree');
  git(target,['commit','--quiet','-m','Preserve exact original checkpoint fixture'],'target-git-commit');
  const gitBefore=indexState(target,'before');assert.equal(gitBefore.checkpoint_tree,PIN.originalCheckpointTree);
  assert.equal(Object.keys(gitBefore.entries).length,53);fs.copyFileSync(gitBefore.index_path,path.join(output,'original-index'));
  const gitConfigHash=hash(path.join(target,'.git/config')),rawManifest=verifyOriginalCheckout(targetCheckpoint);
  const rawRetained=path.join(output,'original-raw-retained'),canonicalRetained=path.join(output,'original-canonical-retained');
  fs.mkdirSync(rawRetained);fs.mkdirSync(canonicalRetained);let selectedNumber=0;
  for(const [relative,item] of Object.entries(ORIGINAL_CHECKOUT)){
    const rawFile=path.join(rawRetained,relative),canonicalFile=path.join(canonicalRetained,relative);
    fs.mkdirSync(path.dirname(rawFile),{recursive:true});fs.mkdirSync(path.dirname(canonicalFile),{recursive:true});
    fs.copyFileSync(path.join(targetCheckpoint,relative),rawFile);
    const label='canonical-blob-'+(++selectedNumber);git(target,['cat-file','blob',item.blob],label);fs.copyFileSync(path.join(output,label+'.stdout'),canonicalFile);
  }
  save('original-retention-proof.json',verifyOriginalRetention(rawRetained,canonicalRetained,gitBefore.entries));
  {
    let canonicalOriginal=checkpoint(canonicalRetained);equal(canonicalOriginal,originalBefore);
    let canonicalPrevious=checkpoint(canonicalRetained,'previous.json');save('canonical-previous.json',{pointer:canonicalPrevious.pointer,files:canonicalPrevious.files});canonicalPrevious=null;
    const rejectedTarget=makeWorkspace('raw-original-refusal');
    const rawError=run(rejectedTarget,['restore','--source',rawRetained,'--generation',PIN.originalGeneration,'--actor',PIN.restoreActor,'--prefix','beadrs','--format','json'],'raw-original-restore-refused',{json:false,expectFailure:true});
    assert.match(rawError,/hash|checksum|digest|content.addressed/i);requireAbsentDatabase(path.join(rejectedTarget,'.beads'));
    const canonicalTarget=makeWorkspace('canonical-original-restore-check');
    const canonicalRestoration=nativeRestore(canonicalTarget,canonicalRetained,canonicalOriginal,PIN.restoreActor,'canonical-original-restore');
    let canonicalRestored=checkpoint(path.join(canonicalTarget,'.beads/checkpoint'));
    save('canonical-original-audit.json',verifyRestoredCorpus(canonicalOriginal,canonicalRestored,canonicalRestoration.report,PIN.restoreActor));
    aligned(canonicalTarget,canonicalRestored,'canonical-original-status');
    canonicalOriginal=null;canonicalRestored=null;
  }
  equal(verifyOriginalCheckout(targetCheckpoint),rawManifest);equal(indexState(target,'after-canonical-check'),gitBefore);assert.equal(hash(path.join(target,'.git/config')),gitConfigHash);

  requireAbsentDatabase(path.join(target,'.beads'));
  run(target,['--no-auto-flush','init','--prefix','beadrs'],'target-empty-init',{json:false});
  const empty=await databaseSnapshot(path.join(target,'.beads/beads.db'));
  assert.equal(empty.local_sequence,0);assert.equal(Object.keys(empty.issueRows).length,0);assert.equal(Object.keys(empty.events).length,0);assert.equal(Object.keys(empty.receipts).length,0);
  equal(verifyOriginalCheckout(targetCheckpoint),rawManifest);assert.equal(hash(path.join(target,'.beads/config.json')),configHash);equal(indexState(target,'after-init'),gitBefore);
  const recovery=nativeRestore(target,sourceCheckpoint,incoming,PIN.actor,'target-full-restore');
  let recovered=checkpoint(targetCheckpoint),restoredDB=await databaseSnapshot(path.join(target,'.beads/beads.db'));
  const audit=verifyRestoredCorpus(incoming,recovered,recovery.report,PIN.actor);verifyRestoredDatabase(sourceDB,restoredDB,recovered,recovery.window);
  save('raw-promotion-proof.json',verifyOriginalRawPromotion(targetCheckpoint,rawRetained,canonicalRetained,gitBefore.entries));aligned(target,recovered,'target-status');
  assert.ok(recovered.pointer.snapshot_sequence<29609,'The recovered local sequence must demonstrate the observed high-covered case');
  const gitAfter=indexState(target,'after-restore');const staging=verifyInitialPublicationIndex(gitBefore,gitAfter,targetCheckpoint,rawRetained,canonicalRetained);
  save('restore-audit.json',audit);save('restored-database.json',restoredDB);save('staging-reconciliation.json',staging);
  const unrelated=structuredClone(gitAfter);unrelated.index_entries['unrelated.txt'].blob='0'.repeat(40);assert.throws(()=>verifyInitialPublicationIndex(gitBefore,unrelated,targetCheckpoint,rawRetained,canonicalRetained),/unrelated index entry/);
  assert.equal(hash(path.join(target,'.beads/config.json')),configHash);assert.equal(digest(checkpoint(original)),originalFingerprint);equal(await databaseSnapshot(path.join(source,'.beads/beads.db')),sourceDB);
  assert.throws(()=>verifyPublicationIndex(gitBefore,gitAfter,targetCheckpoint),/Staged checkpoint bytes differ/,'The old strict initial verifier must demonstrate the actual CRLF mismatch');
  const wrongBlob=structuredClone(gitAfter);wrongBlob.index_entries['.beads/checkpoint/previous.json'].blob='0'.repeat(40);
  assert.throws(()=>verifyInitialPublicationIndex(gitBefore,wrongBlob,targetCheckpoint,rawRetained,canonicalRetained),/exact canonical original current blob/);
  const rawCurrent=fs.readFileSync(path.join(rawRetained,'current.json'));fs.appendFileSync(path.join(rawRetained,'current.json'),' ');
  assert.throws(()=>verifyOriginalRetention(rawRetained,canonicalRetained,gitBefore.entries),/Observed original CRLF checkpoint bytes changed/);
  fs.writeFileSync(path.join(rawRetained,'current.json'),rawCurrent);
  const newCurrent=fs.readFileSync(path.join(targetCheckpoint,'current.json')),expandedCurrent=Buffer.from(newCurrent.toString('utf8').replaceAll('\n','\r\n'));
  assert.notEqual(digest(expandedCurrent),digest(newCurrent),'Refusal fixture must actually change bytes');fs.writeFileSync(path.join(targetCheckpoint,'current.json'),expandedCurrent);
  assert.throws(()=>verifyInitialPublicationIndex(gitBefore,gitAfter,targetCheckpoint,rawRetained,canonicalRetained),/Staged checkpoint bytes differ/,'New native files cannot use the old previous exception');
  fs.writeFileSync(path.join(targetCheckpoint,'current.json'),newCurrent);
  let changedEvent={...recovered,corpus:{...recovered.corpus,event:{...recovered.corpus.event,[PIN.uuid+':1']:'0'.repeat(64)}}};
  assert.throws(()=>verifyRestoredCorpus(incoming,changedEvent,recovery.report,PIN.actor),/Missing\/changed event/);changedEvent=null;
  assert.equal(hash(path.join(target,'.git/config')),gitConfigHash);
  save('initial-index-refusals.json',{status:'passed',cases:['old-strict-verifier','wrong-previous-blob','changed-preserved-pointer','new-current-normalization','unrelated-index-entry','changed-source-event']});
  const fixtureSummary={incoming_counts:{issues:incoming.pointer.issue_count,events:incoming.pointer.event_count,receipts:incoming.pointer.receipt_count,outcomes:incoming.pointer.attempt_outcome_count},recovered_local_sequence:recovered.pointer.snapshot_sequence,resource_locks_reconstructed:Object.keys(restoredDB.resourceLocks).length};
  // Actual Windows phases end their processes here. Release last-used fixture
  // graphs explicitly to reproduce those bounded lifetimes within this one run.
  originalBefore=null;incoming=null;sourceDB=null;restoredDB=null;
  // Exercise the later ordinary flush after the sole cleanup mutation.
  git(target,['commit','--quiet','-m','Publish recovered checkpoint fixture'],'target-recovery-commit');
  const beforeCleanup=indexState(target,'before-cleanup');
  const inventory=run(target,['list','--all','--json'],'target-inventory');const cleanup=inventory.find(row=>row.title===plan.tasks.find(task=>task.key==='preserve-and-clean').title);
  assert.ok(cleanup && cleanup.status==='open');
  save('cleanup-manifest.json',{manifest_version:1,operations:[{op:'close',id:cleanup.id,if_revision:cleanup.revision,reason:'Disposable cloud qualification cleanup fixture; no live task or original repository is modified.'}]});
  run(target,['--no-auto-flush','manifest','commit','--input',path.join(output,'cleanup-manifest.json'),'--format','json'],'target-cleanup-close');
  run(target,['sync','flush-only'],'target-final-flush',{json:false});
  const final=checkpoint(targetCheckpoint);assert.equal(final.pointer.event_count,recovered.pointer.event_count+1);assert.equal(final.pointer.receipt_count,recovered.pointer.receipt_count);
  verifyPromotedPrevious(recovered,checkpoint(targetCheckpoint,'previous.json'));aligned(target,final,'target-final-status');
  const finalGit=indexState(target,'after-final-flush');save('final-staging-reconciliation.json',verifyPublicationIndex(beforeCleanup,finalGit,targetCheckpoint));
  assert.throws(()=>verifyInitialPublicationIndex(beforeCleanup,finalGit,targetCheckpoint,rawRetained,canonicalRetained),/immutable original tree/,'Initial exception is unavailable for the final generation');
  assert.equal(hash(path.join(target,'.git/config')),gitConfigHash);recovered=null;
  const restoredCheck=makeWorkspace('final-restore-check');run(restoredCheck,['--no-auto-flush','init','--prefix','beadrs'],'final-check-init',{json:false});
  const finalDB=await databaseSnapshot(path.join(target,'.beads/beads.db')),last=nativeRestore(restoredCheck,targetCheckpoint,final,PIN.restoreActor,'final-check-restore');
  const lastCheckpoint=checkpoint(path.join(restoredCheck,'.beads/checkpoint'));verifyRestoredCorpus(final,lastCheckpoint,last.report,PIN.restoreActor);
  verifyRestoredDatabase(finalDB,await databaseSnapshot(path.join(restoredCheck,'.beads/beads.db')),lastCheckpoint,last.window);aligned(restoredCheck,lastCheckpoint,'final-check-status');
  // Focused refusal checks cover the new mutation and staging boundaries.
  assert.throws(()=>requireAbsentDatabase(path.join(target,'.beads')),/requires absent/);
  const sidecar=path.join(output,'sidecar-refusal');fs.mkdirSync(sidecar);fs.writeFileSync(path.join(sidecar,'beads.db-wal'),'retained');assert.throws(()=>requireAbsentDatabase(sidecar),/requires absent/);
  assert.equal(digest(checkpoint(original)),originalFingerprint);assert.equal(hash(config),configHash);
  save('result.json',{schema_version:1,status:'passed',scope:'Disposable actual-CRLF original recovery, canonical old-generation restore and both native publications with exact 53-object original tree and synthetic accepted-plan shape',
    source_commit:PIN.sourceCommit,binary_sha256:binaryHash,helper_sha256:hash(fileURLToPath(new URL('./checkpoint-only-handoff-crlf-20261127.mjs',import.meta.url))),qualification_sha256:hash(fileURLToPath(import.meta.url)),
    exec_argv:process.execArgv,node_version:process.version,observed_original_raw_manifest:rawManifest,canonical_original_manifest:originalManifest(false),core_autocrlf:'true',git_config_unchanged:true,
    original_counts:{issues:954,events:11264,receipts:5,outcomes:413},original_covered_sequence:29609,
    incoming_counts:fixtureSummary.incoming_counts,
    recovered_local_sequence:fixtureSummary.recovered_local_sequence,restore_added_events:1,restore_added_receipts:1,resource_locks_reconstructed:fixtureSummary.resource_locks_reconstructed,
    all_issue_scopes_compared:1009,checkpoint_only_index_delta_verified:true,original_raw_pointer_preserved_as_previous:true,raw_original_restore_refused:true,canonical_original_restore_passed:true,initial_previous_only_normalization_verified:true,final_flush_and_restore_passed:true,focused_refusals:10,
    duration_ms:Date.now()-started,commands:steps,pc_executed:false,actual_task_acceptance:false,cleanup:'Retain result/log hashes, then remove only this exact disposable output tree.'});
  console.log(JSON.stringify({status:'passed',output,duration_ms:Date.now()-started}));
} catch(error) {
  save('failure.json',{status:'failed',error:error.stack,commands:steps,duration_ms:Date.now()-started,pc_executed:false});throw error;
}
