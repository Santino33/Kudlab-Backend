import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink, chmod } from 'node:fs/promises';

const socket = '/socket/validator.sock';
async function cpuUsage() {
  const value = (await readFile('/sys/fs/cgroup/cpu.stat', 'utf8')).match(/^usage_usec (\d+)$/m)?.[1];
  if (!value) throw new Error('CPU accounting unavailable');
  return Number(value);
}
if ((await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim() !== '536870912') throw new Error('Dedicated memory limit required');
if ((await readFile('/sys/fs/cgroup/cpu.max', 'utf8')).trim() !== '100000 100000') throw new Error('Dedicated one-CPU quota required');
await cpuUsage();
let busy = false;
const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (busy || request.method !== 'POST' || request.url !== '/validate') {
    response.writeHead(503).end('{"kind":"unavailable"}'); return;
  }
  busy = true;
  let child: ReturnType<typeof spawn> | undefined, stopped = false;
  const stop = () => {
    stopped = true;
    if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
    if (!response.writableEnded) response.writeHead(503).end('{"kind":"unavailable"}');
    request.destroy();
  };
  const deadline = setTimeout(stop, 30000);
  response.on('close', () => { if (!response.writableEnded) stop(); });
  let monitor: ReturnType<typeof setInterval> | undefined;
  try {
    const baseline = await cpuUsage();
    // Stop early to reserve one CPU-second for supervision and process-tree termination.
    monitor = setInterval(() => { void cpuUsage().then(value => { if (value - baseline >= 14000000) stop(); }, stop); }, 25);
    const parts: Buffer[] = []; let length = 0;
    for await (const part of request) {
      length += (part as Buffer).length;
      if (length > 10485760) { stop(); break; }
      parts.push(part as Buffer);
    }
    if (stopped) return;
    if (!length) { response.writeHead(400).end('{"kind":"invalid"}'); return; }
    await writeFile('/work/input', Buffer.concat(parts), { mode: 0o600 });
    if (stopped) return;
    child = spawn(process.execPath, ['--import', 'tsx', 'src/modules/academico/consents/validator-job.ts'], {
      detached: true, env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C', HOME: '/work', TMPDIR: '/work' },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let output = '';
    child.stdout!.on('data', (part: Buffer) => { output += part.toString(); if (output.length > 1024) stop(); });
    const code = await new Promise<number | null>((resolve, reject) => { child!.on('error', reject); child!.on('close', resolve); });
    if (stopped) return;
    const result: unknown = JSON.parse(output);
    if (code !== 0 || !result || typeof result !== 'object' || !('kind' in result)
      || !['valid', 'invalid', 'unsupported', 'unavailable'].includes(String(result.kind))) throw new Error('Unconfirmed result');
    response.writeHead(result.kind === 'unavailable' ? 503 : 200).end(JSON.stringify(result));
  } catch { if (!response.writableEnded) response.writeHead(503).end('{"kind":"unavailable"}'); }
  finally {
    clearTimeout(deadline); clearInterval(monitor);
    if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
    await unlink('/work/input').catch(() => undefined);
    busy = false;
  }
});
server.requestTimeout = 30000; server.headersTimeout = 5000; server.maxHeadersCount = 16;
await unlink(socket).catch(error => { if (error.code !== 'ENOENT') throw error; });
server.listen(socket, () => { void chmod(socket, 0o600); });
