import { runtimeConfigSchema, type RuntimeConfig } from '@daiq/domain';
import { prettifyError } from 'zod';

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Loads /config.json at startup so one build serves every deployment (ADR-0012). */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
  if (!response.ok) {
    throw new ConfigError(`config.json could not be loaded (HTTP ${response.status}).`);
  }
  const parsed = runtimeConfigSchema.safeParse(await response.json());
  if (!parsed.success) throw new ConfigError(prettifyError(parsed.error));
  return parsed.data;
}
