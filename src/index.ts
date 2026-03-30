#!/usr/bin/env node

// loadEnv must run before any module that reads process.env at import time.
// All other imports are dynamic so they happen after the env is populated.
import { loadEnv } from './load-env.js';
loadEnv();

const { config } = await import('./config.js');

if (config.server.mode === 'http') {
  const { startHttpServer } = await import('./http-server.js');
  await startHttpServer();
} else {
  const { startStdioServer } = await import('./stdio-server.js');
  await startStdioServer();
}
