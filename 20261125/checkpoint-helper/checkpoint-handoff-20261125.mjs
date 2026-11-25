import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Root-only phase runner. Imports expose read-only verifiers for cloud checks.
// Future runtime/plan hashes are supplied only through accepted pinned records.
export const PIN = Object.freeze({
  original: 'F:/Dev/bead-rs',
  isolated: 'F:/Dev/.bead-edit-20261111/coordination-20261124',
  retention: 'F:/Dev/.bead-edit-20261111/preservation-20261125-v1',
  historicalBinarySha: '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798',
  historicalPlanSha: '887b5036b9b1f588baaeb9a0fd9537c030e661b80325bd871b6c8b97bfbae178',
  uuid: '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4',
  formatUuid: 'f6a8c2e0-6b1d-4b7a-9b3a-2e7a7c5e9a4f',
  originalGeneration: 'gen-a569f746bbb268015d996c8ed4c76f57',
  originalRoot: '4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d',
  cleanup: 'beadrs-3ec972f8',
  actor: 'chatgpt-bead-edit-20261125',
  restoreActor: 'chatgpt-bead-edit-restore-check-20261125',
});
const PHASES = ['preserve','freeze','source-restore','dry-run','merge','publish','restore','close','final-publish','final-restore'];
const COUNTS = {issue:'issue_count',event:'event_count',provenance_receipt:'receipt_count',attempt_outcome:'attempt_outcome_count'};
const HASH = /^[a-f0-9]{64}$/;
const MAX_FILE = 64 * 1024 * 1024;
export const canonical = value => JSON.stringify(value, (_, x) => {
  if (typeof x === 'bigint') return {bigint:x.toString()};
  if (x && typeof x === 'object' && !Array.isArray(x)) return Object.fromEntries(Object.keys(x).sort().map(k => [k,x[k]]));
  return x;
});
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file,'utf8'));
const equal = (a,b,message) => assert.equal(canonical(a),canonical(b),message);
function ordinary(file,directory=false) {
  const stat=fs.lstatSync(file);
  assert.ok(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()),'Nonordinary path: '+file);
  const actual=fs.realpathSync.native(file), expected=path.resolve(file);
  assert.equal(process.platform==='win32' ? actual.toLowerCase() : actual,process.platform==='win32' ? expected.toLowerCase() : expected,'Unexpected resolved path: '+file);
  if(!directory) assert.ok(stat.size<=MAX_FILE,'Input exceeds bounded size: '+file);
  return stat;
}
const bytes = file => {ordinary(file);return fs.readFileSync(file);};
const hashFile = file => digest(bytes(file));
function save(file,value) {
  const fd=fs.openSync(file,'wx');
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function copy(source,destination) {
  ordinary(source);fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);
  const fd=fs.openSync(destination,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function beneath(base,relative) {
  assert.equal(typeof relative,'string');
  assert.ok(relative && !relative.includes('\\') && !relative.includes(':') && relative.split('/').every(p=>p && p!=='.' && p!=='..'),'Unsafe checkpoint reference');
  const full=path.join(base,...relative.split('/'));ordinary(full);return full;
}
function contained(before,after,message) {
  for(const [key,value] of Object.entries(before)) assert.equal(after[key],value,message+': '+key);
}
const recordKey = (type,value) => type==='issue' ? value.id : type==='event' ? value.origin_store_uuid+':'+value.origin_event_sequence : value.receipt_id;
const emptyCorpus = () => ({issue:{},event:{},provenance_receipt:{},attempt_outcome:{}});
function sorted(value){return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0));}

