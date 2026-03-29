/**
 * Simple file-backed session store.
 *
 * Sessions are persisted to SESSIONS_FILE (default: ~/.freshbooks-mcp/sessions.json)
 * so they survive server restarts. Each entry maps a session token to a set of
 * FreshBooks tokens.
 *
 * This is intentionally simple — single-instance only. For multi-instance
 * deployments, swap this out for a Redis or database-backed store.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { StoredTokens } from './freshbooks/types.js';

const SESSIONS_FILE =
  process.env.SESSIONS_FILE ?? join(homedir(), '.freshbooks-mcp', 'sessions.json');

type SessionMap = Record<string, StoredTokens>;

function load(): SessionMap {
  try {
    return JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')) as SessionMap;
  } catch {
    return {};
  }
}

function save(data: SessionMap): void {
  mkdirSync(dirname(SESSIONS_FILE), { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export const sessionStore = {
  get(token: string): StoredTokens | undefined {
    return load()[token];
  },

  set(token: string, value: StoredTokens): void {
    const data = load();
    data[token] = value;
    save(data);
  },

  delete(token: string): void {
    const data = load();
    delete data[token];
    save(data);
  },
};
