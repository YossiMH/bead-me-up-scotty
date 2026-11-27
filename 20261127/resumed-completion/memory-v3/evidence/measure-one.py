from pathlib import Path
import json,subprocess,sys,time,psutil
r=Path(__file__).resolve().parent
name=sys.argv[1]
flags=sys.argv[2:]
command=[str(r/'node-v25.2.1'),'--max-old-space-size=128',*flags,str(r/'profile-restore-memory.mjs'),name]
start=time.monotonic();samples=[];peak_node=peak_native=peak_aggregate=0
out=r/(name+'.outer.stdout');err=r/(name+'.outer.stderr')
with out.open('wb') as stdout,err.open('wb') as stderr:
 child=subprocess.Popen(command,stdout=stdout,stderr=stderr)
 while child.poll() is None:
  try:
   p=psutil.Process(child.pid);n=p.memory_info().rss;desc=[]
   for c in p.children(recursive=True):
    try:desc.append({'pid':c.pid,'name':c.name(),'rss':c.memory_info().rss})
    except psutil.NoSuchProcess:pass
   native=sum(x['rss']for x in desc);aggregate=n+native
   peak_node=max(peak_node,n);peak_native=max(peak_native,native);peak_aggregate=max(peak_aggregate,aggregate)
   samples.append({'elapsed_seconds':time.monotonic()-start,'node_rss':n,'descendants':desc,'aggregate_rss':aggregate})
  except psutil.NoSuchProcess:pass
  if time.monotonic()-start>160:child.kill();child.wait();raise RuntimeError('Cloud profile deadline')
  time.sleep(.02)
result={'schema_version':1,'name':name,'command':command,'status':child.returncode,'duration_seconds':time.monotonic()-start,'peak_node_rss':peak_node,'peak_native_rss':peak_native,'peak_node_and_native_rss':peak_aggregate,'samples':samples}
(r/(name+'.external-memory.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items()if k!='samples'}))
print(out.read_text()[-2000:]);print(err.read_text()[-2000:])
sys.exit(child.returncode)
