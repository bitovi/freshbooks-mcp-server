/**
 * Minimal .env file loader — reads key=value pairs from a .env file and sets
 * any variables that aren't already defined in process.env.
 *
 * This lets the server be launched without --env-file (e.g. from Claude Desktop
 * which may use an older Node that doesn't support that flag).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv(path: string = resolve(process.cwd(), '.env')) {
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return; // No .env file — that's fine
  }

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    const raw = trimmed.slice(eqIdx + 1).trim();
    // Strip optional surrounding quotes
    const value = raw.replace(/^(['"`])(.*)\1$/, '$2');

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
