import { readFileSync } from 'node:fs';
import type { AddressInfo, Socket } from 'node:net';
import { SMTPServer } from 'smtp-server';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

export const testCA = readFileSync(new URL('./ca.pem', import.meta.url));
type Mode = 'accept' | 'reject-auth' | 'reject-recipient' | 'reject-data' | 'disconnect-data' | 'no-starttls';
export async function startSmtp(mode: Mode = 'accept', implicit = false) {
  const messages: string[] = [];
  const sockets = new Set<Socket>();
  let attempts = 0;
  const reject = () => Object.assign(new Error('Fictitious SMTP rejection'), { responseCode: 550 });
  const server = new SMTPServer({ secure: implicit, key: readFileSync(new URL('./server-key.pem', import.meta.url)),
    cert: readFileSync(new URL('./server-cert.pem', import.meta.url)), logger: false,
    ...(mode === 'no-starttls' ? { disabledCommands: ['STARTTLS'] } : {}),
    onConnect(_session, cb) { attempts++; cb(); },
    onAuth(auth, _session, cb) { cb(mode === 'reject-auth' ? reject() : null, { user: auth.username }); },
    onRcptTo(_address, _session, cb) { cb(mode === 'reject-recipient' ? reject() : null); },
    onData(stream, _session, cb) {
      let data = '';
      stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      stream.on('end', () => {
        messages.push(data);
        if (mode === 'disconnect-data') { for (const socket of sockets) socket.destroy(); return; }
        cb(mode === 'reject-data' ? reject() : undefined);
      });
    },
  });
  server.on('error', () => { /* TLS-negative cases intentionally cause server-side errors. */ });
  server.server.on('connection', (socket: Socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise<void>((resolve, rejectListen) => {
    server.server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => { server.server.removeListener('error', rejectListen); resolve(); });
  });
  const port = (server.server.address() as AddressInfo).port;
  return { messages, get attempts() { return attempts; },
    env: { MAIL_MODE: 'smtp', MAIL_HOST: 'localhost', MAIL_PORT: String(port), MAIL_USER: 'local-test',
      MAIL_PASSWORD: 'local-test', MAIL_FROM: 'noreply@pilot.edu.co' },
    trust: (input: unknown): SMTPTransport.Options => {
      const options = input as SMTPTransport.Options;
      return { ...options, secure: implicit, tls: { ...options.tls, ca: testCA, servername: 'localhost' } };
    },
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve) => server.close(() => resolve())); },
  };
}
