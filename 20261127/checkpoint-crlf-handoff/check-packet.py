from pathlib import Path
import hashlib,json,subprocess,datetime,gzip,base64
B=Path('/workspace/scratch/2889282bfcec/recovery/checkpoint-crlf-compatibility')
F=B.parent/'frontend/baseline'
P=B.parent/'git-publication-packet'
sha=lambda b:hashlib.sha256(b).hexdigest()
checks=[]
for name,source,record in [
 ('checkpoint-only-handoff-crlf-20261127.mjs',F/'checkpoint-only-handoff-20261127.mjs','history-transformations.json'),
 ('publish-reviewed-git-crlf-20261127.mjs',P/'publish-reviewed-git-20261127.mjs','publisher-transformations.json'),
 ('qualify-checkpoint-crlf.mjs',F/'qualify-checkpoint-only.mjs','qualification-transformations.json')]:
 d=json.loads((B/record).read_text());text=(B/name).read_text()
 for change in reversed(d['changes']):
  if change['after']=='':
   assert change['occurrences']==1;offset=change['offset'];text=text[:offset]+change['before']+text[offset:]
  else:
   assert text.count(change['after'])==change['occurrences'],change['after'][:120]
   text=text.replace(change['after'],change['before'])
 assert text.encode()==source.read_bytes();assert sha(text.encode())==d['source_sha256']
 checks.append({'name':'full_inverse_'+name,'status':'passed','source_sha256':d['source_sha256'],'changes':len(d['changes'])})
history_sha=sha((B/'checkpoint-only-handoff-crlf-20261127.mjs').read_bytes())
h=(B/'checkpoint-only-handoff-crlf-supervisor-20261127.ps1').read_bytes().replace(b"'checkpoint-only-handoff-crlf-20261127.mjs'",b"'checkpoint-only-handoff-20261127.mjs'")
assert h==(F/'checkpoint-only-handoff-supervisor-20261127.ps1').read_bytes()
p=(B/'publish-reviewed-git-crlf-supervisor-20261127.ps1').read_bytes().replace(b"'publish-reviewed-git-crlf-20261127.mjs'",b"'publish-reviewed-git-20261127.mjs'").replace(b'checkpoint-only-handoff-crlf-20261127.mjs',b'checkpoint-only-handoff-20261127.mjs').replace(history_sha.encode(),b'ff1597b37c873888aef55af6c67b39cd29efeb025d007fe11659ccb81a32cc46')
assert p==(P/'publish-reviewed-git-supervisor-20261127.ps1').read_bytes()
checks.append({'name':'full_supervisor_inversions_and_CSharp_unchanged','status':'passed','history_base_sha256':sha(h),'publisher_base_sha256':sha(p)})
request=(B/'history-request.template.json').read_bytes()
request=request.replace(history_sha.encode(),b'ff1597b37c873888aef55af6c67b39cd29efeb025d007fe11659ccb81a32cc46').replace(sha((B/'checkpoint-only-handoff-crlf-supervisor-20261127.ps1').read_bytes()).encode(),b'1dd2e70b74236b87f5192ea1d9129ccdaa059b14e47f4bdd8fc8ebe3046341f5')
assert request==(F/'request.template.json').read_bytes()
checks.append({'name':'inert_template_only_two_identity_changes','status':'passed'})
syntax=[]
for filename in ['checkpoint-only-handoff-crlf-20261127.mjs','publish-reviewed-git-crlf-20261127.mjs','qualify-checkpoint-crlf.mjs']:
 command=['/tmp/qualified-node25-recovery/node','--check',str(B/filename)]
 r=subprocess.run(command,capture_output=True);assert r.returncode==0
 syntax.append({'command':command,'exit_code':r.returncode,'stdout_sha256':sha(r.stdout),'stderr_sha256':sha(r.stderr)})
e=json.loads((B/'qualification-evidence.json').read_text())
encoded=''.join((B/part['path']).read_text().replace('\n','') for part in e['parts'])
for part in e['parts']:assert sha((B/part['path']).read_bytes())==part['sha256']
packed=base64.b64decode(encoded,validate=True);assert sha(packed)==e['gzip_sha256'];payload=gzip.decompress(packed);assert sha(payload)==e['payload_json_sha256']
embedded=json.loads(payload)['files_base64'];assert len(embedded)==215
for name,value in embedded.items():
 data=base64.b64decode(value,validate=True);expected=e['files'][name]
 assert len(data)==expected['bytes'];assert sha(data)==expected['sha256'];assert data==(Path(e['root'])/name).read_bytes()
result=json.loads((B/'qualification-result.json').read_text());assert result['status']=='passed';assert result['helper_sha256']==history_sha
assert result['qualification_sha256']==sha((B/'qualify-checkpoint-crlf.mjs').read_bytes())
negative=[]
for cmd in result['commands']:
 record=json.loads((Path(e['root'])/(cmd['label']+'.exit.json')).read_text());assert record==cmd
 if cmd['status']!=0:negative.append(cmd['label'])
 for suffix in ['.stdout','.stderr','.exit.json']:
  name=cmd['label']+suffix;assert name in embedded or name in e['immutable_git_stdout']
assert negative==['raw-original-restore-refused'];assert result['all_issue_scopes_compared']==1009;assert result['focused_refusals']==10
for name,ref in e['immutable_git_stdout'].items():
 data=(Path(e['root'])/name).read_bytes();assert sha(data)==e['files'][name]['sha256']
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==ref['git_blob']
checks.append({'name':'actual_qualification_and_embedded_records','status':'passed','commands':66,'raw_command_files':198,'embedded_files':215,'immutable_git_stdout_files':2,'negative_commands':negative,'fixture_file_index':len(e['files'])})
record={'schema_version':1,'status':'passed','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'syntax':syntax,'git_version':subprocess.check_output(['git','--version']).decode().strip(),'pc_executed':False,'ordinary_windows_ps51_parse':'pending root exact actual receipt','independent_review':'pending'}
(B/'author-checks.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':len(checks),'syntax_checks':len(syntax),'record_sha256':sha((B/'author-checks.json').read_bytes())}))
