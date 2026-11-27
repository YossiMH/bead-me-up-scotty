from pathlib import Path
import hashlib,json
HERE=Path(__file__).resolve().parent
BASE=HERE.parent/'frontend/baseline'
parts=json.loads((HERE/'parts.json').read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
baseline=(BASE/'checkpoint-only-handoff-20261127.mjs').read_bytes()
assert sha(baseline)=='ff1597b37c873888aef55af6c67b39cd29efeb025d007fe11659ccb81a32cc46'
text=baseline.decode();changes=[]
def replace(old,new,count=1):
    global text
    assert text.count(old)==count,(old[:120],text.count(old),count)
    text=text.replace(old,new);changes.append({'before':old,'after':new,'occurrences':count})
replace('// Root-only recovery for the observed checkpoint-only original repository.\n// The prior existing-database merge helper remains immutable and inapplicable.','// Root-only recovery for the observed checkpoint-only CRLF original.\n// Prior existing-database and LF-only helpers remain immutable and inapplicable.')
replace("const PHASES = ['preserve'",parts['constants']+"const PHASES = ['preserve'")
replace('function retainCheckpoint(source,destination) {',parts['helpers']+'function retainCheckpoint(source,destination) {')
replace('export function verifyPublicationIndex(before,after,checkpointDirectory) {','function verifyPublicationIndexInternal(before,after,checkpointDirectory,originalPrevious=false) {')
replace("      assert.equal(next.blob,createHash('sha1').update('blob '+data.length+'\\0').update(data).digest('hex'),'Staged checkpoint bytes differ from verified working bytes: '+name);",r"""      if(originalPrevious && relative==='previous.json') {
        const observed=ORIGINAL_CHECKOUT['current.json'];
        assert.equal(data.length,observed.raw_bytes);assert.equal(digest(data),observed.raw_sha256,'Only exact preserved original current bytes may normalize');
        assert.equal(next.blob,observed.blob,'Promoted previous must stage the exact canonical original current blob');
      } else assert.equal(next.blob,createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex'),'Staged checkpoint bytes differ from verified working bytes: '+name);""")
replace('\nasync function main() {','\n'+parts['indexExports']+'\nasync function main() {')
replace("  const sourcePath=path.join(PIN.retention,'continuation-source/checkpoint');","""  const sourcePath=path.join(PIN.retention,'continuation-source/checkpoint');
  const originalRawPath=path.join(PIN.retention,'original-files/checkpoint-raw');
  const originalCanonicalPath=path.join(PIN.retention,'original-files/checkpoint');""")
replace("  const gitBaseline=pin(request.accepted['original-git-baseline']);","""  const originalGitConfig=git(['rev-parse','--path-format=absolute','--git-path','config'],'git-configuration-path').trim();
  const gitConfiguration=hashFile(originalGitConfig);write('git-configuration-before.json',{path:originalGitConfig,sha256:gitConfiguration});
  const gitBaseline=pin(request.accepted['original-git-baseline']);""")
replace("      assert.equal(git(['config','--default','false','--get','core.autocrlf'],label+'-autocrlf').trim(),'false','Git normalization could conceal original byte changes');","      verifyOriginalCheckout(originalCheckpoint);")
replace("    if(original){\n      assert.equal(head,gitBaseline.head);","""    assert.equal(git(['config','--default','false','--get','core.autocrlf'],label+'-autocrlf').trim(),'true','Expected the observed unchanged built-in checkout configuration');
    if(original){
      assert.equal(head,gitBaseline.head);""")
replace("  const attempted=detail=>write('mutation-attempt.json',{utc:new Date().toISOString(),replay_allowed:false,...detail});","  const attempted=(detail,name='mutation-attempt.json')=>write(name,{utc:new Date().toISOString(),replay_allowed:false,...detail});")
replace("    attempted({operation:'restore into fresh disposable target',target,generation:cp.pointer.generation_id});","    attempted({operation:'restore into fresh disposable target',target,generation:cp.pointer.generation_id},phase==='source-restore'?'continuation-mutation-attempt.json':'mutation-attempt.json');")
replace("  const finish=extra=>{\n    const outputs={};","""  const finish=extra=>{
    assert.equal(hashFile(originalGitConfig),gitConfiguration,'Phase changed Git configuration bytes');
    write('git-configuration-after.json',{path:originalGitConfig,sha256:gitConfiguration});
    const outputs={};""")
start=text.index("    if(phase==='preserve') {",text.index('  try {',text.index("  write('request.json',request);")))
end=text.index("    const preserved=prior('preserve');",start)
replace(text[start:end],parts['preserve'])
replace("    const preserved=prior('preserve');","""    const preserved=prior('preserve');
    const retainedOriginalGit=kept('preserve','original-git-recovery.json');
    const retainedOriginal=verifyOriginalRetention(originalRawPath,originalCanonicalPath,retainedOriginalGit.entries);
    assert.equal(retainedOriginal.raw_manifest_sha256,preserved.checkpoint_manifest_sha256);
    assert.equal(retainedOriginal.canonical_manifest_sha256,preserved.canonical_checkpoint_manifest_sha256);
    assert.equal(gitConfiguration,preserved.original_hashes.git_config,'Original Git configuration changed between phases');""")
restore_line="      const restored=await verifyFreshRestore(sourcePath,source,kept('freeze','inventory.json'),frozenDB,'source-restore-check');"
replace(restore_line,parts['canonicalRestore']+restore_line)
replace("disposable_target:restored.target,original_native_opened:false","disposable_target:restored.target,original_canonical_disposable_target:originalTarget,original_canonical_restore_verified:true,original_native_opened:false")
replace("      const selectedBefore=checkpoint(originalCheckpoint);\n      subsetCorpus","      const selectedBefore=checkpoint(originalCanonicalPath);\n      subsetCorpus")
replace("      const promoted=checkpoint(originalCheckpoint,'previous.json');verifyPromotedPrevious(selectedBefore,promoted);","      const promoted=verifyOriginalRawPromotion(originalCheckpoint,originalRawPath,originalCanonicalPath,gitBefore.entries);")
replace("      write('checkpoint-index-reconciliation.json',verifyPublicationIndex(gitBefore,gitAfter,originalCheckpoint));\n      const directory=path.join(PIN.retention,'published');","      write('checkpoint-index-reconciliation.json',verifyInitialPublicationIndex(gitBefore,gitAfter,originalCheckpoint,originalRawPath,originalCanonicalPath));\n      const directory=path.join(PIN.retention,'published');")
replace("      write('retained-original-generation.json',{status:'passed',generation:selectedBefore.pointer.generation_id,previous_pointer_sha256:promoted.files['previous.json'].sha256,files:promoted.files});","      write('retained-original-generation.json',promoted);")
replace("original_generation_retained_as_previous:true,git_publication:'root pending'","original_raw_current_retained_as_previous:true,original_previous_natively_restorable:false,original_canonical_restore_verified:true,git_publication:'root pending'")
history=text.encode();history_sha=sha(history)
(HERE/'checkpoint-only-handoff-crlf-20261127.mjs').write_bytes(history)
(HERE/'history-transformations.json').write_text(json.dumps({'source_sha256':sha(baseline),'changes':changes},indent=2)+'\n')
supervisor=(BASE/'checkpoint-only-handoff-supervisor-20261127.ps1').read_bytes()
assert sha(supervisor)=='1dd2e70b74236b87f5192ea1d9129ccdaa059b14e47f4bdd8fc8ebe3046341f5'
supervisor=supervisor.replace(b"'checkpoint-only-handoff-20261127.mjs'",b"'checkpoint-only-handoff-crlf-20261127.mjs'")
(HERE/'checkpoint-only-handoff-crlf-supervisor-20261127.ps1').write_bytes(supervisor)
pub=HERE.parent/'git-publication-packet'
baseline=(pub/'publish-reviewed-git-20261127.mjs').read_bytes()
assert sha(baseline)=='3c464a11e13ab56d540175448994eeccb2577ca0875d59f37f57c459185301e1'
text=baseline.decode();changes=[]
replace('checkpoint-only-handoff-20261127.mjs','checkpoint-only-handoff-crlf-20261127.mjs')
replace('ff1597b37c873888aef55af6c67b39cd29efeb025d007fe11659ccb81a32cc46',history_sha)
replace("  equal(history.verifyPublicationIndex(initial, before, path.join(repo.path, '.beads/checkpoint')), reconciliation, 'Staged checkpoint reconciliation changed');","""  for(const [record,name] of [[publication,publicationName],[verification,verificationName]]) assert.equal(phaseOutput(record,name,'request.json').helper_sha256,PIN.historySha,'Checkpoint phase used a different history compatibility helper');
  const checkedIndex = request.checkpoint_stage === 'initial'
    ? history.verifyInitialPublicationIndex(initial, before, path.join(repo.path, '.beads/checkpoint'), path.join(PIN.retention, 'original-files/checkpoint-raw'), path.join(PIN.retention, 'original-files/checkpoint'))
    : history.verifyPublicationIndex(initial, before, path.join(repo.path, '.beads/checkpoint'));
  equal(checkedIndex, reconciliation, 'Staged checkpoint reconciliation changed');""")
(HERE/'publish-reviewed-git-crlf-20261127.mjs').write_text(text)
(HERE/'publisher-transformations.json').write_text(json.dumps({'source_sha256':sha(baseline),'changes':changes},indent=2)+'\n')
pub_supervisor=(pub/'publish-reviewed-git-supervisor-20261127.ps1').read_bytes()
assert sha(pub_supervisor)=='a36a79e39e593016a6db050293a6e91908b3a7e4cd2d9f992a96764efc5e0abc'
pub_supervisor=pub_supervisor.replace(b"'publish-reviewed-git-20261127.mjs'",b"'publish-reviewed-git-crlf-20261127.mjs'")
pub_supervisor=pub_supervisor.replace(b'checkpoint-only-handoff-20261127.mjs',b'checkpoint-only-handoff-crlf-20261127.mjs')
pub_supervisor=pub_supervisor.replace(b'ff1597b37c873888aef55af6c67b39cd29efeb025d007fe11659ccb81a32cc46',history_sha.encode())
(HERE/'publish-reviewed-git-crlf-supervisor-20261127.ps1').write_bytes(pub_supervisor)
request=json.loads((BASE/'request.template.json').read_text())
request['helper_sha256']=history_sha;request['supervisor_sha256']=sha(supervisor)
(HERE/'history-request.template.json').write_text(json.dumps(request,indent=2)+'\n')
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in HERE.glob('*') if p.is_file()},indent=2))
