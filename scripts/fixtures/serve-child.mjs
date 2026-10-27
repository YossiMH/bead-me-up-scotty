import fs from 'node:fs';

const [behavior, restartMarker] = process.argv.slice(2);
if (behavior === 'exit') process.exit(17);
if (behavior === 'restart') {
  if (fs.existsSync(restartMarker)) process.exit(17);
  fs.writeFileSync(restartMarker, 'started');
  process.exit(75);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    process.stdout.write(`received:${signal}\n`);
    if (behavior === 'graceful') process.exit(0);
  });
}
process.stdout.write(`ready:${process.pid}\n`);
setInterval(() => {}, 1000);
