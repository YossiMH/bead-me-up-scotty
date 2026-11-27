from pathlib import Path
import hashlib,json
HERE=Path(__file__).resolve().parent
BASE=HERE.parent/'frontend/baseline/qualify-checkpoint-only.mjs'
sha=lambda b:hashlib.sha256(b).hexdigest()
baseline=BASE.read_bytes()
assert sha(baseline)=='5023568ee13227573a660274ea0f531748273e6828ebd6fb1ac8e9cb40d617bb'
text=baseline.decode();changes=[]
def replace(old,new,count=1):
    global text
    assert text.count(old)==count,(old[:150],text.count(old),count)
    text=text.replace(old,new);changes.append({'before':old,'after':new,'occurrences':count})
replace('  parseIndexEntries, verifyPublicationIndex,','  parseIndexEntries, verifyPublicationIndex, ORIGINAL_CHECKOUT, originalManifest,\n  verifyOriginalCheckout, verifyOriginalRetention, verifyOriginalRawPromotion, verifyInitialPublicationIndex,')
replace('./checkpoint-only-handoff-20261127.mjs','./checkpoint-only-handoff-crlf-20261127.mjs',count=2)
replace('assert.equal(process.argv.slice(2).length,10);',"assert.equal(process.argv.slice(2).length,12);\nassert.equal(process.version,'v25.2.1');assert.ok(process.execArgv.includes('--max-old-space-size=128'));\nconst repository=path.resolve(options.repository);")
replace("const run=(cwd,args,label,{git=false,json=true}={})=>{","const run=(cwd,args,label,{git=false,json=true,expectFailure=false}={})=>{")
replace("  assert.equal(result.error,undefined);assert.equal(result.status,0,label);","  assert.equal(result.error,undefined);if(expectFailure)assert.notEqual(result.status,0,label);else assert.equal(result.status,0,label);\n  if(expectFailure)return result.stderr.toString('utf8');")
replace("  const before=hash(indexPath);\n  const value=",r"""  const before=hash(indexPath),entries={};
  for(const row of git(cwd,['ls-tree','-r','-l','-z','HEAD:.beads/checkpoint'],label+'-tree-entries').split('\0').filter(Boolean)){
    const match=/^(100644) blob ([a-f0-9]{40}) +([0-9]+)\t(.+)$/.exec(row);assert.ok(match);entries[match[4]]={mode:match[1],blob:match[2],bytes:Number(match[3])};
  }
  const value=""")
replace("    entries:git(cwd,['ls-tree','-r','-l','-z','HEAD:.beads/checkpoint'],label+'-tree-entries'),index_path:indexPath,index_sha256:before,","    entries,index_path:indexPath,index_sha256:before,")
replace("  const originalBefore=checkpoint(original);","  let originalBefore=checkpoint(original);const originalFingerprint=digest(originalBefore);")
replace("  const sourceCheckpoint=path.join(source,'.beads/checkpoint'),incoming=checkpoint(sourceCheckpoint),sourceDB=","  let sourceCheckpoint=path.join(source,'.beads/checkpoint'),incoming=checkpoint(sourceCheckpoint),sourceDB=")
start=text.index("  const target=makeWorkspace('checkpoint-only-original');")
end=text.index("  requireAbsentDatabase(path.join(target,'.beads'));",start)
replace(text[start:end],(HERE/'qualification-fixture.txt').read_text()+'\n')
replace("  equal(checkpoint(targetCheckpoint).files,originalBefore.files);assert.equal(hash(path.join(target,'.beads/config.json')),configHash);equal(indexState(target,'after-init'),gitBefore);","  equal(verifyOriginalCheckout(targetCheckpoint),rawManifest);assert.equal(hash(path.join(target,'.beads/config.json')),configHash);equal(indexState(target,'after-init'),gitBefore);")
replace("  const recovered=checkpoint(targetCheckpoint),restoredDB=","  let recovered=checkpoint(targetCheckpoint),restoredDB=")
replace("  verifyPromotedPrevious(originalBefore,checkpoint(targetCheckpoint,'previous.json'));aligned(target,recovered,'target-status');","  save('raw-promotion-proof.json',verifyOriginalRawPromotion(targetCheckpoint,rawRetained,canonicalRetained,gitBefore.entries));aligned(target,recovered,'target-status');")
replace("  const gitAfter=indexState(target,'after-restore');const staging=verifyPublicationIndex(gitBefore,gitAfter,targetCheckpoint);","  const gitAfter=indexState(target,'after-restore');const staging=verifyInitialPublicationIndex(gitBefore,gitAfter,targetCheckpoint,rawRetained,canonicalRetained);")
replace("unrelated.index_entries['unrelated.txt'].blob='0'.repeat(40);assert.throws(()=>verifyPublicationIndex(gitBefore,unrelated,targetCheckpoint),/unrelated index entry/);","unrelated.index_entries['unrelated.txt'].blob='0'.repeat(40);assert.throws(()=>verifyInitialPublicationIndex(gitBefore,unrelated,targetCheckpoint,rawRetained,canonicalRetained),/unrelated index entry/);")
changed=r"""  const changedEvent=structuredClone(recovered);changedEvent.corpus.event[PIN.uuid+':1']='0'.repeat(64);assert.throws(()=>verifyRestoredCorpus(incoming,changedEvent,recovery.report,PIN.actor),/Missing\/changed event/);
"""
replace(changed,'')
replace("  // Exercise the later ordinary flush after the sole cleanup mutation.",r"""  assert.throws(()=>verifyPublicationIndex(gitBefore,gitAfter,targetCheckpoint),/Staged checkpoint bytes differ/,'The old strict initial verifier must demonstrate the actual CRLF mismatch');
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
  // Exercise the later ordinary flush after the sole cleanup mutation.""")
