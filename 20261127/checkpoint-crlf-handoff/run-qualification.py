from pathlib import Path
import subprocess,hashlib,json,time,datetime,os
base=Path('/workspace/scratch/2889282bfcec/recovery/checkpoint-crlf-compatibility')
run=base/'qualification-run-5';run.mkdir()
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
config=subprocess.check_output(['git','-C','/tmp/beads-2889282bfcec/native','show','2d801ba455b7a722daf644a7615445117d57e8e9:.beads/config.json'])
assert len(config)==123
(base/'fixture-config.json').write_bytes(config)
cmd=['/tmp/qualified-node25-recovery/node','--max-old-space-size=128',str(base/'qualify-checkpoint-crlf.mjs'),'--binary','/tmp/qualified-linux-final-recovery/extracted/release/bead-editing-2d801ba-linux-20261125','--original','/tmp/qualified-linux-final-recovery/extracted/public-original','--config',str(base/'fixture-config.json'),'--plan','/workspace/scratch/2889282bfcec/recovery/frontend/baseline/plan-revision9-recovered.json','--output','/tmp/checkpoint-crlf-qualification-5','--repository','/tmp/beads-2889282bfcec/native']
started=time.monotonic()
record={'schema_version':1,'command':cmd,'cwd':str(base),'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'node_sha256':sha(cmd[0]),'helper_sha256':sha(base/'checkpoint-only-handoff-crlf-20261127.mjs'),'qualifier_sha256':sha(base/'qualify-checkpoint-crlf.mjs'),'maximum_old_space_mib':128,'pc_executed':False,'scope':'Reconstructed candidate after cloud reset; whole-fixture graphs are explicitly released after their assertions. Actual runtime phases use separate processes.'}
(run/'invocation.json').write_text(json.dumps(record,indent=2)+'\n')
with (run/'stdout').open('xb') as out,(run/'stderr').open('xb') as err:
    child=subprocess.Popen(cmd,cwd=base,stdout=out,stderr=err,start_new_session=True)
    try:code=child.wait(timeout=190)
    except subprocess.TimeoutExpired:
        import signal
        os.killpg(child.pid,signal.SIGKILL);child.wait()
        code=child.returncode;record['outer_timeout']=True
record.update({'ended_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'duration_ms':round((time.monotonic()-started)*1000),'exit_code':code,'stdout_sha256':sha(run/'stdout'),'stderr_sha256':sha(run/'stderr')})
(run/'exit.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
