import { publishTg07 } from '../modules/tareas/catalog/publish-tg07.js';
import { db } from '../db/client.js';

try { await publishTg07(); console.log('TG-07 reference registered; availability and methodological approval unchanged.'); }
finally { await db.$client.end(); }
