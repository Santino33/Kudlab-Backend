import { assertLocalSynthetic } from '../config/local-synthetic.js';

// Validate before importing database modules. Preparation is never part of startup.
assertLocalSynthetic();
const { prepareLocalTg01 } = await import('../modules/tareas/catalog/prepare-local.js');
const { pool } = await import('../db/client.js');
try { console.log(JSON.stringify(await prepareLocalTg01())); }
catch { console.error('No se confirmó la preparación local de TG-01. Revise compatibilidad y base de datos.'); process.exitCode = 1; }
finally { await pool.end(); }