// Complete selected-generation closure, with a separate native interchange hash.
// The original and accepted continuation contain no redaction records.
export function checkpoint(base,pointerName='current.json') {
  ordinary(base,true);const files={};
  const take=(relative,sha,length)=>{
    const data=bytes(beneath(base,relative)), actual=digest(data);
    if(sha!==undefined){assert.match(sha,HASH);assert.equal(actual,sha,'Object digest mismatch: '+relative);}
    if(length!==undefined) assert.equal(data.length,length,'Object length mismatch: '+relative);
    const item={sha256:actual,bytes:data.length};
    if(files[relative]) equal(files[relative],item,'Repeated object changed');
    files[relative]=item;return data;
  };
  const pointer=JSON.parse(take(pointerName));
  assert.equal(pointer.schema_version,1);assert.match(pointer.generation_id,/^gen-[a-f0-9]{32}$/);
  assert.equal(pointer.store_uuid,PIN.uuid);
  assert.ok(Number.isSafeInteger(pointer.snapshot_sequence) && pointer.snapshot_sequence>=0);
  assert.equal(pointer.redaction_record_count||0,0,'Unexpected redaction state needs independent review');
  const corpus=emptyCorpus(),issues={},details={event:{},provenance_receipt:{}},origins={};
  const interchange=createHash('sha256');
  const record=(line,allowed)=>{
    let value=JSON.parse(line);
    if(value.ref===true) {
      assert.equal(pointer.mode,'set-v2');assert.match(value.path,/^set\/rec\/[a-f0-9]{64}\.jsonl$/);
      assert.equal(path.basename(value.path,'.jsonl'),value.sha256);
      const data=take(value.path,value.sha256,value.byte_length), decoded=JSON.parse(data);
      assert.notEqual(decoded.ref,true,'Recursive oversize reference');assert.equal(decoded.record_type,value.record_type);
      // Native process_checkpoint_file hashes the complete resolved bytes plus
      // another LF; ordinary rows use their line bytes plus LF.
      interchange.update(data).update('\n');value=decoded;
    } else interchange.update(line).update('\n');
    const type=value.record_type;assert.ok(Object.hasOwn(corpus,type),'Unreviewed record class: '+type);
    if(allowed) assert.equal(type,allowed,'Artifact class mismatch');
    assert.deepEqual(Object.keys(value).sort(),['record_type',type].sort(),'Unexpected record envelope fields');
    const payload=value[type],key=recordKey(type,payload);
    assert.equal(typeof key,'string');assert.ok(key && !Object.hasOwn(corpus[type],key),'Duplicate record identity: '+key);
    corpus[type][key]=digest(payload);
    if(type==='issue') issues[key]=payload;
    if(type==='provenance_receipt') details[type][key]=payload;
    if(type==='event') {
      assert.equal(payload.origin_store_uuid,PIN.uuid,'Unexpected additional event origin');
      assert.ok(Number.isSafeInteger(payload.origin_event_sequence) && payload.origin_event_sequence>0);
      (origins[payload.origin_store_uuid] ||= []).push(payload.origin_event_sequence);
      if(payload.origin_event_sequence>11264) details.event[key]=payload;
    }
  };
  const lines=(data,allowed)=>{
    const text=new TextDecoder('utf-8',{fatal:true}).decode(data);let count=0;
    for(const line of text.split(/\r?\n/)) if(line.trim()){record(line,allowed);count++;}
    return count;
  };
  assert.match(pointer.active_root.sha256,HASH);
  if(pointer.mode==='monolithic') {
    assert.equal(pointer.active_root.path,'objects/'+pointer.active_root.sha256+'.jsonl');
    lines(take(pointer.active_root.path,pointer.active_root.sha256));
  } else {
    assert.equal(pointer.mode,'set-v2','Only observed monolithic and set-v2 layouts are reviewed');
    assert.equal(pointer.active_root.path,'set/manifest-'+pointer.generation_id+'.json');
    const manifest=JSON.parse(take(pointer.active_root.path,pointer.active_root.sha256));
    assert.equal(manifest.schema_version,1);assert.equal(manifest.format,'checkpoint-set-v2');assert.equal(manifest.profile,'native-v1');
    for(const key of ['store_uuid','snapshot_sequence','total_record_count',...Object.values(COUNTS)]) assert.equal(manifest[key]||0,pointer[key]||0,'Manifest/pointer mismatch: '+key);
    assert.equal(manifest.redaction_record_count||0,0);
    const seen=new Set();
    const artifact=(row,type,folder)=>{
      assert.ok(!seen.has(row.path),'Duplicate artifact reference');seen.add(row.path);
      if(folder==='tail') assert.ok(row.path==='set/tail.jsonl' || row.path==='set/tail/'+row.sha256+'.jsonl','Unexpected tail path');
      else assert.equal(row.path,'set/'+folder+'/'+row.sha256+'.jsonl');
      assert.equal(lines(take(row.path,row.sha256,row.byte_length),type),row.record_count??row.event_count,'Artifact record count');
    };
    assert.ok(Array.isArray(manifest.shards) && Array.isArray(manifest.segments));
    for(const row of manifest.shards){assert.ok(Object.hasOwn(COUNTS,row.class) && row.class!=='event');artifact(row,row.class,'shard');}
    for(const row of manifest.segments) artifact(row,'event','seg');
    if(manifest.tail!==null){assert.ok(manifest.tail);artifact(manifest.tail,'event','tail');}
  }
  let total=0;
  for(const [type,field] of Object.entries(COUNTS)){const n=Object.keys(corpus[type]).length;assert.equal(n,pointer[field]||0,'Pointer count: '+type);total+=n;}
  assert.equal(total,pointer.total_record_count);
  for(const values of Object.values(origins)) values.sort((a,b)=>a-b).forEach((n,i)=>assert.equal(n,i+1,'Noncontiguous event origin'));
  return {pointer,files:sorted(files),corpus,issues,details,interchange_sha256:interchange.digest('hex')};
}
function tree(base) {
  ordinary(base,true);const result={};let totalBytes=0;
  const walk=(directory,prefix)=>{
    for(const name of fs.readdirSync(directory).sort()) {
      const full=path.join(directory,name),relative=prefix+name,stat=fs.lstatSync(full);
      if(stat.isDirectory()){ordinary(full,true);walk(full,relative+'/');}
      else {ordinary(full);totalBytes+=stat.size;assert.ok(totalBytes<=MAX_FILE,'Checkpoint tree exceeds 64 MiB');result[relative]={bytes:stat.size,sha256:hashFile(full)};}
      assert.ok(Object.keys(result).length<=4096,'Checkpoint file-count bound');
    }
  };
  walk(base,'');return result;
}
function retainCheckpoint(source,destination) {
  const before=tree(source),current=checkpoint(source);
  let previous=null,previousVerification={status:'absent'};
  if(before['previous.json']) {
    try{previous=checkpoint(source,'previous.json');previousVerification={status:'passed',generation:previous.pointer.generation_id};}
    catch(error){previousVerification={status:'failed',error:error.message};}
  }
  fs.mkdirSync(destination,{recursive:false});
  for(const relative of Object.keys(before)) {
    const target=path.join(destination,...relative.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});
    copy(beneath(source,relative),target);
  }
  equal(tree(source),before,'Source changed during retention');equal(tree(destination),before,'Retained checkpoint differs');
  equal(checkpoint(destination).files,current.files,'Copied active closure differs');
  if(previous) equal(checkpoint(destination,'previous.json').files,previous.files,'Copied previous closure differs');
  return {checkpoint:current,manifest:before,previous_verification:previousVerification};
}

