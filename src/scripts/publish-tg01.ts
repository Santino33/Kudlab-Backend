import { publishTg01 } from '../modules/tareas/catalog/publish.js';
import { pool } from '../db/client.js';
try { console.log(JSON.stringify({ publishedVersionId: await publishTg01(), methodology: 'PROPOSED' })); }
finally { await pool.end(); }