replace("equal(checkpoint(original),originalBefore)","assert.equal(digest(checkpoint(original)),originalFingerprint)",count=2)
replace("  verifyPublicationIndex(beforeCleanup,indexState(target,'after-final-flush'),targetCheckpoint);",r"""  const finalGit=indexState(target,'after-final-flush');save('final-staging-reconciliation.json',verifyPublicationIndex(beforeCleanup,finalGit,targetCheckpoint));
  assert.throws(()=>verifyInitialPublicationIndex(beforeCleanup,finalGit,targetCheckpoint,rawRetained,canonicalRetained),/immutable original tree/,'Initial exception is unavailable for the final generation');
  assert.equal(hash(path.join(target,'.git/config')),gitConfigHash);recovered=null;""")
replace("scope:'Disposable checkpoint-only recovery and final cleanup publication with exact public original corpus and synthetic accepted-plan shape'","scope:'Disposable actual-CRLF original recovery, canonical old-generation restore and both native publications with exact 53-object original tree and synthetic accepted-plan shape'")
replace("    original_counts:{issues:954","    exec_argv:process.execArgv,node_version:process.version,observed_original_raw_manifest:rawManifest,canonical_original_manifest:originalManifest(false),core_autocrlf:'true',git_config_unchanged:true,\n    original_counts:{issues:954")
replace("incoming_counts:{issues:incoming.pointer.issue_count,events:incoming.pointer.event_count,receipts:incoming.pointer.receipt_count,outcomes:incoming.pointer.attempt_outcome_count},\n    recovered_local_sequence:recovered.pointer.snapshot_sequence,restore_added_events:1,restore_added_receipts:1,resource_locks_reconstructed:Object.keys(restoredDB.resourceLocks).length,","incoming_counts:fixtureSummary.incoming_counts,\n    recovered_local_sequence:fixtureSummary.recovered_local_sequence,restore_added_events:1,restore_added_receipts:1,resource_locks_reconstructed:fixtureSummary.resource_locks_reconstructed,")
replace("original_pointer_preserved_as_previous:true,final_flush_and_restore_passed:true,focused_refusals:4","original_raw_pointer_preserved_as_previous:true,raw_original_restore_refused:true,canonical_original_restore_passed:true,initial_previous_only_normalization_verified:true,final_flush_and_restore_passed:true,focused_refusals:10")
(HERE/'qualify-checkpoint-crlf.mjs').write_text(text)
(HERE/'qualification-transformations.json').write_text(json.dumps({'source_sha256':sha(baseline),'changes':changes},indent=2)+'\n')
print(json.dumps({'bytes':len(text.encode()),'sha256':sha(text.encode()),'transforms':len(changes)}))