// Read-only private SQLite snapshots include every table and all original raw
// columns. Event preservation permits only native origin canonicalization at
// merge; rawEventRows additionally detects any dry-run or publication writes.
export async function databaseSnapshot(file) {
  ordinary(file);const {DatabaseSync}=await import('node:sqlite');
  const db=new DatabaseSync(file,{readOnly:true,timeout:1000,allowExtension:false});
  try {
    db.exec('PRAGMA query_only = ON');
    const version=db.prepare('PRAGMA data_version').get().data_version;db.exec('BEGIN');
    const workspace=db.prepare('SELECT * FROM workspace WHERE id=1').get();
    assert.equal(workspace.uuid,PIN.uuid);assert.equal(workspace.format_uuid,PIN.formatUuid);assert.equal(workspace.format_version,1);
    assert.equal(db.prepare('SELECT MAX(version) AS n FROM schema_migrations').get().n,22);
    const schema=db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
    const tables={},scopedRows={},sequenceCounters={},events={},eventRows={},rawEventRows={},receipts={},publicReceipts={},issueRows={};
    let next=db.prepare('SELECT COALESCE(MAX(origin_event_sequence),0)+1 AS n FROM events WHERE origin_store_uuid=?').get(PIN.uuid).n;
    for(const entry of schema.filter(value=>value.type==='table')) {
      assert.match(entry.name,/^[A-Za-z_][A-Za-z0-9_]*$/);const table={};
      for(const raw of db.prepare('SELECT * FROM "'+entry.name+'"'+(entry.name==='events'?' ORDER BY sequence':'')).iterate()) {
        const row={...raw};
        if(entry.name==='events') {
          rawEventRows[row.sequence]=digest(row);
          const uuid=row.origin_store_uuid,sequence=row.origin_event_sequence;
          if(uuid!==null && sequence!==null){/* preserve explicit native identity */}
          else if(uuid!==null && uuid!==PIN.uuid) row.origin_event_sequence=row.sequence;
          else {row.origin_store_uuid=PIN.uuid;row.origin_event_sequence=next++;}
          const value={'$schema':'urn:bead-rs:schema:event:native-v1',origin_store_uuid:row.origin_store_uuid,origin_event_sequence:row.origin_event_sequence,
            issue_id:row.issue_id,kind:row.kind,actor:row.actor??'system',time:row.time,detail:JSON.parse(row.detail),...JSON.parse(row.extensions_json||'{}')};
          const key=recordKey('event',value);assert.ok(!Object.hasOwn(events,key));events[key]=digest(value);
          if(row.origin_event_sequence>11264) eventRows[key]=value;
        }
        if(entry.name==='issues') issueRows[row.id]=row;
        if(entry.name==='provenance_receipts') {
          receipts[row.receipt_id]=row;
          const value={...row,'$schema':row.schema_ref,counts:JSON.parse(row.counts_json),...JSON.parse(row.extensions_json||'{}')};
          for(const key of ['schema_ref','counts_json','extensions_json']) delete value[key];
          publicReceipts[row.receipt_id]=digest(value);
        }
        if(entry.name==='sqlite_sequence') sequenceCounters[row.name]=row.seq;
        const h=digest(row);table[h]=(table[h]||0)+1;
        const scope=entry.name==='issues'?row.id:row.issue_id??row.blocked_issue_id;
        if(typeof scope==='string') {
          const scoped=((scopedRows[entry.name] ||= {})[scope] ||= {});
          scoped[h]=(scoped[h]||0)+1;
        }
      }
      tables[entry.name]=sorted(table);
    }
    const result={schema_sha256:digest(schema),tables,scopedRows,sequenceCounters,events,eventRows,rawEventRows,receipts,publicReceipts,issueRows,workspace,
      checkpoint_state:db.prepare('SELECT * FROM checkpoint_state WHERE id=1').get(),
      local_sequence:db.prepare('SELECT COALESCE(MAX(sequence),0) AS n FROM events').get().n};
    db.exec('ROLLBACK');assert.equal(db.prepare('PRAGMA data_version').get().data_version,version,'Concurrent database writer');return result;
  } finally {db.close();}
}
function compareOriginal(original,after,publication=false) {
  assert.equal(after.schema_sha256,original.schema_sha256,'SQLite schema changed');equal(after.workspace,original.workspace,'Workspace identity changed');
  assert.deepEqual(Object.keys(after.tables).sort(),Object.keys(original.tables).sort());
  for(const table of Object.keys(original.tables)) {
    if(table==='sqlite_sequence' || (publication && table==='checkpoint_state')) continue;
    for(const [h,n] of Object.entries(original.tables[table])) assert.ok((after.tables[table][h]||0)>=n,'Original row changed in '+table+': '+h);
  }
  if(publication) {
    const before={...original.checkpoint_state},actual={...after.checkpoint_state};
    for(const key of ['current_generation_id','current_mode','current_root_path','current_root_sha256','covered_event_sequence','changed_paths_json','updated_at']){delete before[key];delete actual[key];}
    equal(actual,before,'Unexpected checkpoint bookkeeping change');
  }
  contained(original.events,after.events,'Original canonical event changed');
}
function compareScoped(source,restored,newIds) {
  for(const table of Object.keys(source.scopedRows)) {
    if(table==='events') continue;
    for(const id of newIds) equal(source.scopedRows[table]?.[id]||{},restored.scopedRows[table]?.[id]||{},'Recovery loses task auxiliary rows: '+table+'/'+id);
  }
}
function compareMerge(original,source,after,newIds,incoming,receipt) {
  compareOriginal(original,after);
  for(const table of Object.keys(original.tables)) {
    if(['events','provenance_receipts','sqlite_sequence'].includes(table)) continue;
    const expected={...original.tables[table]};
    for(const id of newIds) for(const [h,n] of Object.entries(source.scopedRows[table]?.[id]||{})) expected[h]=(expected[h]||0)+n;
    equal(after.tables[table],expected,'Unrequested or missing merged SQLite rows: '+table);
  }
  assert.deepEqual(Object.keys(after.sequenceCounters).sort(),Object.keys(original.sequenceCounters).sort());
  for(const [name,value] of Object.entries(original.sequenceCounters)) if(name!=='events') assert.equal(after.sequenceCounters[name],value,'Other SQLite sequence changed');
  assert.equal(after.sequenceCounters.events,after.local_sequence);
  equal(after.publicReceipts,{...incoming.corpus.provenance_receipt,[receipt.receipt_id]:digest(receipt)},'Complete receipt set differs after merge');
}
function storedList(row) {
  const value=structuredClone(row);delete value.effective_status;
  for(const dep of value.dependencies||[]){delete dep.blocker_status;delete dep.finished;}
  return value;
}
const inventoryMap = values => Object.fromEntries(values.map(row=>[row.id,storedList(row)]));
function verifyPlan(list,plan,mapping,baseline,closed=false) {
  assert.equal(plan.tasks.length,31,'Revision-5 task count');const total=954+plan.tasks.length;
  assert.equal(list.length,total);const all=new Map(list.map(row=>[row.id,row]));assert.equal(all.size,total);
  assert.equal(baseline.length,954);assert.equal(new Set(baseline.map(row=>row.id)).size,954);
  for(const row of baseline) equal(storedList(all.get(row.id)),storedList(row),'Original issue changed: '+row.id);
  assert.equal(Object.keys(mapping.tasks).length,plan.tasks.length);assert.equal(new Set(Object.values(mapping.tasks)).size,plan.tasks.length);
  const ids=new Set(Object.values(mapping.tasks)),edges=[];
  assert.equal(new Set(plan.tasks.map(task=>task.key)).size,31);
  assert.deepEqual(Object.keys(mapping.tasks).sort(),plan.tasks.map(task=>task.key).sort());
  for(const row of baseline) assert.ok(!ids.has(row.id),'Continuation ID overlaps an original issue');
  for(const task of plan.tasks) {
    const row=all.get(mapping.tasks[task.key]);assert.ok(row,task.key);
    assert.equal(row.title,task.title);assert.equal(row.description,task.description);
    assert.equal(row.status,task.key==='preserve-and-clean' && !closed?'open':'closed');
    for(const dep of row.dependencies||[]) {
      assert.ok(ids.has(dep.blocker),'Continuation edge leaves accepted graph');
      assert.equal(dep.kind,'blocks');edges.push([row.id,dep.blocker,dep.kind]);
    }
  }
  const expected=plan.blocking_edges.map(edge=>[mapping.tasks[edge.blocked],mapping.tasks[edge.blocker],'blocks']);
  assert.equal(expected.length,mapping.blocking_edges);equal(edges.sort(),expected.sort(),'Continuation graph differs');
  assert.equal(mapping.tasks['preserve-and-clean'],PIN.cleanup);return all;
}
function statusAligned(value,pointer) {
  assert.equal(value.relationship,'aligned');assert.equal(value.dirty,false);assert.equal(value.checkpoint_consistent,true);assert.equal(value.root_verified,true);
  assert.equal(value.covered_sequence,value.live_sequence);assert.equal(value.generation_id,pointer.generation_id);assert.equal(value.root_hash,pointer.active_root.sha256);
  assert.equal(value.live_sequence,pointer.snapshot_sequence);assert.deepEqual(value.unresolved_tombstones,[]);
}
function subsetCorpus(before,after){for(const type of Object.keys(COUNTS)) contained(before[type],after[type],'Missing/changed '+type);}
function recoveryReceipt(receipt,kind,hash,actor,source) {
  assert.equal(receipt.kind,kind);assert.equal(receipt.source_store_uuid,PIN.uuid);assert.equal(receipt.target_store_uuid,PIN.uuid);
  assert.equal(receipt.source_root_sha256,hash);assert.equal(receipt.actor,actor);assert.equal(receipt.result,'success');
  assert.equal(receipt.counts.issues,source.pointer.issue_count);assert.equal(receipt.counts.events,source.pointer.event_count);assert.equal(receipt.counts.provenance_receipts,source.pointer.receipt_count);
}

