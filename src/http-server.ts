/**
 * HTTP server for claude.ai custom connector support.
 *
 * Implements:
 *  - MCP over SSE  (GET /sse + POST /messages)
 *  - OAuth2 proxy  that forwards to FreshBooks OAuth and issues its own
 *    session tokens back to the MCP client (e.g. claude.ai)
 *  - MCP OAuth discovery endpoints required by the spec
 *
 * Flow:
 *   1. claude.ai hits GET /sse → gets 401 with WWW-Authenticate pointing to
 *      /.well-known/oauth-authorization-server
 *   2. claude.ai reads the metadata and kicks off OAuth with GET /oauth/authorize
 *   3. Server redirects user to FreshBooks → user authenticates → FreshBooks
 *      redirects to GET /oauth/callback
 *   4. Server stores FreshBooks tokens, issues its own short-lived session
 *      token, and redirects to claude.ai's redirect_uri with our auth code
 *   5. claude.ai POSTs to /oauth/token to exchange our code for a session token
 *   6. Subsequent MCP calls include Authorization: Bearer <session_token>
 *   7. Server looks up the FreshBooks access token and calls the API
 */

import https from 'node:https';
import express, { type Request, type Response, type NextFunction } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import selfsigned from 'selfsigned';
import { config, getOAuthCallbackUri } from './config.js';
import { createMcpServer } from './mcp-server.js';
import { FreshBooksClient } from './freshbooks/client.js';
import { sessionStore } from './session-store.js';
import type { StoredTokens } from './freshbooks/types.js';

/** Maps our auth code → { freshbooksTokens, clientRedirectUri } (short-lived, in-memory is fine) */

const pendingCodes = new Map<string, { tokens: StoredTokens; redirectUri: string; state: string }>();

/** Dynamic OAuth clients registered by claude.ai */
interface OAuthClient {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  client_name?: string;
  token_endpoint_auth_method: string;
}
const registeredClients = new Map<string, OAuthClient>();

// ── Active SSE transports ────────────────────────────────────────────────────
const sseTransports = new Map<string, SSEServerTransport>();

// ── Token helpers ─────────────────────────────────────────────────────────────

async function refreshFreshBooksToken(stored: StoredTokens): Promise<StoredTokens> {
  const { data } = await axios.post(config.freshbooks.tokenUrl, {
    grant_type: 'refresh_token',
    refresh_token: stored.refresh_token,
    client_id: config.freshbooks.clientId,
    client_secret: config.freshbooks.clientSecret,
  });
  const next: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? stored.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return next;
}

async function getValidTokens(sessionToken: string): Promise<StoredTokens | null> {
  let stored = sessionStore.get(sessionToken);
  if (!stored) return null;

  // Refresh 60 seconds before expiry
  if (stored.expires_at - Date.now() < 60_000) {
    try {
      stored = await refreshFreshBooksToken(stored);
      sessionStore.set(sessionToken, stored);
    } catch {
      sessionStore.delete(sessionToken);
      return null;
    }
  }
  return stored;
}

// ── Auth middleware ───────────────────────────────────────────────────────────

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer (.+)$/i.exec(header);
  return match?.[1] ?? null;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer realm="${config.server.url}", resource_metadata="${config.server.url}/.well-known/oauth-protected-resource"`
    );
    res.status(401).json({ error: 'unauthorized', error_description: 'Bearer token required' });
    return;
  }

  const tokens = await getValidTokens(token);
  if (!tokens) {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer realm="${config.server.url}", error="invalid_token"`
    );
    res.status(401).json({ error: 'invalid_token', error_description: 'Token expired or not found' });
    return;
  }

  // Attach to request for downstream use
  (req as Request & { freshbooksToken: string }).freshbooksToken = tokens.access_token;
  next();
}

// ── Express app ───────────────────────────────────────────────────────────────

