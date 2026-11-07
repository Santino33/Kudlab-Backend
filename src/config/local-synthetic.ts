import { loadEnv } from './env.js';
import type { GameDependencies } from '../modules/academico/shared/participation.js';

export function assertLocalSynthetic() {
  if (!loadEnv().KUDLAB_LOCAL_SYNTHETIC_ENABLED) throw new Error('LOCAL_SYNTHETIC_MODE_REQUIRED');
}

export function startupGameDependencies(): GameDependencies {
  return loadEnv().KUDLAB_LOCAL_SYNTHETIC_ENABLED ? { localSynthetic: true } : {};
}