async function main() {
  assert.equal(process.platform,'win32');assert.equal(process.version,'v25.2.1');
  assert.equal(process.argv.length,5,'Expected request path, exact request hash and absolute deadline milliseconds');
  const [requestPath,requestHash,deadlineArg]=process.argv.slice(2);
  assert.match(requestHash,HASH);assert.equal(hashFile(requestPath),requestHash);
  const request=readJSON(requestPath),phase=request.phase;
  assert.equal(request.schema_version,1);assert.ok(PHASES.includes(phase));
  assert.equal(request.helper_sha256,hashFile(fileURLToPath(import.meta.url)));
  const deadline=Number(deadlineArg);assert.ok(Number.isSafeInteger(deadline) && deadline>Date.now() && deadline<=Date.now()+180000);
  const checkTime=()=>assert.ok(Date.now()<deadline,'Phase deadline reached; reconcile saved attempt');
  ordinary(PIN.original,true);ordinary(PIN.isolated,true);
  const runtime=request.runtime;
  assert.ok(runtime && typeof runtime.path==='string');assert.match(runtime.sha256,HASH);assert.match(runtime.source_commit,/^[a-f0-9]{40}$/);
  assert.notEqual(runtime.sha256,PIN.historicalBinarySha,'Historical runtime has known set-v2 recovery defects');
  assert.ok(path.resolve(runtime.path).toLowerCase().startsWith(path.resolve('F:/Dev/.bead-edit-20261111').toLowerCase()+path.sep));
  assert.equal(hashFile(runtime.path),runtime.sha256);
  const planFile=request.plan?.path,mappingFile=request.materialization?.path;
  assert.ok(planFile && mappingFile);
  assert.equal(path.resolve(planFile),path.resolve(PIN.isolated,'revision-5/plan.json'));
  assert.equal(path.resolve(mappingFile),path.resolve(PIN.isolated,'materialization-result-v5.json'));
  assert.match(request.plan.sha256,HASH);assert.match(request.materialization.sha256,HASH);
  assert.equal(hashFile(planFile),request.plan.sha256);assert.equal(hashFile(mappingFile),request.materialization.sha256);
  const plan=readJSON(planFile),mapping=readJSON(mappingFile),issueCount=954+plan.tasks.length;
  assert.equal(plan.tasks.length,31);assert.equal(issueCount,985);assert.equal(plan.blocking_edges.length,49);
  assert.equal(mapping.status,'passed');assert.equal(mapping.original_inventory_unchanged,true);assert.equal(mapping.total_issues,issueCount);
  assert.equal(mapping.plan_sha256,request.plan.sha256);assert.equal(mapping.blocking_edges,plan.blocking_edges.length);
  const baselineFile=path.join(PIN.isolated,'inventory-before-node-v3.json'),baseline=readJSON(baselineFile);
  for(const key of ['exclusive_native_writer_window','installed_reviews_accepted','initial_handoff_reviews_accepted']) assert.equal(request.attestations?.[key],true,'Missing root attestation: '+key);
  const pin=record=>{
    assert.ok(record && typeof record.path==='string');assert.match(record.sha256,HASH);
    const full=path.resolve(record.path);
    assert.ok([PIN.isolated,PIN.retention].some(root=>full.toLowerCase().startsWith(path.resolve(root).toLowerCase()+path.sep)),'Evidence outside owned retention');
    assert.equal(hashFile(full),record.sha256,'Pinned evidence changed');return readJSON(full);
  };
  for(const role of ['qualification','review']) {
    const value=pin(runtime[role]);assert.equal(value.status,'passed');assert.equal(value.binary_sha256,runtime.sha256);assert.equal(value.source_commit,runtime.source_commit);
  }
  const planReview=pin(request.accepted?.['plan-review']);assert.equal(planReview.status,'passed');assert.equal(planReview.plan_sha256,request.plan.sha256);
  const roles=['install','configured-launch','installed-review','backend-text-review','app-text-review','original-git-baseline'];
  if(phase==='close' || phase.startsWith('final-')) roles.push('cleanup-results','cleanup-text-review','checkpoint-publication');
  for(const role of roles) assert.equal(pin(request.accepted?.[role]).status,'passed','Unaccepted prerequisite: '+role);
  if(phase==='preserve') {
    assert.ok(!fs.existsSync(PIN.retention),'Retention root already exists; inspect previous attempt');
    fs.mkdirSync(PIN.retention);fs.mkdirSync(path.join(PIN.retention,'phases'));
  }
  ordinary(PIN.retention,true);ordinary(path.join(PIN.retention,'phases'),true);
  const output=path.join(PIN.retention,'phases',phase);fs.mkdirSync(output,{recursive:false});
  const write=(name,value)=>save(path.join(output,name),value);
  const prior=name=>{
    assert.ok(PHASES.indexOf(name)>=0 && PHASES.indexOf(name)<PHASES.indexOf(phase));
    const p=request.prior?.[name];assert.equal(path.resolve(p?.path||''),path.resolve(PIN.retention,'phases',name,'result.json'));
    const value=pin(p);assert.equal(value.status,'passed');assert.equal(value.phase,name);
    assert.equal(value.runtime_sha256,runtime.sha256);assert.equal(value.plan_sha256,request.plan.sha256);assert.equal(value.materialization_sha256,request.materialization.sha256);
    return value;
  };
  const originalConfig=path.join(PIN.original,'.beads/config.json'),originalCheckpoint=path.join(PIN.original,'.beads/checkpoint');
  const isolatedCheckpoint=path.join(PIN.isolated,'.beads/checkpoint'),originalDB=path.join(PIN.original,'.beads/beads.db'),isolatedDB=path.join(PIN.isolated,'.beads/beads.db');
  const sourcePath=path.join(PIN.retention,'continuation-source/checkpoint');
  const env={...process.env};
  for(const key of Object.keys(env)) if(['temp','tmp','beads_repo','bead_workspace_root','node_options','node_path'].includes(key.toLowerCase())) delete env[key];
  env.TEMP=env.TMP=path.join(output,'temp');fs.mkdirSync(env.TEMP);
  const run=(cwd,args,label,json=true)=>{
    checkTime();assert.equal(hashFile(runtime.path),runtime.sha256);
    const started=new Date().toISOString();
    write(label+'.started.json',{started,args,cwd,binary_sha256:runtime.sha256,request_sha256:requestHash});
    const stdoutPath=path.join(output,label+'.stdout'),stderrPath=path.join(output,label+'.stderr');
    const stdout=fs.openSync(stdoutPath,'wx'),stderr=fs.openSync(stderrPath,'wx');let result;
    try{result=spawnSync(runtime.path,args,{cwd,env,windowsHide:true,shell:false,timeout:Math.min(30000,deadline-Date.now()),stdio:['ignore',stdout,stderr]});}
    finally{fs.fsyncSync(stdout);fs.fsyncSync(stderr);fs.closeSync(stdout);fs.closeSync(stderr);}
    write(label+'.exit.json',{started,ended:new Date().toISOString(),args,cwd,status:result.status,signal:result.signal,error:result.error?.message||null});
    assert.equal(result.error,undefined,'Uncertain command: reconcile actual live state; do not replay');
    assert.equal(result.status,0,'Command failed: inspect retained state; do not replay');
    assert.ok(fs.statSync(stdoutPath).size<=16*1024*1024 && fs.statSync(stderrPath).size<=16*1024*1024,'Native log exceeded bounded size');
    checkTime();const text=fs.readFileSync(stdoutPath,'utf8');return json?JSON.parse(text):text;
  };
  const list=(cwd,label)=>run(cwd,['list','--all','--json'],label);
  const snapshot=async(db,label)=>{checkTime();const value=await databaseSnapshot(db);write(label+'.json',value);return value;};
  const kept=(name,file)=>{const p=prior(name),full=path.join(PIN.retention,'phases',name,file);assert.equal(hashFile(full),p.outputs[file]);return readJSON(full);};
  const freezeCheck=()=>{
    const frozen=prior('freeze');assert.equal(digest(tree(sourcePath)),frozen.source_manifest_sha256);
    assert.equal(digest(tree(isolatedCheckpoint)),frozen.source_manifest_sha256);
    return checkpoint(sourcePath);
  };
  const backupRecord=()=>{
    const result=pin(request.backup_result);assert.equal(path.resolve(request.backup_result.path),path.resolve(PIN.retention,'original-sqlite/result.json'));
    assert.equal(result.status,'passed');assert.equal(result.schema_current,true);assert.equal(result.native_format_matches,true);
    assert.equal(result.snapshot.uuid,PIN.uuid);assert.equal(result.snapshot.issues,954);assert.equal(result.snapshot.events.n,11264);
    assert.equal(result.snapshot.receipts,5);assert.equal(result.snapshot.outcomes,413);
    equal(result.before_hashes,result.after_hashes,'Backup observed original change');
    const saved=prior('preserve').original_hashes;
    equal(result.before_hashes,{database:saved.database,config:saved.config,pointer:saved.pointer},'Backup does not match preserved original files');
    assert.equal(path.resolve(result.backup.path),path.resolve(PIN.retention,'original-sqlite/beads.db'));
    assert.equal(hashFile(result.backup.path),result.backup.sha256);assert.equal(hashFile(originalConfig),result.before_hashes.config);
    return result;
  };
  const attempted=detail=>write('mutation-attempt.json',{utc:new Date().toISOString(),replay_allowed:false,...detail});
  const verifyFreshRestore=async(sourceDirectory,cp,expectedInventory,sourceDB,targetName)=>{
    let ancestor=PIN.retention;
    while(true) {
      assert.ok(!fs.existsSync(path.join(ancestor,'.beads')),'Fresh restore sits inside another native workspace');
      const parent=path.dirname(ancestor);if(parent===ancestor)break;ancestor=parent;
    }
    const target=path.join(PIN.retention,targetName);assert.ok(!fs.existsSync(target));fs.mkdirSync(target);
    attempted({operation:'restore into fresh disposable target',target,generation:cp.pointer.generation_id});
    const report=run(target,['restore','--source',sourceDirectory,'--generation',cp.pointer.generation_id,'--actor',PIN.restoreActor,'--prefix','beadrs','--format','json'],'restore');
    assert.equal(report.local_recovery_succeeded,true);assert.equal(report.secret_quarantined,false);assert.equal(report.checkpoint_publication_withheld,false);assert.equal(report.non_empty_override,false);
    assert.equal(report.generation_id,cp.pointer.generation_id);assert.equal(report.source_root_sha256,cp.pointer.active_root.sha256);
    assert.equal(report.source_store_uuid,PIN.uuid);assert.equal(report.target_store_uuid,PIN.uuid);assert.equal(report.issues_restored,issueCount);
    assert.equal(report.events_restored,cp.pointer.event_count);assert.equal(report.provenance_receipts_restored,cp.pointer.receipt_count);
    for(const n of Object.values(report.displaced)) assert.equal(n,0);
    const inventory=list(target,'inventory');equal(inventoryMap(inventory),inventoryMap(expectedInventory),'Restored inventory differs');
    const restored=checkpoint(path.join(target,'.beads/checkpoint'));statusAligned(run(target,['sync','status','--format','json'],'status'),restored.pointer);
    subsetCorpus(cp.corpus,restored.corpus);equal(cp.corpus.issue,restored.corpus.issue,'Restore issue fields differ');equal(cp.corpus.attempt_outcome,restored.corpus.attempt_outcome,'Restore outcomes differ');
    assert.equal(restored.pointer.event_count,cp.pointer.event_count+1);assert.equal(restored.pointer.receipt_count,cp.pointer.receipt_count+1);
    recoveryReceipt(restored.details.provenance_receipt[report.restore_receipt_id],'restore',cp.pointer.active_root.sha256,PIN.restoreActor,cp);
    const added=Object.keys(restored.corpus.event).filter(k=>!cp.corpus.event[k]);assert.equal(added.length,1);
    assert.equal(restored.details.event[added[0]].kind,'checkpoint_restored');assert.equal(restored.details.event[added[0]].actor,PIN.restoreActor);
    const restoredDB=await snapshot(path.join(target,'.beads/beads.db'),'restored-database');
    equal(restoredDB.events,restored.corpus.event,'Restored DB event identities differ');equal(restoredDB.publicReceipts,restored.corpus.provenance_receipt,'Restored DB receipts differ');
    compareScoped(sourceDB,restoredDB,Object.values(mapping.tasks));
    return {target,report};
  };
  const finish=extra=>{
    const outputs={};
    for(const name of fs.readdirSync(output)) if(fs.lstatSync(path.join(output,name)).isFile()) outputs[name]=hashFile(path.join(output,name));
    const result={status:'passed',phase,utc:new Date().toISOString(),request_sha256:requestHash,runtime_sha256:runtime.sha256,
      plan_sha256:request.plan.sha256,materialization_sha256:request.materialization.sha256,outputs,...extra};
    write('result.json',result);console.log(JSON.stringify(result));
  };
  write('attempt-started.json',{phase,utc:new Date().toISOString(),request_sha256:requestHash,helper_sha256:request.helper_sha256,replay_allowed:false});
  write('request.json',request);

  try {
    if(phase==='preserve') {
      const cp=checkpoint(originalCheckpoint);
      assert.equal(cp.pointer.generation_id,PIN.originalGeneration);assert.equal(cp.pointer.snapshot_sequence,29609);assert.equal(cp.pointer.active_root.sha256,PIN.originalRoot);
      assert.deepEqual(Object.fromEntries(Object.entries(cp.corpus).map(([k,v])=>[k,Object.keys(v).length])),{issue:954,event:11264,provenance_receipt:5,attempt_outcome:413});
      const before={config:hashFile(originalConfig),pointer:hashFile(path.join(originalCheckpoint,'current.json')),database:hashFile(originalDB),mapping:hashFile(mappingFile),baseline:hashFile(baselineFile)};
      write('before.json',before);const directory=path.join(PIN.retention,'original-files');fs.mkdirSync(directory);
      copy(originalConfig,path.join(directory,'config.json'));
      const saved=retainCheckpoint(originalCheckpoint,path.join(directory,'checkpoint'));
      equal({config:hashFile(originalConfig),pointer:hashFile(path.join(originalCheckpoint,'current.json')),database:hashFile(originalDB),mapping:hashFile(mappingFile),baseline:hashFile(baselineFile)},before,'Original changed during preservation');
      write('checkpoint-manifest.json',saved.manifest);write('original-corpus.json',cp.corpus);write('previous-generation-diagnostic.json',saved.previous_verification);
      finish({original_hashes:before,checkpoint_manifest_sha256:digest(saved.manifest),generation:cp.pointer.generation_id});return;
    }
    const preserved=prior('preserve');
    assert.equal(hashFile(mappingFile),preserved.original_hashes.mapping);assert.equal(hashFile(baselineFile),preserved.original_hashes.baseline);
    assert.equal(hashFile(originalConfig),preserved.original_hashes.config);
    if(phase==='freeze') {
      const before=list(PIN.isolated,'before');verifyPlan(before,plan,mapping,baseline);
      const dbBefore=await snapshot(isolatedDB,'database-before');
      assert.equal(dbBefore.issueRows[PIN.cleanup].assignee,null);assert.equal(dbBefore.issueRows[PIN.cleanup].claim_epoch,0);
      save(path.join(PIN.isolated,'checkpoint-authority-freeze-20261125.json'),{status:'freeze-started',source:PIN.isolated,destination:PIN.original,request_sha256:requestHash,future_writes_require_reconciliation:true});
      attempted({operation:'isolated flush-only',isolated_authority_frozen:true});
      run(PIN.isolated,['sync','flush-only'],'flush',false);
      const after=list(PIN.isolated,'after');equal(after,before,'Freeze changed issues');
      const directory=path.join(PIN.retention,'continuation-source');fs.mkdirSync(directory);
      const retained=retainCheckpoint(isolatedCheckpoint,path.join(directory,'checkpoint')),cp=retained.checkpoint;
      statusAligned(run(PIN.isolated,['sync','status','--format','json'],'status'),cp.pointer);
      subsetCorpus(kept('preserve','original-corpus.json'),cp.corpus);
      assert.equal(cp.pointer.issue_count,issueCount);assert.equal(cp.pointer.attempt_outcome_count,413);
      const dbAfter=await snapshot(isolatedDB,'database-after');compareOriginal(dbBefore,dbAfter,true);
      for(const table of Object.keys(dbBefore.tables)) if(table!=='checkpoint_state') equal(dbAfter.tables[table],dbBefore.tables[table],'Freeze mutated '+table);
      equal(dbAfter.rawEventRows,dbBefore.rawEventRows,'Freeze changed raw event rows');
      equal(dbAfter.events,cp.corpus.event,'Source events differ from checkpoint');equal(dbAfter.publicReceipts,cp.corpus.provenance_receipt,'Source receipts differ from checkpoint');
      write('inventory.json',after);write('source-manifest.json',retained.manifest);write('source-corpus.json',cp.corpus);write('previous-generation-diagnostic.json',retained.previous_verification);
      finish({source_manifest_sha256:digest(retained.manifest),source_generation:cp.pointer.generation_id,source_root:cp.pointer.active_root.sha256,interchange_sha256:cp.interchange_sha256,isolated_database_sha256:digest(dbAfter),authority:'isolated-frozen'});return;
    }
    const source=freezeCheck(),frozenDB=kept('freeze','database-after.json');
    equal(await databaseSnapshot(isolatedDB),frozenDB,'Frozen source database changed');
    if(phase==='source-restore') {
      const before={database:hashFile(originalDB),config:hashFile(originalConfig),pointer:hashFile(path.join(originalCheckpoint,'current.json'))};
      write('original-before.json',before);
      const restored=await verifyFreshRestore(sourcePath,source,kept('freeze','inventory.json'),frozenDB,'source-restore-check');
      equal({database:hashFile(originalDB),config:hashFile(originalConfig),pointer:hashFile(path.join(originalCheckpoint,'current.json'))},before,'Source restore preflight changed original');
      freezeCheck();equal(await databaseSnapshot(isolatedDB),frozenDB,'Source restore preflight changed isolated authority');
      finish({verified_generation:source.pointer.generation_id,verified_root_sha256:source.pointer.active_root.sha256,binary_sha256:runtime.sha256,disposable_target:restored.target,original_native_opened:false});return;
    }
    // Every later phase is downstream of a successful current-source restore.
    prior('source-restore');
    const backup=backupRecord(),original=await databaseSnapshot(backup.backup.path),originalCorpus=kept('preserve','original-corpus.json');
    equal(originalCorpus.event,original.events,'Original backup event identity differs');equal(originalCorpus.provenance_receipt,original.publicReceipts,'Original backup receipt content differs');
    assert.equal(Object.keys(original.events).length,11264);
    const importArgs=['--no-auto-flush','sync','import-only','--input',sourcePath,'--merge','--profile','native-v1','--actor',PIN.actor,'--format','json'];
    if(phase==='dry-run') {
      assert.equal(digest(tree(originalCheckpoint)),preserved.checkpoint_manifest_sha256,'Original checkpoint changed before dry-run');
      assert.equal(hashFile(path.join(originalCheckpoint,'current.json')),preserved.original_hashes.pointer);assert.equal(hashFile(originalDB),backup.before_hashes.database);
      const before=await snapshot(originalDB,'before');equal(before,original,'Live original differs from preserved backup');
      const inventory=list(PIN.original,'inventory-before');equal(inventoryMap(inventory),inventoryMap(baseline),'Original native inventory differs');
      statusAligned(run(PIN.original,['sync','status','--format','json'],'status-before'),checkpoint(originalCheckpoint).pointer);
      const dry=run(PIN.original,[...importArgs,'--dry-run'],'dry-run');
      assert.equal(dry.dry_run,true);assert.equal(dry.prospective,true);assert.equal(dry.local_recovery_succeeded,false);
      assert.equal(dry.secret_quarantined,false);assert.equal(dry.checkpoint_publication_withheld,false);assert.equal(dry.receipt,null);assert.equal(dry.summary_event_sequence,null);
      assert.equal(dry.input_hash,source.interchange_sha256);assert.equal(dry.inserted,issueCount);assert.equal(dry.updated,0);assert.equal(dry.retained,0);assert.equal(dry.conflicted,0);
      const preview=dry.receipt_preview;
      assert.equal(preview.kind,'merge');assert.equal(preview.source_store_uuid,PIN.uuid);assert.equal(preview.target_store_uuid,PIN.uuid);assert.equal(preview.actor,PIN.actor);assert.equal(preview.source_root_sha256,source.interchange_sha256);
      assert.equal(preview.counts.issues,issueCount);assert.equal(preview.counts.events,source.pointer.event_count);assert.equal(preview.counts.provenance_receipts,source.pointer.receipt_count+1);
      const after=await snapshot(originalDB,'after');equal(after,before,'Dry-run changed original database');equal(list(PIN.original,'inventory-after'),inventory,'Dry-run changed inventory');
      assert.equal(hashFile(originalConfig),preserved.original_hashes.config);assert.equal(hashFile(path.join(originalCheckpoint,'current.json')),preserved.original_hashes.pointer);
      freezeCheck();finish({unchanged_database_sha256:digest(after),source_manifest_sha256:prior('freeze').source_manifest_sha256,interchange_sha256:source.interchange_sha256});return;
    }
    if(phase==='merge') {
      assert.equal(digest(tree(originalCheckpoint)),preserved.checkpoint_manifest_sha256,'Original checkpoint changed before merge');
      prior('dry-run');const before=await snapshot(originalDB,'before');equal(before,kept('dry-run','after.json'),'Original changed since accepted dry-run');
      assert.equal(hashFile(path.join(originalCheckpoint,'current.json')),preserved.original_hashes.pointer);
      write('authority-transfer-intended.json',{from:PIN.isolated,to:PIN.original,source_generation:source.pointer.generation_id,source_manifest_sha256:prior('freeze').source_manifest_sha256,interchange_sha256:source.interchange_sha256,replay_allowed:false});
      attempted({operation:'native same-UUID merge',args:importArgs});const merged=run(PIN.original,importArgs,'merge');
      assert.equal(merged.local_recovery_succeeded,true);assert.equal(merged.dry_run,false);assert.equal(merged.prospective,false);
      assert.equal(merged.secret_quarantined,false);assert.equal(merged.checkpoint_publication_withheld,false);
      assert.equal(merged.input_hash,source.interchange_sha256);assert.equal(merged.inserted,plan.tasks.length);assert.equal(merged.updated,0);assert.equal(merged.retained,954);assert.equal(merged.conflicted,0);
      recoveryReceipt(merged.receipt,'merge',source.interchange_sha256,PIN.actor,source);assert.ok(!source.corpus.provenance_receipt[merged.receipt.receipt_id]);
      const after=await snapshot(originalDB,'after');compareMerge(original,frozenDB,after,Object.values(mapping.tasks),source,merged.receipt);
      contained(source.corpus.event,after.events,'Incoming event changed');assert.equal(Object.keys(after.events).length,source.pointer.event_count+1);
      assert.equal(Object.keys(after.receipts).length,source.pointer.receipt_count+1);assert.equal(Object.keys(after.issueRows).length,issueCount);
      const extra=Object.keys(after.events).filter(k=>!Object.hasOwn(source.corpus.event,k));assert.equal(extra.length,1);
      const summary=after.eventRows[extra[0]];assert.equal(summary.actor,PIN.actor);assert.equal(summary.kind,'checkpoint_'+source.pointer.mode);assert.equal(summary.detail.source_root_hash,source.interchange_sha256);
      const inventory=list(PIN.original,'inventory');verifyPlan(inventory,plan,mapping,baseline);equal(inventoryMap(inventory),inventoryMap(kept('freeze','inventory.json')),'Merged inventory differs from frozen source');
      assert.equal(hashFile(originalConfig),preserved.original_hashes.config);assert.equal(hashFile(path.join(originalCheckpoint,'current.json')),preserved.original_hashes.pointer);freezeCheck();
      write('authority-transfer-complete.json',{authority:PIN.original,isolated:PIN.isolated,isolated_frozen:true,receipt:merged.receipt,local_sequence:after.local_sequence,publication_pending:true});
      finish({authority:PIN.original,merge_receipt:merged.receipt,local_sequence:after.local_sequence,database_sha256:digest(after)});return;
    }

    if(phase==='publish' || phase==='final-publish') {
      const previous=phase==='publish'?'merge':'close',previousResult=prior(previous);
      if(phase==='final-publish') {
        assert.equal(request.cleanup_revision,previousResult.cleanup_revision-1);assert.equal(request.close_reason,previousResult.close_reason);
      }
      const before=await snapshot(originalDB,'before');equal(before,kept(previous,'after.json'),'Original changed before publication');
      attempted({operation:'original flush-only',authority:PIN.original});run(PIN.original,['sync','flush-only'],'flush',false);
      const cp=checkpoint(originalCheckpoint);statusAligned(run(PIN.original,['sync','status','--format','json'],'status'),cp.pointer);
      assert.ok(cp.pointer.snapshot_sequence>29609,'Original must publish its own advanced local sequence');
      const after=await snapshot(originalDB,'after');compareOriginal(original,after,true);
      for(const table of Object.keys(before.tables)) if(table!=='checkpoint_state') equal(after.tables[table],before.tables[table],'Publication mutated '+table);
      equal(after.rawEventRows,before.rawEventRows,'Publication changed raw events');
      equal(cp.corpus.event,after.events,'Published events differ from database');equal(cp.corpus.provenance_receipt,after.publicReceipts,'Published receipts differ from database');
      for(const type of ['provenance_receipt','attempt_outcome']) contained(source.corpus[type],cp.corpus[type],'Published source record changed');
      assert.equal(cp.pointer.issue_count,issueCount);assert.equal(cp.pointer.attempt_outcome_count,413);assert.equal(cp.pointer.receipt_count,source.pointer.receipt_count+1);
      if(phase==='publish') equal(cp.corpus.issue,source.corpus.issue,'Published issue fields differ');
      else {
        const previousCorpus=kept('publish','published-corpus.json');
        for(const [id,h] of Object.entries(previousCorpus.issue)) if(id!==PIN.cleanup) assert.equal(cp.corpus.issue[id],h,'Other issue changed during cleanup');
        const closed=cp.issues[PIN.cleanup];assert.equal(closed.base_status,'closed');assert.equal(closed.close_reason,request.close_reason);assert.equal(closed.revision,request.cleanup_revision+1);
      }
      const inventory=list(PIN.original,'inventory');verifyPlan(inventory,plan,mapping,baseline,phase==='final-publish');
      const directory=path.join(PIN.retention,phase==='publish'?'published':'final-published');fs.mkdirSync(directory);
      const retained=retainCheckpoint(originalCheckpoint,path.join(directory,'checkpoint'));
      write('published-corpus.json',cp.corpus);write('published-manifest.json',retained.manifest);write('inventory.json',inventory);write('previous-generation-diagnostic.json',retained.previous_verification);
      assert.equal(hashFile(originalConfig),preserved.original_hashes.config);freezeCheck();
      finish({authority:PIN.original,generation:cp.pointer.generation_id,root_sha256:cp.pointer.active_root.sha256,checkpoint_path:path.join(directory,'checkpoint'),checkpoint_manifest_sha256:digest(retained.manifest),local_sequence:after.local_sequence,git_publication:'root pending'});return;
    }
    if(phase==='restore' || phase==='final-restore') {
      const publication=phase==='restore'?'publish':'final-publish',published=prior(publication);
      assert.equal(digest(tree(published.checkpoint_path)),published.checkpoint_manifest_sha256);
      assert.equal(digest(tree(originalCheckpoint)),published.checkpoint_manifest_sha256,'Original published checkpoint changed');
      const cp=checkpoint(published.checkpoint_path),publishedDB=kept(publication,'after.json');
      equal(await databaseSnapshot(originalDB),publishedDB,'Original changed before restore verification');
      const restored=await verifyFreshRestore(published.checkpoint_path,cp,kept(publication,'inventory.json'),publishedDB,phase==='restore'?'restore-check':'final-restore-check');
      equal(await databaseSnapshot(originalDB),publishedDB,'Verification restore changed original');
      assert.equal(digest(tree(published.checkpoint_path)),published.checkpoint_manifest_sha256);freezeCheck();
      finish({authority:PIN.original,verified_generation:cp.pointer.generation_id,verified_root_sha256:cp.pointer.active_root.sha256,
        continuation_tasks:plan.tasks.length,total_issues:issueCount,cleanup_closed:phase==='final-restore',disposable_target:restored.target,
        cleanup:'Root may remove this exact owned disposable target after retaining receipts',git_publication:'root pending'});return;
    }
    assert.equal(phase,'close');prior('restore');const published=prior('publish');
    assert.equal(digest(tree(originalCheckpoint)),published.checkpoint_manifest_sha256,'Original checkpoint changed before cleanup close');
    assert.equal(request.attestations.cleanup_completed,true);assert.equal(request.attestations.cleanup_handoffs_published,true);
    const publishedGit=pin(request.accepted['checkpoint-publication']);
    assert.equal(publishedGit.generation_id,published.generation);assert.equal(publishedGit.root_sha256,published.root_sha256);
    assert.match(publishedGit.commit,/^[a-f0-9]{40}$/);assert.equal(publishedGit.remote_commit,publishedGit.commit);
    assert.ok(Number.isSafeInteger(request.cleanup_revision) && request.cleanup_revision>0);
    assert.equal(typeof request.close_reason,'string');assert.equal(request.close_reason,request.close_reason.trim());assert.ok(request.close_reason.length>=80 && request.close_reason.length<=4096);
    const before=await snapshot(originalDB,'before');equal(before,kept('publish','after.json'),'Original changed since verified publication');
    verifyPlan(list(PIN.original,'before-inventory'),plan,mapping,baseline);
    const issue=before.issueRows[PIN.cleanup];
    assert.equal(issue.base_status,'open');assert.equal(issue.assignee,null);assert.equal(issue.claim_epoch,0);assert.equal(issue.manual_blocked,0);assert.equal(issue.revision,request.cleanup_revision);
    write('manifest.json',{manifest_version:1,operations:[{op:'close',id:PIN.cleanup,if_revision:request.cleanup_revision,reason:request.close_reason}]});
    const input=path.join(output,'manifest.json');
    const dry=run(PIN.original,['manifest','dry-run','--input',input,'--format','json'],'dry-run');
    assert.equal(dry.dry_run,true);assert.equal(dry.operations,1);assert.equal(dry.semantic_changes,1);equal(await databaseSnapshot(originalDB),before,'Close dry-run mutated database');
    attempted({operation:'close only cleanup',manifest_sha256:hashFile(input),if_revision:request.cleanup_revision});
    const done=run(PIN.original,['manifest','commit','--input',input,'--format','json','--no-auto-flush'],'commit');
    assert.equal(done.committed,true);assert.equal(done.operations,1);assert.equal(done.semantic_changes,1);
    const after=await snapshot(originalDB,'after');compareOriginal(original,after,true);
    for(const table of Object.keys(before.tables)) if(!['issues','events','sqlite_sequence'].includes(table)) equal(after.tables[table],before.tables[table],'Unrequested close change: '+table);
    for(const [name,value] of Object.entries(before.sequenceCounters)) if(name!=='events') assert.equal(after.sequenceCounters[name],value,'Other SQLite sequence changed during close');
    assert.equal(after.sequenceCounters.events,after.local_sequence);
    for(const [id,row] of Object.entries(before.issueRows)) {
      const expected={...row};
      if(id===PIN.cleanup) {
        expected.base_status='closed';expected.revision++;expected.close_reason=request.close_reason;
        expected.closed_at=after.issueRows[id].closed_at;expected.updated_at=after.issueRows[id].updated_at;
        assert.ok(expected.closed_at);assert.equal(expected.closed_at,expected.updated_at);
      }
      equal(after.issueRows[id],expected,'Unrequested issue field change: '+id);
    }
    contained(before.events,after.events,'Close changed prior event');contained(before.rawEventRows,after.rawEventRows,'Close changed prior raw event');
    const added=Object.keys(after.events).filter(k=>!before.events[k]);assert.equal(added.length,1);
    const event=after.eventRows[added[0]];assert.equal(event.kind,'closed');assert.equal(event.issue_id,PIN.cleanup);assert.equal(event.detail.reason,request.close_reason);
    assert.equal(event.detail.prior_base_status,'open');assert.equal(event.detail.claim_epoch,null);assert.equal(event.detail.presented_fencing_token,null);
    verifyPlan(list(PIN.original,'after-inventory'),plan,mapping,baseline,true);
    assert.equal(hashFile(originalConfig),preserved.original_hashes.config);freezeCheck();
    finish({authority:PIN.original,cleanup_id:PIN.cleanup,cleanup_revision:request.cleanup_revision+1,close_reason:request.close_reason,final_publication_required:true});
  } catch(error) {
    write('failure.json',{status:'failed',phase,utc:new Date().toISOString(),error:error.stack,replay_allowed:false,
      instruction:'Inspect retained attempts and actual live state. Preserve original and frozen source. Root must review an explicit reconciliation phase before any repeated mutation.'});
    throw error;
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
