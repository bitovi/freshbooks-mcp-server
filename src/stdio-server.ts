/**
 * Stdio transport — for local testing with MCP inspector or Claude Desktop.
 *
 * Requires a valid FreshBooks access token, either:
 *   - FRESHBOOKS_ACCESS_TOKEN env var  (quick testing)
 *   - Run `npm run dev:http` first, complete OAuth in a browser, then copy the
 *     session token — or obtain a token directly from FreshBooks developer console.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp-server.js';
import { FreshBooksClient } from './freshbooks/client.js';
import { config } from './config.js';
import axios from 'axios';
import type { StoredTokens } from './freshbooks/types.js';

// ── Token persistence ─────────────────────────────────────────────────────────

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const TOKEN_DIR = join(homedir(), '.freshbooks-mcp');
const TOKEN_FILE = join(TOKEN_DIR, 'tokens.json');

async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await readFile(TOKEN_FILE, 'utf8');
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(TOKEN_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

async function refreshIfNeeded(tokens: StoredTokens): Promise<StoredTokens> {
  if (!config.freshbooks.clientId || !config.freshbooks.clientSecret) return tokens;
  if (tokens.expires_at - Date.now() > 60_000) return tokens;

  const { data } = await axios.post(config.freshbooks.tokenUrl, {
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: config.freshbooks.clientId,
    client_secret: config.freshbooks.clientSecret,
  });

  const next: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  await saveTokens(next);
  return next;
}

// ── Resolve access token ──────────────────────────────────────────────────────

async function resolveAccessToken(): Promise<string> {
  // 1. Direct env var (highest priority — useful for CI / quick tests)
  if (process.env.FRESHBOOKS_ACCESS_TOKEN) {
    return process.env.FRESHBOOKS_ACCESS_TOKEN;
  }

  // 2. Persisted tokens from a previous OAuth flow
  const stored = await loadTokens();
  if (stored) {
    try {
      const refreshed = await refreshIfNeeded(stored);
      return refreshed.access_token;
    } catch (err) {
      console.error('Failed to refresh stored token:', err);
    }
  }

  // 3. Build tokens from FRESHBOOKS_REFRESH_TOKEN env var
  if (process.env.FRESHBOOKS_REFRESH_TOKEN && config.freshbooks.clientId) {
    try {
      const { data } = await axios.post(config.freshbooks.tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: process.env.FRESHBOOKS_REFRESH_TOKEN,
        client_id: config.freshbooks.clientId,
        client_secret: config.freshbooks.clientSecret,
      });
      const next: StoredTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? process.env.FRESHBOOKS_REFRESH_TOKEN,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      await saveTokens(next);
      return next.access_token;
    } catch (err) {
      console.error('Failed to exchange refresh token:', err);
    }
  }

  console.error(
    'No FreshBooks access token found.\n' +
      'Provide one of:\n' +
      '  • FRESHBOOKS_ACCESS_TOKEN env var\n' +
      '  • FRESHBOOKS_REFRESH_TOKEN + FRESHBOOKS_CLIENT_ID + FRESHBOOKS_CLIENT_SECRET env vars\n' +
      '  • Run the HTTP server first (MODE=http) and complete OAuth in a browser,\n' +
      '    then tokens will be stored in ~/.freshbooks-mcp/tokens.json\n'
  );
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function startStdioServer() {
  const accessToken = await resolveAccessToken();

  // We create one client per server start; the FreshBooksClient caches the
  // identity (account ID / business ID) after the first API call.
  const fbClient = new FreshBooksClient(accessToken);

  const mcpServer = createMcpServer(() => fbClient);
  const transport = new StdioServerTransport();

  await mcpServer.connect(transport);
}
