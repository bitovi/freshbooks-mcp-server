import { config, getOAuthCallbackUri } from '../config.js';

if (!config.freshbooks.clientId) {
  console.error('Error: FRESHBOOKS_CLIENT_ID is not set in your .env file.');
  process.exit(1);
}

// Go directly to FreshBooks OAuth — the callback will store the tokens and
// display the session token in the browser (no client redirect needed).
const params = new URLSearchParams({
  client_id: config.freshbooks.clientId,
  response_type: 'code',
  redirect_uri: getOAuthCallbackUri(),
  state: 'local-test',
});

const url = `${config.freshbooks.authUrl}?${params}`;

console.log('\nMake sure the server is running (npm run dev:http), then open:\n');
console.log(url);
console.log();
