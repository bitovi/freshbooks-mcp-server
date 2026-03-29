#!/usr/bin/env node
import { loadEnv } from './load-env.js';
loadEnv(); // Load .env before anything reads process.env
import { config } from './config.js';

if (config.server.mode === 'http') {
  const { startHttpServer } = await import('./http-server.js');
  await startHttpServer();
} else {
  const { startStdioServer } = await import('./stdio-server.js');
  await startStdioServer();
}
