import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PIN,canonical,digest,checkpoint,databaseSnapshot,selectedManifest,retainCheckpoint,inventoryMap,verifyOriginalRetention,verifyOriginalRawPromotion,verifyRestoreReport,verifyRestoredCorpus,verifyRestoredDatabase} from './checkpoint-measurement-import.mjs';

// Cloud-only memory reproduction of the allocation-bearing restore-original
// path. Native source, checkpoint validation and audit functions are unchanged.
// Git guards are not rerun: their small immutable maps are not the memory risk.
const root=path.dirname(fileURLToPath(import.meta.url)),fixture=path.join(root,'fixture');
const [name]=process.argv.slice(2);assert.match(name,/^[a-z0-9-]+$/);assert.equal(process.version,'v25.2.1');
const output=path.join(root,'profiles',name);assert.ok(!fs.existsSync(output));fs.mkdirSync(output,{recursive:true});
const hashFile=file=>{const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024),hash=createHash('sha256');try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,n));return hash.digest('hex');}finally{fs.closeSync(fd);}};
const nodeHash=hashFile(process.execPath);assert.equal(nodeHash,'ff2d367cbba86845f4634df2197955188549a129f486b88e955fac037ab29950');
const binary=path.join(root,'bead-linux');assert.equal(hashFile(binary),'fa0514a3d105d8951d2bc302c1f4ce46fb9e6ed4be21a2a89300d16b77a1ac1c');
const started=Date.now(),samples=[],commands=[];
const metric=(label)=>{const sample={label,elapsed_ms:Date.now()-started,...process.memoryUsage(),heap_size_limit:v8.getHeapStatistics().heap_size_limit,max_rss_bytes:process.resourceUsage().maxRSS*1024,spaces:v8.getHeapSpaceStatistics().map(x=>({name:x.space_name,size:x.space_size,used:x.space_used_size,physical:x.physical_space_size}))};samples.push(sample);fs.appendFileSync(path.join(output,'memory.jsonl'),JSON.stringify(sample)+'\n');};
const write=(name,value)=>fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const equal=(a,b,message)=>assert.equal(canonical(a),canonical(b),message);
const snapshot=async(file,label)=>{const value=await databaseSnapshot(file);write(label,value);metric(label);return value;};
const sourceDirectory=path.join(fixture,'synthetic-continuation'),sourcePath=path.join(sourceDirectory,'.beads/checkpoint'),sourceDB=path.join(sourceDirectory,'.beads/beads.db');
const raw=path.join(fixture,'original-raw'),original=path.join(fixture,'original-canonical');
const manifest=read(path.join(root,'fixture-manifest.json')),metadata=read(path.join(fixture,'memory-fixture.json'));
// Retain all 1,009 inventory rows, a conservative substitute for the 954-row
// original inventory plus plan/mapping live in the operational driver.
const baseline=read(path.join(fixture,'setup-inventory.stdout'));
const expectedManifest=digest(metadata.source_manifest);
const freezeCheck=()=>{assert.equal(digest(selectedManifest(sourcePath)),expectedManifest);assert.equal(digest(selectedManifest(sourcePath)),expectedManifest);return checkpoint(sourcePath);};
const target=path.join(output,'original-target'),targetDB=path.join(target,'.beads/beads.db'),targetCheckpoint=path.join(target,'.beads/checkpoint');
fs.mkdirSync(path.join(target,'.beads'),{recursive:true});fs.copyFileSync(path.join(fixture,'config.json'),path.join(target,'.beads/config.json'));fs.cpSync(raw,targetCheckpoint,{recursive:true,errorOnExist:true,force:false});
const env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase().startsWith('git_')||['beads_repo','bead_workspace_root','node_options','node_path'].includes(key.toLowerCase()))delete env[key];env.GIT_OPTIONAL_LOCKS='0';
const run=(args,label,json=true)=>{
  assert.ok(Date.now()-started<150000);metric(label+'-before-spawn');
  const stdoutPath=path.join(output,label+'.stdout'),stderrPath=path.join(output,label+'.stderr');
  const stdout=fs.openSync(stdoutPath,'wx'),stderr=fs.openSync(stderrPath,'wx');let result;
  try{result=spawnSync(binary,args,{cwd:target,env,windowsHide:true,shell:false,timeout:30000,stdio:['ignore',stdout,stderr]});}
  finally{fs.fsyncSync(stdout);fs.fsyncSync(stderr);fs.closeSync(stdout);fs.closeSync(stderr);}
  commands.push({label,args,status:result.status,error:result.error?.message||null});assert.equal(result.error,undefined);assert.equal(result.status,0,label+': '+fs.readFileSync(stderrPath,'utf8').slice(-1000));
  metric(label+'-after-spawn');const text=fs.readFileSync(stdoutPath,'utf8');return json?JSON.parse(text):text;
};
metric('inputs-loaded');
verifyOriginalRetention(raw,original,metadata.original_entries);metric('original-retention-verified');
const source=freezeCheck();metric('retained-source-checkpoint');
const frozenDB=read(path.join(fixture,'source-snapshot.json'));metric('retained-frozen-database');
equal(await databaseSnapshot(sourceDB),frozenDB,'Frozen database changed');metric('first-database-equality');
assert.equal(digest(selectedManifest(targetCheckpoint)),digest(selectedManifest(raw)));metric('original-selected-manifests');
const selectedBeforeGeneration=checkpoint(original).pointer.generation_id;metric('original-generation-checked');
run(['--no-auto-flush','init','--prefix','beadrs'],'init',false);
const empty=await snapshot(targetDB,'initialized-empty-database');
assert.equal(Object.keys(empty.issueRows).length,0);assert.equal(Object.keys(empty.events).length,0);assert.equal(Object.keys(empty.receipts).length,0);assert.equal(empty.local_sequence,0);assert.equal(Object.keys(empty.scopedRows).length,0);
for(const table of ['attempt_outcomes','saved_views','recurrence_templates','redaction_findings'])assert.equal(Object.keys(empty.tables[table]||{}).length,0);
assert.equal(digest(selectedManifest(targetCheckpoint)),digest(selectedManifest(raw)));metric('after-init-selected-manifests');
freezeCheck();metric('second-full-freeze-check');
equal(await databaseSnapshot(sourceDB),frozenDB,'Frozen source changed before restore');metric('second-database-equality');
const restoreWindow={started_ms:Date.now()};
const report=run(['restore','--source',sourcePath,'--generation',source.pointer.generation_id,'--actor',PIN.actor,'--prefix','beadrs','--format','json'],'restore-original');restoreWindow.finished_ms=Date.now();verifyRestoreReport(report,source,PIN.actor);
const cp=checkpoint(targetCheckpoint);metric('restored-checkpoint-live');
const status=run(['sync','status','--format','json'],'status');assert.equal(status.relationship,'aligned');assert.equal(status.dirty,false);assert.equal(status.checkpoint_consistent,true);assert.equal(status.root_verified,true);assert.equal(status.live_sequence,cp.pointer.snapshot_sequence);assert.equal(status.generation_id,cp.pointer.generation_id);assert.equal(status.root_hash,cp.pointer.active_root.sha256);
const audit=verifyRestoredCorpus(source,cp,report,PIN.actor);metric('restored-corpus-verified');
assert.notEqual(cp.pointer.generation_id,selectedBeforeGeneration);
const promoted=verifyOriginalRawPromotion(targetCheckpoint,raw,original,metadata.original_entries);metric('original-raw-promotion-verified');
const after=await snapshot(targetDB,'after');verifyRestoredDatabase(frozenDB,after,cp,restoreWindow);metric('overlapping-source-and-restored-audits');
const inventory=run(['list','--all','--json'],'inventory');assert.equal(inventory.length,1009);equal(inventoryMap(inventory),inventoryMap(baseline),'Restored full inventory differs');metric('full-inventory-equality');
freezeCheck();equal(await databaseSnapshot(sourceDB),frozenDB,'Restore changed source');metric('post-restore-freeze-and-database-equality');
const retained=retainCheckpoint(targetCheckpoint,path.join(output,'published-checkpoint'));metric('retained-published-checkpoint-live');
write('published-corpus',cp.corpus);write('published-manifest',retained.manifest);write('inventory',inventory);write('restore-audit',audit);write('retained-original-generation',promoted);metric('all-publication-records-written');
// Keep the maximum source/restored/retained checkpoint and database graphs live
// through the final sample instead of depending on optimizer liveness choices.
globalThis.memoryFixtureLiveGraphs={source,frozenDB,cp,after,inventory,retained,baseline,manifest,empty};
metric('maximum-live-graph-set');
write('result',{status:'passed',scope:'Linux allocation-bearing restore-original reproduction; exact qualified sources, synthetic 55-task continuation, no PC or Git publication',node_version:process.version,node_sha256:nodeHash,exec_argv:process.execArgv,heap_size_limit:v8.getHeapStatistics().heap_size_limit,source_counts:{issues:source.pointer.issue_count,events:source.pointer.event_count,receipts:source.pointer.receipt_count,attempt_outcomes:source.pointer.attempt_outcome_count},restored_counts:{issues:cp.pointer.issue_count,events:cp.pointer.event_count,receipts:cp.pointer.receipt_count,attempt_outcomes:cp.pointer.attempt_outcome_count},duration_ms:Date.now()-started,max_rss_bytes:process.resourceUsage().maxRSS*1024,commands,samples});
console.log(JSON.stringify({status:'passed',name,duration_ms:Date.now()-started,max_rss_bytes:process.resourceUsage().maxRSS*1024,heap_size_limit:v8.getHeapStatistics().heap_size_limit,final_memory:process.memoryUsage()}));