export function createHttpServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── CORS (needed for browser-based MCP clients) ──────────────────────────

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, mcp-session-id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // ── Health ────────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'freshbooks-mcp-server' });
  });

  // ── OAuth discovery ───────────────────────────────────────────────────────

  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.json({
      resource: config.server.url,
      authorization_servers: [`${config.server.url}`],
    });
  });

  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json({
      issuer: config.server.url,
      authorization_endpoint: `${config.server.url}/oauth/authorize`,
      token_endpoint: `${config.server.url}/oauth/token`,
      registration_endpoint: `${config.server.url}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['freshbooks'],
    });
  });

  // ── Dynamic client registration (RFC 7591) ────────────────────────────────

  app.post('/oauth/register', (req, res) => {
    const clientId = randomUUID();
    const clientSecret = randomUUID();
    const client: OAuthClient = {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: req.body.redirect_uris ?? [],
      client_name: req.body.client_name,
      token_endpoint_auth_method: req.body.token_endpoint_auth_method ?? 'client_secret_post',
    };
    registeredClients.set(clientId, client);
    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: client.redirect_uris,
      client_name: client.client_name,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
    });
  });

  // ── OAuth authorize ───────────────────────────────────────────────────────
  // claude.ai sends the user here → we redirect to FreshBooks

  app.get('/oauth/authorize', (req, res) => {
    const { redirect_uri, state, client_id } = req.query as Record<string, string>;

    if (!redirect_uri) {
      res.status(400).send('Missing redirect_uri');
      return;
    }

    // Store redirect info in state so the callback can use it
    const oauthState = JSON.stringify({ redirect_uri, state, client_id });
    const encodedState = Buffer.from(oauthState).toString('base64url');

    const fbParams = new URLSearchParams({
      client_id: config.freshbooks.clientId,
      response_type: 'code',
      redirect_uri: getOAuthCallbackUri(),
      state: encodedState,
    });

    res.redirect(`${config.freshbooks.authUrl}?${fbParams.toString()}`);
  });

  // ── OAuth callback ────────────────────────────────────────────────────────
  // FreshBooks sends the user here after auth

  app.get('/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      res.status(400).send(`FreshBooks OAuth error: ${error}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    // local-test: came directly from FreshBooks (via npm run auth-url).
    // Skip the proxy redirect and show the session token in the browser instead.
    const isLocalTest = state === 'local-test';

    let decoded: { redirect_uri: string; state: string; client_id: string } | null = null;
    if (!isLocalTest) {
      try {
        decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      } catch {
        res.status(400).send('Invalid state parameter');
        return;
      }
    }

    // Exchange the FreshBooks code for tokens
    let tokens: StoredTokens;
    try {
      const { data } = await axios.post(config.freshbooks.tokenUrl, {
        grant_type: 'authorization_code',
        code,
        client_id: config.freshbooks.clientId,
        client_secret: config.freshbooks.clientSecret,
        redirect_uri: getOAuthCallbackUri(),
      });
      tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
    } catch (err) {
      console.error('FreshBooks token exchange failed:', err);
      res.status(500).send('Failed to exchange authorization code with FreshBooks');
      return;
    }

    // Issue our own session token
    const sessionToken = randomUUID();
    sessionStore.set(sessionToken, tokens);

    if (isLocalTest) {
      const tokenRow = (id: string, label: string, subtitle: string, value: string, envKey?: string) => `
          <h3>${label} <small style="font-weight:normal;color:#666">(${subtitle})</small></h3>
          <div style="display:flex;align-items:center;gap:0.5rem;background:#f4f4f4;border:1px solid #ddd;border-radius:4px;padding:0.5rem 0.75rem">
            <input id="${id}" type="password" readonly value="${value}"
              style="flex:1;border:none;background:transparent;font-family:monospace;font-size:0.9rem;outline:none" />
            <button onclick="toggle('${id}','eye_${id}')" style="background:none;border:none;cursor:pointer;padding:0;line-height:1" title="Show/hide">
              <span id="eye_${id}">👁</span>
            </button>
            <button onclick="copy('${id}','copy_${id}')" style="background:none;border:none;cursor:pointer;padding:0;line-height:1" title="Copy">
              <span id="copy_${id}">📋</span>
            </button>
          </div>
          ${envKey ? `<p style="font-family:monospace;font-size:0.8rem;color:#555;margin:0.25rem 0 1.25rem">${envKey}=...</p>` : '<p style="margin:0.25rem 0 1.25rem"></p>'}
      `;

      res.send(`
        <html>
        <body style="font-family:sans-serif;padding:2rem;max-width:640px">
          <h2>✅ Authenticated with FreshBooks</h2>

          ${tokenRow('session', 'Session token', 'use with curl or claude.ai SSE connector', sessionToken)}
          ${tokenRow('refresh', 'Refresh token', 'add to .env — never expires', tokens.refresh_token, 'FRESHBOOKS_REFRESH_TOKEN')}
          ${tokenRow('access', 'Access token', 'add to .env — expires in ~12 hours', tokens.access_token, 'FRESHBOOKS_ACCESS_TOKEN')}

          <hr style="margin:1.5rem 0">
          <p style="color:#555;font-size:0.9rem">
            For Claude Desktop, use <code>FRESHBOOKS_REFRESH_TOKEN</code> — the server renews the access token automatically.<br><br>
            Test the SSE endpoint:<br>
            <code>curl -sk ${config.server.url}/sse -H "Authorization: Bearer &lt;session token&gt;"</code>
          </p>

          <script>
            function toggle(id) {
              const input = document.getElementById(id);
              input.type = input.type === 'password' ? 'text' : 'password';
            }
            function copy(id, btnId) {
              const val = document.getElementById(id).value;
              navigator.clipboard.writeText(val).then(() => {
                const btn = document.getElementById(btnId);
                btn.textContent = '✅';
                setTimeout(() => btn.textContent = '📋', 1500);
              });
            }
          </script>
        </body></html>
      `);
      return;
    }

    // Normal proxy flow: issue an auth code for the MCP client (e.g. claude.ai)
    const ourCode = randomUUID();
    pendingCodes.set(ourCode, {
      tokens,
      redirectUri: decoded!.redirect_uri,
      state: decoded!.state,
    });

    // Expire the code after 5 minutes
    setTimeout(() => pendingCodes.delete(ourCode), 5 * 60 * 1000);

    const redirectParams = new URLSearchParams({ code: ourCode, state: decoded!.state });
    res.redirect(`${decoded!.redirect_uri}?${redirectParams.toString()}`);
  });

  // ── OAuth token ───────────────────────────────────────────────────────────
  // claude.ai exchanges our auth code for a session token

  app.post('/oauth/token', (req, res) => {
    const { grant_type, code, refresh_token: incomingRefreshToken } = req.body as Record<string, string>;

    if (grant_type === 'authorization_code') {
      if (!code) {
        res.status(400).json({ error: 'invalid_request', error_description: 'Missing code' });
        return;
      }

      const pending = pendingCodes.get(code);
      if (!pending) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Code not found or expired' });
        return;
      }
      pendingCodes.delete(code);

      const sessionToken = randomUUID();
      const refreshToken = randomUUID();
      sessionStore.set(sessionToken, pending.tokens);
      // Store the refresh token → session token mapping
      sessionStore.set(refreshToken, { ...pending.tokens, access_token: sessionToken });

      res.json({
        access_token: sessionToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: Math.floor((pending.tokens.expires_at - Date.now()) / 1000),
      });
      return;
    }

    if (grant_type === 'refresh_token') {
      if (!incomingRefreshToken) {
        res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token' });
        return;
      }

      const meta = sessionStore.get(incomingRefreshToken);
      if (!meta) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token not found' });
        return;
      }

      // The "access_token" field in the meta stored under refresh token is the old session token
      const oldSessionToken = meta.access_token;
      const freshbooksTokens = sessionStore.get(oldSessionToken);
      if (!freshbooksTokens) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Session not found' });
        return;
      }

      const newSessionToken = randomUUID();
      const newRefreshToken = randomUUID();
      sessionStore.set(newSessionToken, freshbooksTokens);
      sessionStore.set(newRefreshToken, { ...freshbooksTokens, access_token: newSessionToken });
      sessionStore.delete(incomingRefreshToken);
      sessionStore.delete(oldSessionToken);

      res.json({
        access_token: newSessionToken,
        refresh_token: newRefreshToken,
        token_type: 'bearer',
        expires_in: Math.floor((freshbooksTokens.expires_at - Date.now()) / 1000),
      });
      return;
    }

    res.status(400).json({ error: 'unsupported_grant_type' });
  });

  // ── MCP SSE endpoint ──────────────────────────────────────────────────────

  app.get('/sse', requireAuth, async (req: Request, res: Response) => {
    const sessionId = randomUUID();
    const freshbooksToken = (req as Request & { freshbooksToken: string }).freshbooksToken;
    const fbClient = new FreshBooksClient(freshbooksToken);

    const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
    sseTransports.set(sessionId, transport);

    const mcpServer = createMcpServer(() => fbClient);
    await mcpServer.connect(transport);

    req.on('close', () => {
      sseTransports.delete(sessionId);
    });
  });

  // ── MCP message endpoint ──────────────────────────────────────────────────

  app.post('/messages', requireAuth, async (req: Request, res: Response) => {
    const sessionId = req.query['sessionId'] as string;
    const transport = sseTransports.get(sessionId);

    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  // ── Root info ─────────────────────────────────────────────────────────────

  app.get('/', (_req, res) => {
    res.json({
      name: 'FreshBooks MCP Server',
      version: '1.0.0',
      mcp: {
        sse: `${config.server.url}/sse`,
        messages: `${config.server.url}/messages`,
      },
      oauth: {
        authorization: `${config.server.url}/oauth/authorize`,
        token: `${config.server.url}/oauth/token`,
        registration: `${config.server.url}/oauth/register`,
      },
    });
  });

  return app;
}

export async function startHttpServer() {
  if (!config.freshbooks.clientId || !config.freshbooks.clientSecret) {
    console.error('Error: FRESHBOOKS_CLIENT_ID and FRESHBOOKS_CLIENT_SECRET must be set.');
    process.exit(1);
  }

  const app = createHttpServer();
  const port = config.server.port;

  if (config.server.https) {
    // Self-signed cert for local HTTPS testing (browser OAuth flow).
    // selfsigned v5 is async; options type definitions lag behind the runtime API.
    const pems = await selfsigned.generate(
      [{ name: 'commonName', value: 'localhost' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { days: 365, keySize: 2048 } as any
    );
    https.createServer({ key: pems.private, cert: pems.cert }, app).listen(port, onListening);
  } else {
    // Plain HTTP — intended for use behind ngrok or another TLS-terminating proxy.
    app.listen(port, onListening);
  }

  function onListening() {
    const proto = config.server.https ? 'HTTPS (self-signed)' : 'HTTP';
    console.log(`FreshBooks MCP Server (${proto}) listening on port ${port}`);
    console.log(`  SSE endpoint:    ${config.server.url}/sse`);
    console.log(`  OAuth authorize: ${config.server.url}/oauth/authorize`);
    console.log(`  OAuth callback:  ${getOAuthCallbackUri()}`);
    if (config.server.https) {
      console.log();
      console.log(`Self-signed cert — visit ${config.server.url} and accept the warning`);
      console.log('before opening the OAuth URL in the same browser.');
    }
  }
}
