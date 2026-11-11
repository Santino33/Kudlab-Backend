import { approveTg01 } from '../modules/tareas/catalog/approve-tg01.js';
import { pool } from '../db/client.js';

try {
  if (process.argv.slice(2).join(' ') !== '--confirm=KUDLAB-TG01-APPROVAL-20261111-01')
    throw new Error('Explicit approval reference required: --confirm=KUDLAB-TG01-APPROVAL-20261111-01');
  console.log(JSON.stringify(await approveTg01()));
} finally { await pool.end(); }
