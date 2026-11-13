import { publishTg03 } from '../modules/tareas/catalog/publish-tg03.js';
import { pool } from '../db/client.js';

try { await publishTg03(); console.log('TG-03 reference registered; availability and methodological approval unchanged.'); }
finally { await pool.end(); }
