import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Root-only recovery for the observed checkpoint-only CRLF original.
// Prior existing-database and LF-only helpers remain immutable and inapplicable.
// Imports expose read-only verifiers for disposable cloud qualification.
export const PIN = Object.freeze({
  original: 'F:/Dev/bead-rs',
  isolated: 'F:/Dev/.bead-edit-20261111/coordination-20261124',
  retention: 'F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1',
  historicalBinarySha: '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798',
  historicalPlanSha: '887b5036b9b1f588baaeb9a0fd9537c030e661b80325bd871b6c8b97bfbae178',
  uuid: '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4',
  formatUuid: 'f6a8c2e0-6b1d-4b7a-9b3a-2e7a7c5e9a4f',
  originalGeneration: 'gen-a569f746bbb268015d996c8ed4c76f57',
  originalRoot: '4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d',
  originalCheckpointTree: 'ff0759095a01edb38ca4bb8aa90fbdb84476e0f7',
  cleanup: 'beadrs-3ec972f8',
  actor: 'chatgpt-bead-edit-20261127',
  restoreActor: 'chatgpt-bead-edit-restore-check-20261127',
  sourceCommit: '2d801ba455b7a722daf644a7615445117d57e8e9',
  runtimeSha: '0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a',
  planSha: '18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582',
  mappingSha: '6d1cca5e2495011ae3dac4320e622f67c6f871186ef112edd8f51f8c98d1e5b3',
  gitPath: 'C:/Program Files/Git/cmd/git.exe',
  gitSha: '20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c',
});
// Exact observed CRLF checkout and its immutable canonical Git counterparts.
export const ORIGINAL_CHECKOUT = Object.freeze({
  'current.json': {blob:'fb204445a6a7b15f494b189839dddde2b84b139f',canonical_bytes:893,canonical_sha256:'f1a2009037599216140c8a6832480e4d869d596f8001c29a6fc0f1788f42aa43',raw_bytes:920,raw_sha256:'ccb1abde721af7a7fedbf3302d0143bd12e332cee47530d05f6c3515b3338b0a'},
  'previous.json': {blob:'2266bbc1021c90853f0ffb05171eea691e3cb910',canonical_bytes:892,canonical_sha256:'820306f78385f060d91409d58c3134959dbff90984292ffd23c297e104a28c73',raw_bytes:919,raw_sha256:'3ced2fb2fb98fbbac359640b82fc496eb41d8deae04b20389639eea39a8f7cc1'},
  'objects/4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d.jsonl': {blob:'2420cbad33c4df58a98c17eb3161be02b65cc8bc',canonical_bytes:8569277,canonical_sha256:'4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d',raw_bytes:8581913,raw_sha256:'b6cc30c51074894b6a7248aabbec1c5f59e9b593610ec38bccdd7852eacf55b4'},
  'objects/5711cb1301c4de33554b7df0ea3c9fb7bec4b9cc8108b47108b2fb53fac1936f.jsonl': {blob:'ed7e25648c4ce861626c9df0e3d23814597dd9f9',canonical_bytes:8492439,canonical_sha256:'5711cb1301c4de33554b7df0ea3c9fb7bec4b9cc8108b47108b2fb53fac1936f',raw_bytes:8504969,raw_sha256:'d9cd655cf5e8a7b54cc62a11f1ffad4bb93e587ba2d16a43f8d988ef42a449c0'},
});
const PHASES = ['preserve','freeze','source-restore','restore-original','restore','close','final-publish','final-restore'];
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
const HASH_BUFFER=Buffer.alloc(1024*1024);
function hashFile(file){ordinary(file);const fd=fs.openSync(file,'r'),hash=createHash('sha256');try{let n;while((n=fs.readSync(fd,HASH_BUFFER,0,HASH_BUFFER.length,null))>0)hash.update(HASH_BUFFER.subarray(0,n));return hash.digest('hex');}finally{fs.closeSync(fd);}}
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
export function requireAbsentDatabase(beadsDirectory) {
  const paths=['beads.db','beads.db-wal','beads.db-shm','beads.db-journal'];
  for(const name of paths) {
    let found=false;
    try{fs.lstatSync(path.join(beadsDirectory,name));found=true;}
    catch(error){if(error.code!=='ENOENT')throw error;}
    assert.equal(found,false,'Checkpoint-only recovery requires absent database and sidecars: '+name);
  }
  return {database:'absent',sidecars:'absent',checked:paths};
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
function selectedManifest(base) {
  ordinary(base,true);const files={};let total=0;
  const take=relative=>{
    if(files[relative])return null;
    const data=bytes(beneath(base,relative));total+=data.length;
    assert.ok(total<=MAX_FILE,'Selected checkpoint closure exceeds 64 MiB');
    assert.ok(Object.keys(files).length<4096,'Selected checkpoint file-count bound');
    files[relative]={sha256:digest(data),bytes:data.length};return data;
  };
  const recordFile=(relative,depth=0)=>{
    const data=take(relative);if(data===null)return;
    for(const line of new TextDecoder('utf-8',{fatal:true}).decode(data).split(/\r?\n/))if(line.trim()){
      const value=JSON.parse(line);
      if(value.ref===true){assert.equal(depth,0);assert.match(value.path,/^set\/rec\/[a-f0-9]{64}\.jsonl$/);recordFile(value.path,depth+1);}
    }
  };
  for(const name of ['current.json','previous.json']){
    if(!fs.existsSync(path.join(base,name))){assert.equal(name,'previous.json');continue;}
    const pointer=JSON.parse(take(name));assert.match(pointer.active_root.sha256,HASH);
    if(pointer.mode==='monolithic'){
      assert.equal(pointer.active_root.path,'objects/'+pointer.active_root.sha256+'.jsonl');recordFile(pointer.active_root.path);
    }else{
      assert.equal(pointer.mode,'set-v2');assert.equal(pointer.active_root.path,'set/manifest-'+pointer.generation_id+'.json');
      const raw=take(pointer.active_root.path),manifest=JSON.parse(raw===null?bytes(beneath(base,pointer.active_root.path)):raw);
      for(const row of [...manifest.shards,...manifest.segments,...(manifest.tail?[manifest.tail]:[])])recordFile(row.path);
    }
  }
  return sorted(files);
}
export function originalManifest(raw) {
  return sorted(Object.fromEntries(Object.entries(ORIGINAL_CHECKOUT).map(([name,item])=>[name,{sha256:item[raw?'raw_sha256':'canonical_sha256'],bytes:item[raw?'raw_bytes':'canonical_bytes']}])));
}
function verifyOriginalFiles(directory,raw) {
  ordinary(directory,true);const expected=originalManifest(raw),manifest={};
  // Fixed pointer hashes establish this closure. Stream the four pinned files
  // instead of parsing 25,000 JSONL rows merely to rediscover their paths.
  for(const name of Object.keys(expected)) {
    const file=beneath(directory,name);manifest[name]={sha256:hashFile(file),bytes:ordinary(file).size};
  }
  equal(manifest,expected,raw?'Observed original CRLF checkpoint bytes changed':'Retained canonical original files changed');
  return sorted(manifest);
}
export function verifyOriginalCheckout(directory) {return verifyOriginalFiles(directory,true);}
export function verifyOriginalRetention(rawDirectory,canonicalDirectory,entries) {
  const raw=verifyOriginalCheckout(rawDirectory),canonicalFiles=verifyOriginalFiles(canonicalDirectory,false),proofs={};
  for(const [name,item] of Object.entries(ORIGINAL_CHECKOUT)) {
    equal(entries[name],{mode:'100644',blob:item.blob,bytes:item.canonical_bytes},'Immutable original Git entry changed: '+name);
    const data=bytes(beneath(canonicalDirectory,name));
    assert.equal(createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex'),item.blob,'Canonical file differs from exact Git blob');
    assert.equal(data.indexOf(13),-1,'Canonical Git file unexpectedly contains CR');
    const expanded=createHash('sha256');let start=0,next,expandedLength=data.length;
    while((next=data.indexOf(10,start))!==-1){expanded.update(data.subarray(start,next)).update('\r\n');start=next+1;expandedLength++;}
    expanded.update(data.subarray(start));assert.equal(expandedLength,item.raw_bytes);
    assert.equal(expanded.digest('hex'),item.raw_sha256,'Original checkout is not exact LF-to-CRLF expansion');
    proofs[name]={git_blob:item.blob,canonical:canonicalFiles[name],raw:raw[name],exact_lf_to_crlf:true};
  }
  return {status:'passed',files:proofs,raw_manifest_sha256:digest(raw),canonical_manifest_sha256:digest(canonicalFiles),raw_bytes:17088721,canonical_bytes:17063501};
}
export function verifyOriginalRawPromotion(checkpointDirectory,rawDirectory,canonicalDirectory,entries) {
  const retention=verifyOriginalRetention(rawDirectory,canonicalDirectory,entries);
  const canonicalOriginal=checkpoint(canonicalDirectory);
  assert.equal(canonicalOriginal.pointer.generation_id,PIN.originalGeneration);
  const pointer=bytes(path.join(checkpointDirectory,'previous.json'));
  assert.equal(pointer.length,ORIGINAL_CHECKOUT['current.json'].raw_bytes);
  assert.equal(digest(pointer),ORIGINAL_CHECKOUT['current.json'].raw_sha256,'Native promotion changed original raw current pointer');
  equal(JSON.parse(pointer),canonicalOriginal.pointer,'Promoted pointer semantics differ from canonical retained original');
  const root=canonicalOriginal.pointer.active_root.path,item=ORIGINAL_CHECKOUT[root];assert.ok(item);
  const file=beneath(checkpointDirectory,root);assert.equal(ordinary(file).size,item.raw_bytes);
  assert.equal(hashFile(file),item.raw_sha256,'Native publication changed retained original raw root');
  assert.throws(()=>checkpoint(checkpointDirectory,'previous.json'),/Object digest mismatch/,'Observed CRLF previous is not a valid raw native source');
  return {status:'passed',generation:PIN.originalGeneration,raw_previous_pointer:{bytes:pointer.length,sha256:digest(pointer)},raw_retained_root:{path:root,bytes:item.raw_bytes,sha256:item.raw_sha256},canonical_source:canonicalDirectory,canonical_manifest_sha256:retention.canonical_manifest_sha256,raw_previous_natively_restorable:false};
}
function retainCheckpoint(source,destination) {
  const before=selectedManifest(source),current=checkpoint(source);
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
  equal(selectedManifest(source),before,'Source selected closure changed during retention');equal(selectedManifest(destination),before,'Retained selected closure differs');
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
    const tables={},scopedRows={},sequenceCounters={},events={},eventRows={},rawEventRows={},receipts={},publicReceipts={},issueRows={},resourceLocks={};
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
        if(entry.name==='resource_locks') resourceLocks[row.resource_key]=row;
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
    const result={schema_sha256:digest(schema),tables,scopedRows,sequenceCounters,events,eventRows,rawEventRows,receipts,publicReceipts,issueRows,resourceLocks,workspace,
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
    if(table==='events' || table==='resource_locks') continue;
    for(const id of newIds) equal(source.scopedRows[table]?.[id]||{},restored.scopedRows[table]?.[id]||{},'Recovery loses task auxiliary rows: '+table+'/'+id);
  }
}
function storedList(row) {
  const value=structuredClone(row);delete value.effective_status;
  for(const dep of value.dependencies||[]){delete dep.blocker_status;delete dep.finished;}
  return value;
}
const inventoryMap = values => Object.fromEntries(values.map(row=>[row.id,storedList(row)]));
function verifyPlan(list,plan,mapping,baseline,closed=false) {
  const total=954+plan.tasks.length;
  assert.equal(list.length,total);const all=new Map(list.map(row=>[row.id,row]));assert.equal(all.size,total);
  assert.equal(baseline.length,954);assert.equal(new Set(baseline.map(row=>row.id)).size,954);
  for(const row of baseline) equal(storedList(all.get(row.id)),storedList(row),'Original issue changed: '+row.id);
  assert.equal(Object.keys(mapping.tasks).length,plan.tasks.length);assert.equal(new Set(Object.values(mapping.tasks)).size,plan.tasks.length);
  const ids=new Set(Object.values(mapping.tasks)),edges=[];
  assert.equal(new Set(plan.tasks.map(task=>task.key)).size,plan.tasks.length);
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

export function verifyRestoreReport(report,source,actor) {
  assert.equal(report.local_recovery_succeeded,true);assert.equal(report.secret_quarantined,false);
  assert.equal(report.checkpoint_publication_withheld,false);assert.equal(report.non_empty_override,false);
  assert.equal(report.generation_id,source.pointer.generation_id);assert.equal(report.mode,source.pointer.mode);
  assert.equal(report.source_root_sha256,source.pointer.active_root.sha256);assert.equal(report.source_root_path,source.pointer.active_root.path);
  assert.equal(report.source_store_uuid,PIN.uuid);assert.equal(report.target_store_uuid,PIN.uuid);assert.equal(report.actor,actor);
  assert.equal(report.snapshot_sequence,source.pointer.snapshot_sequence);
  assert.equal(report.issues_restored,source.pointer.issue_count);assert.equal(report.events_restored,source.pointer.event_count);
  assert.equal(report.provenance_receipts_restored,source.pointer.receipt_count);
  assert.equal(report.summary_event_sequence,source.pointer.event_count+1,'Fresh target must contain exactly the incoming events and one restore event');
  for(const n of Object.values(report.displaced))assert.equal(n,0);
}

export function verifyRestoredCorpus(source,restored,report,actor) {
  verifyRestoreReport(report,source,actor);
  subsetCorpus(source.corpus,restored.corpus);
  equal(restored.corpus.issue,source.corpus.issue,'Restore changed complete issue records');
  equal(restored.corpus.attempt_outcome,source.corpus.attempt_outcome,'Restore changed attempt outcomes');
  assert.equal(restored.pointer.event_count,source.pointer.event_count+1);
  assert.equal(restored.pointer.receipt_count,source.pointer.receipt_count+1);
  assert.equal(restored.pointer.snapshot_sequence,report.summary_event_sequence,'Restored local ingestion sequence differs');
  const eventIdentity=PIN.uuid+':'+(source.pointer.event_count+1);
  assert.deepEqual(Object.keys(restored.corpus.event).filter(k=>!Object.hasOwn(source.corpus.event,k)),[eventIdentity]);
  const event=restored.details.event[eventIdentity];
  assert.equal(event.kind,'checkpoint_restored');assert.equal(event.issue_id,null);assert.equal(event.actor,actor);
  assert.equal(event.origin_store_uuid,PIN.uuid);assert.equal(event.origin_event_sequence,source.pointer.event_count+1);
  equal(event.detail,{source_store_uuid:PIN.uuid,source_root_sha256:source.pointer.active_root.sha256,snapshot_sequence:source.pointer.snapshot_sequence,
    issues_restored:source.pointer.issue_count,events_restored:source.pointer.event_count,provenance_receipts_restored:source.pointer.receipt_count,replaced_non_empty_target:false},'Restore audit detail differs');
  assert.deepEqual(Object.keys(restored.corpus.provenance_receipt).filter(k=>!Object.hasOwn(source.corpus.provenance_receipt,k)),[report.restore_receipt_id]);
  const receipt=restored.details.provenance_receipt[report.restore_receipt_id];
  recoveryReceipt(receipt,'restore',source.pointer.active_root.sha256,actor,source);
  assert.equal(receipt.summary_event_identity,'local-'+report.summary_event_sequence);
  assert.equal(receipt.receipt_sha256,report.restore_receipt_sha256);
  assert.equal(receipt.receipt_sha256,digest(receipt.receipt_id+receipt.kind+receipt.source_root_sha256+receipt.actor+receipt.created_at+receipt.result));
  return {event_identity:eventIdentity,event,receipt};
}

export function verifyRestoredDatabase(sourceDatabase,restoredDatabase,restoredCheckpoint,restoreWindow) {
  assert.equal(restoredDatabase.schema_sha256,sourceDatabase.schema_sha256,'Restore schema differs from accepted source');
  for(const key of ['uuid','prefix','layout_version','format_uuid','format_version'])assert.equal(restoredDatabase.workspace[key],sourceDatabase.workspace[key],'Restored workspace field differs: '+key);
  equal(restoredDatabase.events,restoredCheckpoint.corpus.event,'Restored DB event identities differ');
  equal(restoredDatabase.publicReceipts,restoredCheckpoint.corpus.provenance_receipt,'Restored DB receipts differ');
  assert.equal(restoredDatabase.local_sequence,restoredCheckpoint.pointer.snapshot_sequence);
  compareScoped(sourceDatabase,restoredDatabase,Object.keys(sourceDatabase.issueRows));
  // Native recovery recreates active resource locks from portable declarations.
  // Ownership survives; acquired_at records this recovery and fencing is null.
  assert.ok(Number.isSafeInteger(restoreWindow.started_ms) && Number.isSafeInteger(restoreWindow.finished_ms) && restoreWindow.started_ms<=restoreWindow.finished_ms);
  assert.deepEqual(Object.keys(restoredDatabase.resourceLocks).sort(),Object.keys(sourceDatabase.resourceLocks).sort());
  for(const [key,prior] of Object.entries(sourceDatabase.resourceLocks)) {
    const current=restoredDatabase.resourceLocks[key];
    for(const row of [prior,current])assert.equal(row.lease_fencing_token,null,'Unexpected live resource fencing state requires reconciliation');
    const previous={...prior},actual={...current};delete previous.acquired_at;delete actual.acquired_at;
    equal(actual,previous,'Restored resource lock ownership differs: '+key);
    const acquired=Date.parse(current.acquired_at);assert.ok(Number.isFinite(acquired));
    assert.ok(acquired>=Math.floor(restoreWindow.started_ms/1000)*1000 && acquired<=restoreWindow.finished_ms,'Restored resource lock timestamp falls outside the actual command');
  }
}

export function verifyPromotedPrevious(selected,promoted) {
  assert.equal(promoted.files['previous.json'].sha256,selected.files['current.json'].sha256,'Promoted previous pointer bytes differ');
  equal(promoted.pointer,selected.pointer,'Promoted previous pointer differs');
  const before={...selected.files},after={...promoted.files};delete before['current.json'];delete after['previous.json'];
  equal(after,before,'Publication lost or changed selected previous objects');
  equal(promoted.corpus,selected.corpus,'Publication changed selected previous records');
  assert.equal(promoted.interchange_sha256,selected.interchange_sha256);
}

export function parseIndexEntries(text) {
  const entries={};
  for(const item of text.split('\0').filter(Boolean)) {
    const match=/^(100644|100755|120000|160000) ([a-f0-9]{40}) 0\t(.+)$/.exec(item);
    assert.ok(match,'Unmerged or unrecognized Git index entry');assert.ok(!Object.hasOwn(entries,match[3]));
    entries[match[3]]={mode:match[1],blob:match[2]};
  }
  return sorted(entries);
}

function verifyPublicationIndexInternal(before,after,checkpointDirectory,originalPrevious=false) {
  for(const key of ['head','checkpoint_tree','entries','index_path'])equal(after[key],before[key],'Publication changed immutable Git state: '+key);
  const changed=[];
  for(const name of new Set([...Object.keys(before.index_entries),...Object.keys(after.index_entries)])) {
    const prior=before.index_entries[name],next=after.index_entries[name];
    if(canonical(prior)===canonical(next))continue;
    assert.ok(name.startsWith('.beads/checkpoint/'),'Publication changed an unrelated index entry: '+name);
    const relative=name.slice('.beads/checkpoint/'.length);
    assert.ok(relative && !relative.includes('\\') && relative.split('/').every(p=>p && p!=='.' && p!=='..'));
    const file=path.join(checkpointDirectory,...relative.split('/'));
    if(next) {
      assert.equal(next.mode,'100644','Checkpoint index mode changed');const data=bytes(file);
      if(originalPrevious && relative==='previous.json') {
        const observed=ORIGINAL_CHECKOUT['current.json'];
        assert.equal(data.length,observed.raw_bytes);assert.equal(digest(data),observed.raw_sha256,'Only exact preserved original current bytes may normalize');
        assert.equal(next.blob,observed.blob,'Promoted previous must stage the exact canonical original current blob');
      } else assert.equal(next.blob,createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex'),'Staged checkpoint bytes differ from verified working bytes: '+name);
    } else assert.equal(fs.existsSync(file),false,'Staged checkpoint deletion still exists: '+name);
    changed.push(name);
  }
  const staged=after.status.split('\0').filter(Boolean).map(item=>{
    assert.match(item,/^[AMD]  /,'Checkpoint publication has unstaged, untracked or conflicted changes');return item.slice(3);
  });
  equal(staged.sort(),changed.sort(),'Checkpoint staging differs from the index delta');
  assert.ok(changed.includes('.beads/checkpoint/current.json'),'Publication did not stage current.json');
  assert.ok(changed.includes('.beads/checkpoint/previous.json'),'Publication did not stage previous.json');
  return {status:'passed',changed_paths:changed,unrelated_index_entries_preserved:true,index_before:before.index_sha256,index_after:after.index_sha256};
}

export function verifyPublicationIndex(before,after,checkpointDirectory) {
  return verifyPublicationIndexInternal(before,after,checkpointDirectory);
}
export function verifyInitialPublicationIndex(before,after,checkpointDirectory,rawDirectory,canonicalDirectory) {
  assert.equal(before.checkpoint_tree,PIN.originalCheckpointTree,'Initial compatibility applies only to the immutable original tree');
  equal(before.index_entries['.beads/checkpoint/current.json'],{mode:'100644',blob:ORIGINAL_CHECKOUT['current.json'].blob},'Initial index current pointer differs');
  const proof=verifyOriginalRawPromotion(checkpointDirectory,rawDirectory,canonicalDirectory,before.entries);
  return {...verifyPublicationIndexInternal(before,after,checkpointDirectory,true),original_previous_normalization:{path:'.beads/checkpoint/previous.json',raw:proof.raw_previous_pointer,canonical_git_blob:ORIGINAL_CHECKOUT['current.json'].blob,canonical_sha256:ORIGINAL_CHECKOUT['current.json'].canonical_sha256,canonical_bytes:ORIGINAL_CHECKOUT['current.json'].canonical_bytes,raw_retention_manifest_sha256:digest(originalManifest(true)),canonical_retention_manifest_sha256:proof.canonical_manifest_sha256}};
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
  assert.equal(runtime.sha256,PIN.runtimeSha);assert.equal(runtime.source_commit,PIN.sourceCommit);
  assert.notEqual(runtime.sha256,PIN.historicalBinarySha,'Historical runtime has known set-v2 recovery defects');
  assert.ok(path.resolve(runtime.path).toLowerCase().startsWith(path.resolve('F:/Dev/.bead-edit-20261111').toLowerCase()+path.sep));
  assert.equal(hashFile(runtime.path),runtime.sha256);
  assert.ok(request.git && typeof request.git.path==='string');assert.match(request.git.sha256,HASH);assert.equal(hashFile(request.git.path),request.git.sha256);
  assert.equal(path.resolve(request.git.path),path.resolve(PIN.gitPath));assert.equal(request.git.sha256,PIN.gitSha);
  const planFile=request.plan?.path,mappingFile=request.materialization?.path;
  assert.ok(planFile && mappingFile);
  assert.equal(path.resolve(planFile),path.resolve(PIN.isolated,'revision-9/plan.json'));
  assert.equal(path.resolve(mappingFile),path.resolve(PIN.isolated,'materialization-result-v9.json'));
  assert.match(request.plan.sha256,HASH);assert.match(request.materialization.sha256,HASH);
  assert.equal(request.plan.sha256,PIN.planSha);assert.equal(request.materialization.sha256,PIN.mappingSha);
  assert.equal(hashFile(planFile),request.plan.sha256);assert.equal(hashFile(mappingFile),request.materialization.sha256);
  const plan=readJSON(planFile),mapping=readJSON(mappingFile);
  assert.equal(plan.tasks.length,55);assert.equal(plan.blocking_edges.length,91);
  assert.ok(Array.isArray(plan.tasks) && plan.tasks.length>0 && plan.tasks.length<=1000,'Invalid accepted task array');
  assert.ok(Array.isArray(plan.blocking_edges) && plan.blocking_edges.length<=10000,'Invalid accepted edge array');
  const issueCount=954+plan.tasks.length;
  const taskKeys=new Set();for(const task of plan.tasks){assert.match(task.key,/^[a-z][a-z0-9-]*$/);assert.ok(!taskKeys.has(task.key));taskKeys.add(task.key);assert.equal(typeof task.title,'string');assert.equal(typeof task.description,'string');}
  assert.ok(taskKeys.has('preserve-and-clean'));const edgeKeys=new Set();
  for(const edge of plan.blocking_edges){assert.ok(taskKeys.has(edge.blocked) && taskKeys.has(edge.blocker));assert.notEqual(edge.blocked,edge.blocker);const key=canonical([edge.blocked,edge.blocker]);assert.ok(!edgeKeys.has(key));edgeKeys.add(key);}
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
  const planReview=pin(request.accepted?.['plan-review']);
  assert.equal(planReview.status,'PASS');assert.equal(planReview.accepted,true);assert.equal(planReview.continuation_revision,9);assert.equal(planReview.read_complete_plan,true);
  assert.equal(planReview.expanded_tasks_read,plan.tasks.length);assert.equal(planReview.blocking_edges_read,plan.blocking_edges.length);
  assert.equal(planReview.plan_sha256,request.plan.sha256);assert.equal(planReview.reviewed_files?.['plan.json'],request.plan.sha256);
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
  const originalIgnore=path.join(PIN.original,'.beads/.gitignore');
  const originalConfiguration=readJSON(originalConfig);
  assert.deepEqual(Object.keys(originalConfiguration).sort(),['created_at','prefix','uuid','version']);
  assert.equal(originalConfiguration.uuid,PIN.uuid);assert.equal(originalConfiguration.prefix,'beadrs');assert.equal(originalConfiguration.version,1);
  const isolatedCheckpoint=path.join(PIN.isolated,'.beads/checkpoint'),originalDB=path.join(PIN.original,'.beads/beads.db'),isolatedDB=path.join(PIN.isolated,'.beads/beads.db');
  const sourcePath=path.join(PIN.retention,'continuation-source/checkpoint');
  const originalRawPath=path.join(PIN.retention,'original-files/checkpoint-raw');
  const originalCanonicalPath=path.join(PIN.retention,'original-files/checkpoint');
  const env={...process.env};
  for(const key of Object.keys(env)) if(key.toLowerCase().startsWith('git_') || ['temp','tmp','beads_repo','bead_workspace_root','node_options','node_path'].includes(key.toLowerCase())) delete env[key];
  const nativePath=Object.entries(env).find(([key])=>key.toLowerCase()==='path')?.[1]||'';
  for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];
  env.PATH=path.dirname(request.git.path)+path.delimiter+nativePath;
  env.GIT_OPTIONAL_LOCKS='0';
  env.TEMP=env.TMP=path.join(output,'temp');fs.mkdirSync(env.TEMP);
  const run=(cwd,args,label,json=true,options={})=>{
    const program=options.git?request.git:runtime;
    checkTime();assert.equal(hashFile(program.path),program.sha256);
    const started=new Date().toISOString();
    write(label+'.started.json',{started,args,cwd,executable:program.path,binary_sha256:program.sha256,request_sha256:requestHash});
    const stdoutPath=path.join(output,label+'.stdout'),stderrPath=path.join(output,label+'.stderr');
    const stdout=fs.openSync(stdoutPath,'wx'),stderr=fs.openSync(stderrPath,'wx'),stdin=options.stdin?fs.openSync(options.stdin,'r'):'ignore';let result;
    try{result=spawnSync(program.path,args,{cwd,env,windowsHide:true,shell:false,timeout:Math.min(30000,deadline-Date.now()),stdio:[stdin,stdout,stderr]});}
    finally{if(typeof stdin==='number')fs.closeSync(stdin);fs.fsyncSync(stdout);fs.fsyncSync(stderr);fs.closeSync(stdout);fs.closeSync(stderr);}
    write(label+'.exit.json',{started,ended:new Date().toISOString(),args,cwd,status:result.status,signal:result.signal,error:result.error?.message||null});
    assert.equal(result.error,undefined,'Uncertain command: reconcile actual live state; do not replay');
    assert.equal(result.status,0,'Command failed: inspect retained state; do not replay');
    assert.ok(fs.statSync(stdoutPath).size<=16*1024*1024 && fs.statSync(stderrPath).size<=16*1024*1024,'Native log exceeded bounded size');
    checkTime();const text=fs.readFileSync(stdoutPath,'utf8');return json?JSON.parse(text):text;
  };
  const git=(args,label,stdin)=>run(PIN.original,['--no-optional-locks','-C',PIN.original,...args],label,false,{git:true,stdin});
  const originalGitConfig=git(['rev-parse','--path-format=absolute','--git-path','config'],'git-configuration-path').trim();
  const gitConfiguration=hashFile(originalGitConfig);write('git-configuration-before.json',{path:originalGitConfig,sha256:gitConfiguration});
  const gitBaseline=pin(request.accepted['original-git-baseline']);
  assert.match(gitBaseline.head,/^[a-f0-9]{40}$/);assert.equal(gitBaseline.checkpoint_tree,PIN.originalCheckpointTree);
  assert.equal(gitBaseline.remote_repository,'YossiMH/bead-rs');assert.equal(gitBaseline.remote_commit,gitBaseline.head);
  assert.equal(gitBaseline.remote_checkpoint_tree,PIN.originalCheckpointTree);assert.equal(gitBaseline.remote_objects_verified,true);
  assert.match(gitBaseline.index_sha256,HASH);
  assert.ok(gitBaseline.index_backup && path.resolve(gitBaseline.index_backup.path).toLowerCase().startsWith(path.resolve(PIN.isolated).toLowerCase()+path.sep));
  assert.equal(gitBaseline.index_backup.sha256,gitBaseline.index_sha256);assert.equal(hashFile(gitBaseline.index_backup.path),gitBaseline.index_sha256);
  const gitState=(label,original=false)=>{
    const head=git(['rev-parse','HEAD'],label+'-head').trim();
    const checkpointTree=git(['rev-parse','HEAD:.beads/checkpoint'],label+'-tree').trim();
    assert.match(head,/^[a-f0-9]{40}$/);assert.match(checkpointTree,/^[a-f0-9]{40}$/);
    const indexPath=git(['rev-parse','--path-format=absolute','--git-path','index'],label+'-index-path').trim();
    const indexBefore=hashFile(indexPath);
    const indexEntries=parseIndexEntries(git(['ls-files','--stage','-z'],label+'-index-entries'));
    const raw=git(['ls-tree','-r','-l','-z','HEAD:.beads/checkpoint'],label+'-entries');
    const entries={};
    for(const line of raw.split('\0').filter(Boolean)){
      const match=/^(100644) blob ([a-f0-9]{40}) +([0-9]+)\t(.+)$/.exec(line);assert.ok(match,'Unexpected tracked checkpoint entry');
      const relative=match[4];assert.ok(!entries[relative]);assert.ok(!relative.includes('\\') && relative.split('/').every(p=>p && p!=='.' && p!=='..'));
      entries[relative]={mode:match[1],blob:match[2],bytes:Number(match[3])};
    }
    assert.ok(Object.keys(entries).length<=4096);
    assert.equal(git(['config','--default','false','--get','core.autocrlf'],label+'-autocrlf').trim(),'true','Expected the observed unchanged built-in checkout configuration');
    if(original){
      assert.equal(head,gitBaseline.head);assert.equal(checkpointTree,PIN.originalCheckpointTree);
      assert.equal(indexBefore,gitBaseline.index_sha256);assert.equal(Object.keys(entries).length,53);assert.equal(Object.values(entries).reduce((n,x)=>n+x.bytes,0),429072095);
      verifyOriginalCheckout(originalCheckpoint);
      const attributeInput=path.join(output,label+'-attribute-paths.stdin'),fd=fs.openSync(attributeInput,'wx');
      try{fs.writeFileSync(fd,Object.keys(entries).sort().map(p=>'.beads/checkpoint/'+p+'\0').join(''));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      const attrs=git(['check-attr','--all','-z','--stdin'],label+'-attributes',attributeInput).split('\0');assert.equal(attrs.pop(),'');assert.equal(attrs.length%3,0);
      for(let i=0;i<attrs.length;i+=3)if(['filter','working-tree-encoding','text','eol','ident'].includes(attrs[i+1]))assert.ok(['unset','unspecified'].includes(attrs[i+2]),'Git transformation prevents raw-object preservation: '+attrs[i+1]);
    }
    const ignored=git(['ls-files','--others','--ignored','--exclude-standard','-z','--','.beads/checkpoint'],label+'-ignored').split('\0').filter(Boolean);
    assert.ok(ignored.every(name=>name==='.beads/checkpoint/publish.lock'),'Unexpected ignored untracked checkpoint content');
    if(ignored.length){assert.equal(ignored.length,1);assert.equal(ordinary(path.join(PIN.original,ignored[0])).size,0,'Publication lock must be empty');}
    write(label+'-publication-lock.json',{optional_zero_byte_lock_present:ignored.length===1,non_reparse_validation:'required in successful supervisor receipt'});
    const status=git(['-c','status.renames=false','status','--porcelain=v1','-z','--untracked-files=all','--','.beads/checkpoint'],label+'-status');
    if(original)assert.equal(status,'','Original checkpoint has tracked or untracked changes');
    const indexAfter=hashFile(indexPath);assert.equal(indexAfter,indexBefore,'Read-only Git changed the index');
    const value={head,checkpoint_tree:checkpointTree,index_path:indexPath,index_sha256:indexAfter,index_entries:indexEntries,status,entries:sorted(entries)};
    write(label+'.json',value);return value;
  };
  const list=(cwd,label)=>run(cwd,['list','--all','--json'],label);
  const snapshot=async(db,label)=>{checkTime();const value=await databaseSnapshot(db);write(label+'.json',value);return value;};
  const kept=(name,file)=>{const p=prior(name),full=path.join(PIN.retention,'phases',name,file);assert.equal(hashFile(full),p.outputs[file]);return readJSON(full);};
  const freezeCheck=()=>{
    const frozen=prior('freeze');assert.equal(digest(selectedManifest(sourcePath)),frozen.source_manifest_sha256);
    assert.equal(digest(selectedManifest(isolatedCheckpoint)),frozen.source_manifest_sha256);
    return checkpoint(sourcePath);
  };
  const attempted=(detail,name='mutation-attempt.json')=>write(name,{utc:new Date().toISOString(),replay_allowed:false,...detail});
  const verifyFreshRestore=async(sourceDirectory,cp,expectedInventory,sourceDB,targetName)=>{
    let ancestor=PIN.retention;
    while(true) {
      assert.ok(!fs.existsSync(path.join(ancestor,'.beads')),'Fresh restore sits inside another native workspace');
      const parent=path.dirname(ancestor);if(parent===ancestor)break;ancestor=parent;
    }
    const target=path.join(PIN.retention,targetName);assert.ok(!fs.existsSync(target));fs.mkdirSync(target);
    attempted({operation:'restore into fresh disposable target',target,generation:cp.pointer.generation_id},phase==='source-restore'?'continuation-mutation-attempt.json':'mutation-attempt.json');
    const restoreWindow={started_ms:Date.now()};
    const report=run(target,['restore','--source',sourceDirectory,'--generation',cp.pointer.generation_id,'--actor',PIN.restoreActor,'--prefix','beadrs','--format','json'],'restore');
    restoreWindow.finished_ms=Date.now();verifyRestoreReport(report,cp,PIN.restoreActor);
    const inventory=list(target,'inventory');equal(inventoryMap(inventory),inventoryMap(expectedInventory),'Restored inventory differs');
    const restored=checkpoint(path.join(target,'.beads/checkpoint'));statusAligned(run(target,['sync','status','--format','json'],'status'),restored.pointer);
    const audit=verifyRestoredCorpus(cp,restored,report,PIN.restoreActor);
    const restoredDB=await snapshot(path.join(target,'.beads/beads.db'),'restored-database');
    verifyRestoredDatabase(sourceDB,restoredDB,restored,restoreWindow);
    write('restore-audit.json',audit);
    return {target,report};
  };
  const finish=extra=>{
    assert.equal(hashFile(originalGitConfig),gitConfiguration,'Phase changed Git configuration bytes');
    write('git-configuration-after.json',{path:originalGitConfig,sha256:gitConfiguration});
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
      const gitBefore=gitState('original-git-before',true);
      const before={config:hashFile(originalConfig),pointer:hashFile(path.join(originalCheckpoint,'current.json')),database_state:requireAbsentDatabase(path.dirname(originalDB)),git_config:hashFile(originalGitConfig),gitignore:hashFile(originalIgnore),mapping:hashFile(mappingFile),baseline:hashFile(baselineFile)};
      write('before.json',before);const rawManifest=verifyOriginalCheckout(originalCheckpoint);
      const directory=path.join(PIN.retention,'original-files');fs.mkdirSync(directory);
      fs.mkdirSync(originalRawPath);fs.mkdirSync(originalCanonicalPath);let fileNumber=0;
      for(const [relative,item] of Object.entries(ORIGINAL_CHECKOUT)) {
        equal(gitBefore.entries[relative],{mode:'100644',blob:item.blob,bytes:item.canonical_bytes},'Original selected Git entry differs');
        const rawTarget=path.join(originalRawPath,...relative.split('/')),canonicalTarget=path.join(originalCanonicalPath,...relative.split('/'));
        fs.mkdirSync(path.dirname(rawTarget),{recursive:true});fs.mkdirSync(path.dirname(canonicalTarget),{recursive:true});
        copy(beneath(originalCheckpoint,relative),rawTarget);
        const label='original-canonical-blob-'+(++fileNumber);git(['cat-file','blob',item.blob],label);
        copy(path.join(output,label+'.stdout'),canonicalTarget);
      }
      const retentionProof=verifyOriginalRetention(originalRawPath,originalCanonicalPath,gitBefore.entries);
      equal(verifyOriginalCheckout(originalCheckpoint),rawManifest,'Original raw files changed during retention');
      const cp=checkpoint(originalCanonicalPath),previousGeneration=checkpoint(originalCanonicalPath,'previous.json').pointer.generation_id;
      write('original-checkout-proof.json',retentionProof);
      assert.equal(cp.pointer.generation_id,PIN.originalGeneration);assert.equal(cp.pointer.snapshot_sequence,29609);assert.equal(cp.pointer.active_root.sha256,PIN.originalRoot);
      assert.deepEqual(Object.fromEntries(Object.entries(cp.corpus).map(([k,v])=>[k,Object.keys(v).length])),{issue:954,event:11264,provenance_receipt:5,attempt_outcome:413});
      copy(originalConfig,path.join(directory,'config.json'));copy(originalIgnore,path.join(directory,'.gitignore'));
      copy(gitBefore.index_path,path.join(directory,'index'));assert.equal(hashFile(path.join(directory,'index')),gitBefore.index_sha256);
      equal({config:hashFile(originalConfig),pointer:hashFile(path.join(originalCheckpoint,'current.json')),database_state:requireAbsentDatabase(path.dirname(originalDB)),git_config:hashFile(originalGitConfig),gitignore:hashFile(originalIgnore),mapping:hashFile(mappingFile),baseline:hashFile(baselineFile)},before,'Original changed during preservation');
      assert.equal(Object.keys(rawManifest).length,4);assert.equal(Object.values(rawManifest).reduce((n,x)=>n+x.bytes,0),17088721);
      equal(verifyOriginalRetention(originalRawPath,originalCanonicalPath,gitBefore.entries),retentionProof,'Original retained raw or canonical bytes changed');
      equal(gitState('original-git-after',true),gitBefore,'Original Git state changed during preservation');
      write('original-git-recovery.json',{repository:gitBaseline.remote_repository,commit:gitBefore.head,checkpoint_tree:gitBefore.checkpoint_tree,entries:gitBefore.entries,remote_objects_verified:true,selected_copy_bytes:17088721,canonical_copy_bytes:17063501,
        recovery:'Retain this commit as a reachable Git ancestor/ref. Recreate all 53 historical paths from their exact raw Git blobs in a fresh reviewed directory. original-files/checkpoint-raw holds the exact selected CRLF working files; original-files/checkpoint holds their canonical Git counterparts and is the valid native restore source. The original database was absent. Keep both forms and the preserved raw index private on the PC.'});
      write('checkpoint-manifest.json',rawManifest);write('canonical-checkpoint-manifest.json',originalManifest(false));write('original-corpus.json',cp.corpus);
      write('previous-generation-diagnostic.json',{status:'passed',source:'canonical Git retention',generation:previousGeneration,raw_original_natively_restorable:false});
      finish({original_hashes:before,checkpoint_manifest_sha256:digest(rawManifest),canonical_checkpoint_manifest_sha256:digest(originalManifest(false)),generation:cp.pointer.generation_id,original_head:gitBefore.head,original_checkpoint_tree:gitBefore.checkpoint_tree});return;
    }
    const preserved=prior('preserve');
    const retainedOriginalGit=kept('preserve','original-git-recovery.json');
    const retainedOriginal=verifyOriginalRetention(originalRawPath,originalCanonicalPath,retainedOriginalGit.entries);
    assert.equal(retainedOriginal.raw_manifest_sha256,preserved.checkpoint_manifest_sha256);
    assert.equal(retainedOriginal.canonical_manifest_sha256,preserved.canonical_checkpoint_manifest_sha256);
    assert.equal(gitConfiguration,preserved.original_hashes.git_config,'Original Git configuration changed between phases');
    assert.equal(hashFile(mappingFile),preserved.original_hashes.mapping);assert.equal(hashFile(baselineFile),preserved.original_hashes.baseline);
    assert.equal(hashFile(originalConfig),preserved.original_hashes.config);assert.equal(hashFile(originalIgnore),preserved.original_hashes.gitignore);
    if(phase==='freeze') {
      requireAbsentDatabase(path.dirname(originalDB));const gitBefore=gitState('original-git-before',true);
      assert.equal(digest(selectedManifest(originalCheckpoint)),preserved.checkpoint_manifest_sha256);
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
      requireAbsentDatabase(path.dirname(originalDB));assert.equal(digest(selectedManifest(originalCheckpoint)),preserved.checkpoint_manifest_sha256);
      equal(gitState('original-git-after',true),gitBefore,'Freeze changed original Git state');
      finish({source_manifest_sha256:digest(retained.manifest),source_generation:cp.pointer.generation_id,source_root:cp.pointer.active_root.sha256,interchange_sha256:cp.interchange_sha256,isolated_database_sha256:digest(dbAfter),authority:'isolated-frozen'});return;
    }
    const source=freezeCheck(),frozenDB=kept('freeze','database-after.json');
    equal(await databaseSnapshot(isolatedDB),frozenDB,'Frozen source database changed');
    if(phase==='source-restore') {
      const gitBefore=gitState('original-git-before',true);
      const originalTree=digest(selectedManifest(originalCheckpoint));
      const before={database_state:requireAbsentDatabase(path.dirname(originalDB)),config:hashFile(originalConfig),gitignore:hashFile(originalIgnore),pointer:hashFile(path.join(originalCheckpoint,'current.json'))};
      write('original-before.json',before);
      const originalTarget=path.join(PIN.retention,'original-canonical-restore-check');
      {
        let canonicalOriginal=checkpoint(originalCanonicalPath);
        let ancestor=PIN.retention;
        while(true){assert.ok(!fs.existsSync(path.join(ancestor,'.beads')),'Fresh original verification target sits inside a native workspace');const parent=path.dirname(ancestor);if(parent===ancestor)break;ancestor=parent;}
        assert.ok(!fs.existsSync(originalTarget));fs.mkdirSync(originalTarget);
        attempted({operation:'restore canonical original into fresh disposable target, then qualify frozen continuation',original_target:originalTarget,generation:canonicalOriginal.pointer.generation_id});
        const originalReport=run(originalTarget,['restore','--source',originalCanonicalPath,'--generation',canonicalOriginal.pointer.generation_id,'--actor',PIN.restoreActor,'--prefix','beadrs','--format','json'],'original-canonical-restore');
        let originalRestored=checkpoint(path.join(originalTarget,'.beads/checkpoint'));
        const originalAudit=verifyRestoredCorpus(canonicalOriginal,originalRestored,originalReport,PIN.restoreActor);
        statusAligned(run(originalTarget,['sync','status','--format','json'],'original-canonical-status'),originalRestored.pointer);
        let originalInventory=list(originalTarget,'original-canonical-inventory');
        let expectedOriginalInventory=kept('freeze','inventory.json').filter(row=>Object.hasOwn(canonicalOriginal.corpus.issue,row.id));
        assert.equal(expectedOriginalInventory.length,954);equal(inventoryMap(originalInventory),inventoryMap(expectedOriginalInventory),'Canonical original restore inventory differs');
        let originalSnapshot=await snapshot(path.join(originalTarget,'.beads/beads.db'),'original-canonical-database');
        equal(originalSnapshot.events,originalRestored.corpus.event,'Canonical original restore database events differ');
        equal(originalSnapshot.publicReceipts,originalRestored.corpus.provenance_receipt,'Canonical original restore database receipts differ');
        assert.equal(Object.keys(originalSnapshot.issueRows).length,954);
        write('original-canonical-restore-proof.json',{status:'passed',source:originalCanonicalPath,target:originalTarget,source_generation:canonicalOriginal.pointer.generation_id,source_root_sha256:canonicalOriginal.pointer.active_root.sha256,source_corpus:canonicalOriginal.corpus,restore_audit:originalAudit,raw_original_natively_restorable:false});
        // Release these large temporary graphs before the full continuation
        // check in this same 128 MiB phase. All assertions and receipts precede it.
        canonicalOriginal=null;originalRestored=null;originalInventory=null;expectedOriginalInventory=null;originalSnapshot=null;
      }
      const restored=await verifyFreshRestore(sourcePath,source,kept('freeze','inventory.json'),frozenDB,'source-restore-check');
      equal({database_state:requireAbsentDatabase(path.dirname(originalDB)),config:hashFile(originalConfig),gitignore:hashFile(originalIgnore),pointer:hashFile(path.join(originalCheckpoint,'current.json'))},before,'Source restore preflight changed original');
      assert.equal(digest(selectedManifest(originalCheckpoint)),originalTree,'Source restore preflight changed original selected closure');
      equal(gitState('original-git-after',true),gitBefore,'Source restore preflight changed original Git state');
      freezeCheck();equal(await databaseSnapshot(isolatedDB),frozenDB,'Source restore preflight changed isolated authority');
      finish({verified_generation:source.pointer.generation_id,verified_root_sha256:source.pointer.active_root.sha256,binary_sha256:runtime.sha256,disposable_target:restored.target,original_canonical_disposable_target:originalTarget,original_canonical_restore_verified:true,original_native_opened:false});return;
    }
    // Every later phase is downstream of a successful current-source restore.
    prior('source-restore');
    if(phase==='restore-original') {
      requireAbsentDatabase(path.dirname(originalDB));
      const gitBefore=gitState('original-git-before',true);
      equal(gitBefore,kept('source-restore','original-git-after.json'),'Original Git state changed since source qualification');
      assert.equal(digest(selectedManifest(originalCheckpoint)),preserved.checkpoint_manifest_sha256);
      const selectedBeforeGeneration=checkpoint(originalCanonicalPath).pointer.generation_id;
      subsetCorpus(kept('preserve','original-corpus.json'),source.corpus);
      write('authority-transfer-intended.json',{from:PIN.isolated,to:PIN.original,source_generation:source.pointer.generation_id,
        source_manifest_sha256:prior('freeze').source_manifest_sha256,original_database:'absent',replay_allowed:false});
      const initArgs=['--no-auto-flush','init','--prefix','beadrs'];
      const restoreArgs=['restore','--source',sourcePath,'--generation',source.pointer.generation_id,'--actor',PIN.actor,'--prefix','beadrs','--format','json'];
      attempted({operation:'initialize empty original then supported restore with native publication',init_args:initArgs,restore_args:restoreArgs});
      // Verify absence again at the write boundary. Init deliberately suppresses
      // publication; the following Ready-workspace restore uses the native
      // explicit-recovery publisher, which accepts this high covered sequence.
      requireAbsentDatabase(path.dirname(originalDB));
      run(PIN.original,initArgs,'init',false);
      const empty=await snapshot(originalDB,'initialized-empty-database');
      assert.equal(Object.keys(empty.issueRows).length,0);assert.equal(Object.keys(empty.events).length,0);assert.equal(Object.keys(empty.receipts).length,0);
      assert.equal(empty.local_sequence,0);assert.equal(Object.keys(empty.scopedRows).length,0);
      for(const table of ['attempt_outcomes','saved_views','recurrence_templates','redaction_findings'])assert.equal(Object.keys(empty.tables[table]||{}).length,0,'Init created semantic state: '+table);
      assert.equal(hashFile(originalConfig),preserved.original_hashes.config);assert.equal(hashFile(originalIgnore),preserved.original_hashes.gitignore);
      assert.equal(digest(selectedManifest(originalCheckpoint)),preserved.checkpoint_manifest_sha256,'Init changed original selected checkpoint');
      equal(gitState('original-git-after-init',true),gitBefore,'Init changed original Git state');
      freezeCheck();equal(await databaseSnapshot(isolatedDB),frozenDB,'Frozen source changed before original restore');
      const restoreWindow={started_ms:Date.now()};
      const report=run(PIN.original,restoreArgs,'restore-original');restoreWindow.finished_ms=Date.now();verifyRestoreReport(report,source,PIN.actor);
      const cp=checkpoint(originalCheckpoint);statusAligned(run(PIN.original,['sync','status','--format','json'],'status'),cp.pointer);
      const audit=verifyRestoredCorpus(source,cp,report,PIN.actor);
      assert.notEqual(cp.pointer.generation_id,selectedBeforeGeneration);
      const promoted=verifyOriginalRawPromotion(originalCheckpoint,originalRawPath,originalCanonicalPath,gitBefore.entries);
      const after=await snapshot(originalDB,'after');verifyRestoredDatabase(frozenDB,after,cp,restoreWindow);
      const inventory=list(PIN.original,'inventory');verifyPlan(inventory,plan,mapping,baseline);
      equal(inventoryMap(inventory),inventoryMap(kept('freeze','inventory.json')),'Restored original inventory differs from frozen source');
      assert.equal(hashFile(originalConfig),preserved.original_hashes.config);assert.equal(hashFile(originalIgnore),preserved.original_hashes.gitignore);
      freezeCheck();equal(await databaseSnapshot(isolatedDB),frozenDB,'Original restore changed frozen source');
      const gitAfter=gitState('original-git-after');
      write('checkpoint-index-reconciliation.json',verifyInitialPublicationIndex(gitBefore,gitAfter,originalCheckpoint,originalRawPath,originalCanonicalPath));
      const directory=path.join(PIN.retention,'published');fs.mkdirSync(directory);
      const retained=retainCheckpoint(originalCheckpoint,path.join(directory,'checkpoint'));
      write('published-corpus.json',cp.corpus);write('published-manifest.json',retained.manifest);write('inventory.json',inventory);
      write('previous-generation-diagnostic.json',retained.previous_verification);write('restore-audit.json',audit);
      write('retained-original-generation.json',promoted);
      write('authority-transfer-complete.json',{authority:PIN.original,isolated:PIN.isolated,isolated_frozen:true,
        restore_receipt:audit.receipt,restore_event_identity:audit.event_identity,local_sequence:after.local_sequence,checkpoint_published:true,git_publication:'root pending'});
      finish({authority:PIN.original,generation:cp.pointer.generation_id,root_sha256:cp.pointer.active_root.sha256,
        checkpoint_path:path.join(directory,'checkpoint'),checkpoint_manifest_sha256:digest(retained.manifest),local_sequence:after.local_sequence,
        restore_receipt:audit.receipt,restore_event_identity:audit.event_identity,original_raw_current_retained_as_previous:true,original_previous_natively_restorable:false,original_canonical_restore_verified:true,git_publication:'root pending'});return;
    }

    if(phase==='final-publish') {
      const previous='close',previousResult=prior(previous);
      if(phase==='final-publish') {
        assert.equal(request.cleanup_revision,previousResult.cleanup_revision-1);assert.equal(request.close_reason,previousResult.close_reason);
      }
      const gitBefore=gitState('original-git-before');equal(gitBefore,kept(previous,'original-git-after.json'),'Original Git state changed before publication');
      const before=await snapshot(originalDB,'before');equal(before,kept(previous,'after.json'),'Original changed before publication');
      const selectedBefore=checkpoint(originalCheckpoint);
      write('pre-flush-selected-generation.json',{pointer:selectedBefore.pointer,files:selectedBefore.files,interchange_sha256:selectedBefore.interchange_sha256});
      attempted({operation:'original flush-only',authority:PIN.original,previous_generation_required:selectedBefore.pointer.generation_id});run(PIN.original,['sync','flush-only'],'flush',false);
      const cp=checkpoint(originalCheckpoint);statusAligned(run(PIN.original,['sync','status','--format','json'],'status'),cp.pointer);
      assert.notEqual(cp.pointer.generation_id,selectedBefore.pointer.generation_id,'Dirty publication did not advance generation');
      const promoted=checkpoint(originalCheckpoint,'previous.json');
      assert.equal(promoted.files['previous.json'].sha256,selectedBefore.files['current.json'].sha256,'Promoted previous pointer bytes differ');
      equal(promoted.pointer,selectedBefore.pointer,'Promoted previous pointer differs');
      const priorFiles={...selectedBefore.files};delete priorFiles['current.json'];
      const promotedFiles={...promoted.files};delete promotedFiles['previous.json'];
      equal(promotedFiles,priorFiles,'Publication lost or changed selected previous objects');
      equal(promoted.corpus,selectedBefore.corpus,'Publication changed selected previous records');
      assert.equal(promoted.interchange_sha256,selectedBefore.interchange_sha256);
      write('retained-selected-generation.json',{status:'passed',generation:selectedBefore.pointer.generation_id,previous_pointer_sha256:promoted.files['previous.json'].sha256,files:promoted.files});
      assert.ok(cp.pointer.snapshot_sequence>selectedBefore.pointer.snapshot_sequence,'Cleanup publication must advance its current local sequence');
      const after=await snapshot(originalDB,'after');
      for(const table of Object.keys(before.tables)) if(table!=='checkpoint_state') equal(after.tables[table],before.tables[table],'Publication mutated '+table);
      equal(after.rawEventRows,before.rawEventRows,'Publication changed raw events');
      equal(cp.corpus.event,after.events,'Published events differ from database');equal(cp.corpus.provenance_receipt,after.publicReceipts,'Published receipts differ from database');
      for(const type of ['provenance_receipt','attempt_outcome']) contained(source.corpus[type],cp.corpus[type],'Published source record changed');
      assert.equal(cp.pointer.issue_count,issueCount);assert.equal(cp.pointer.attempt_outcome_count,413);assert.equal(cp.pointer.receipt_count,source.pointer.receipt_count+1);
      {
        const previousCorpus=kept('restore-original','published-corpus.json');
        for(const [id,h] of Object.entries(previousCorpus.issue)) if(id!==PIN.cleanup) assert.equal(cp.corpus.issue[id],h,'Other issue changed during cleanup');
        const closed=cp.issues[PIN.cleanup];assert.equal(closed.base_status,'closed');assert.equal(closed.close_reason,request.close_reason);assert.equal(closed.revision,request.cleanup_revision+1);
      }
      const inventory=list(PIN.original,'inventory');verifyPlan(inventory,plan,mapping,baseline,phase==='final-publish');
      const directory=path.join(PIN.retention,'final-published');fs.mkdirSync(directory);
      const retained=retainCheckpoint(originalCheckpoint,path.join(directory,'checkpoint'));
      write('published-corpus.json',cp.corpus);write('published-manifest.json',retained.manifest);write('inventory.json',inventory);write('previous-generation-diagnostic.json',retained.previous_verification);
      assert.equal(hashFile(originalConfig),preserved.original_hashes.config);freezeCheck();
      const gitAfter=gitState('original-git-after');
      write('checkpoint-index-reconciliation.json',verifyPublicationIndex(gitBefore,gitAfter,originalCheckpoint));
      finish({authority:PIN.original,generation:cp.pointer.generation_id,root_sha256:cp.pointer.active_root.sha256,checkpoint_path:path.join(directory,'checkpoint'),checkpoint_manifest_sha256:digest(retained.manifest),local_sequence:after.local_sequence,git_publication:'root pending'});return;
    }
    if(phase==='restore' || phase==='final-restore') {
      const publication=phase==='restore'?'restore-original':'final-publish',published=prior(publication);
      const gitBefore=gitState('original-git-before');equal(gitBefore,kept(publication,'original-git-after.json'),'Original Git state changed before verification restore');
      assert.equal(digest(selectedManifest(published.checkpoint_path)),published.checkpoint_manifest_sha256);
      assert.equal(digest(selectedManifest(originalCheckpoint)),published.checkpoint_manifest_sha256,'Original published checkpoint changed');
      const cp=checkpoint(published.checkpoint_path),publishedDB=kept(publication,'after.json');
      equal(await databaseSnapshot(originalDB),publishedDB,'Original changed before restore verification');
      const restored=await verifyFreshRestore(published.checkpoint_path,cp,kept(publication,'inventory.json'),publishedDB,phase==='restore'?'restore-check':'final-restore-check');
      equal(await databaseSnapshot(originalDB),publishedDB,'Verification restore changed original');
      assert.equal(digest(selectedManifest(originalCheckpoint)),published.checkpoint_manifest_sha256,'Verification restore changed original selected closure');
      equal(gitState('original-git-after'),gitBefore,'Verification restore changed original Git state');
      assert.equal(digest(selectedManifest(published.checkpoint_path)),published.checkpoint_manifest_sha256);freezeCheck();
      finish({authority:PIN.original,verified_generation:cp.pointer.generation_id,verified_root_sha256:cp.pointer.active_root.sha256,
        continuation_tasks:plan.tasks.length,total_issues:issueCount,cleanup_closed:phase==='final-restore',disposable_target:restored.target,
        cleanup:'Root may remove this exact owned disposable target after retaining receipts',git_publication:'root pending'});return;
    }
    assert.equal(phase,'close');prior('restore');const published=prior('restore-original');
    assert.equal(digest(selectedManifest(originalCheckpoint)),published.checkpoint_manifest_sha256,'Original checkpoint changed before cleanup close');
    assert.equal(request.attestations.cleanup_completed,true);assert.equal(request.attestations.cleanup_handoffs_published,true);
    const publishedGit=pin(request.accepted['checkpoint-publication']);
    assert.equal(publishedGit.generation_id,published.generation);assert.equal(publishedGit.root_sha256,published.root_sha256);
    assert.match(publishedGit.commit,/^[a-f0-9]{40}$/);assert.equal(publishedGit.remote_commit,publishedGit.commit);
    const gitBefore=gitState('original-git-before');assert.equal(gitBefore.status,'','Published checkpoint has tracked or untracked changes');
    assert.match(publishedGit.checkpoint_tree,/^[a-f0-9]{40}$/);assert.equal(gitBefore.checkpoint_tree,publishedGit.checkpoint_tree);
    git(['merge-base','--is-ancestor',publishedGit.commit,gitBefore.head],'published-commit-ancestor');
    assert.ok(Number.isSafeInteger(request.cleanup_revision) && request.cleanup_revision>0);
    assert.equal(typeof request.close_reason,'string');assert.equal(request.close_reason,request.close_reason.trim());assert.ok(request.close_reason.length>=80 && request.close_reason.length<=4096);
    const before=await snapshot(originalDB,'before');equal(before,kept('restore-original','after.json'),'Original changed since verified publication');
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
    const after=await snapshot(originalDB,'after');
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
    equal(gitState('original-git-after'),gitBefore,'Cleanup close unexpectedly changed original Git state');
    finish({authority:PIN.original,cleanup_id:PIN.cleanup,cleanup_revision:request.cleanup_revision+1,close_reason:request.close_reason,final_publication_required:true});
  } catch(error) {
    write('failure.json',{status:'failed',phase,utc:new Date().toISOString(),error:error.stack,replay_allowed:false,
      instruction:'Inspect retained attempts and actual live state. Preserve original and frozen source. Root must review an explicit reconciliation phase before any repeated mutation.'});
    throw error;
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
