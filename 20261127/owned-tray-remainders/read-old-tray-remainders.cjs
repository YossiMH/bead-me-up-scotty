const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
const started = Date.now();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function check() {
  if (Date.now() - started > 15000 || os.freemem() < 1073741824 || process.memoryUsage().rss > 134217728) throw Error('Resource condition not met');
}
function ordinary(p, directory) {
  check();
  for (let q = p; q.length > 3; q = path.dirname(q)) {
    const st = fs.lstatSync(q);
    if (st.isSymbolicLink() || (q === p && !directory ? !st.isFile() : !st.isDirectory())) throw Error('Nonordinary path');
  }
}
function read(p, limit) {
  ordinary(p, false);
  const before = fs.statSync(p, { bigint: true });
  if (before.size > BigInt(limit)) throw Error('File exceeds limit');
  const b = fs.readFileSync(p);
  const after = fs.statSync(p, { bigint: true });
  for (const k of ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs']) if (before[k] !== after[k]) throw Error('File changed');
  if (BigInt(b.length) !== before.size) throw Error('Read length changed');
  check(); return b;
}
try {
  check();
  const root = 'C:/Users/YossiMH/AppData/Local/bead-me-up-scotty';
  const folders = [root + '/tray/session-LEmh0Z', root + '/tray-smoke/session-cPU56F'];
  const caches = folders.map(p => {
    try { ordinary(p, true); } catch (e) { if (e.code === 'ENOENT') return { path: p, present: false }; throw e; }
    const names = fs.readdirSync(p); if (names.length > 8) throw Error('Unexpected cache entry count');
    return { path: p, present: true, entries: names.sort().map(name => {
      if (!['windows-tray.ps1', 'windows-tray-click.ps1'].includes(name)) throw Error('Unexpected cache name');
      const b = read(path.join(p, name), 131072); return { name, bytes: b.length, sha256: sha(b) };
    }) };
  });
  const inventoryPath = 'F:/Dev/.bead-edit-20261111/coordination-20261124/scheduled-task-readback-20261127-v1/result.json';
  const inventory = read(inventoryPath, 131072);
  if (inventory.length !== 100788 || sha(inventory) !== '97971b4fb451e6be8839d8ca7e37a8d49f486d1b3b81aaeaf754293d3e7cbd4f') throw Error('Task inventory changed');
  const taskName = 'ChatGPT-BeadEditing-TrayHost-20261127-2889282bfcec';
  const matches = JSON.parse(inventory.toString('utf8')).tasks.filter(t => t.name === taskName);
  if (matches.length !== 1 || typeof matches[0].xml !== 'string') throw Error('Expected task definition missing');
  const match = /<Arguments>([\s\S]*?)<\/Arguments>/.exec(matches[0].xml);
  if (!match) throw Error('Task arguments missing');
  const outputMatch = /-EvidenceDirectory\s+(F:\\Dev\\\.bead-edit-20261111\\[a-zA-Z0-9-]+)(?:\s|&quot;|$)/.exec(match[1]);
  if (!outputMatch) throw Error('Exact old output directory not found');
  const output = outputMatch[1].replaceAll('\\', '/');
  const resultPath = output + '/result.json';
  const result = read(resultPath, 1048576);
  if (sha(result) !== '0974b117a9586541024de04f1d2b4c87db59362dfd37556d57f355dbee815370') throw Error('Old result differs');
  const compressed = zlib.gzipSync(result, { level: 1 });
  const value = { status: 'read', caches, old_result: { path: resultPath, bytes: result.length, sha256: sha(result), encoding: 'gzip+base64', gzip_bytes: compressed.length, gzip_sha256: sha(compressed), base64: compressed.toString('base64') }, elapsed_ms: Date.now() - started, own_rss: process.memoryUsage().rss, free_bytes: os.freemem() };
  const line = JSON.stringify(value); if (line.length > 60000) throw Error('Response too large');
  console.log(line);
} catch (e) { console.log(JSON.stringify({ status: 'stopped', error: e.message, elapsed_ms: Date.now() - started })); process.exitCode = 1; }
