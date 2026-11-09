import { validateDocument } from './validate-document.js';

try { process.stdout.write(JSON.stringify(await validateDocument('/work/input'))); }
catch { process.stdout.write('{"kind":"unavailable"}'); }
