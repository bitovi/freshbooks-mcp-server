export const config = {
  freshbooks: {
    clientId: process.env.FRESHBOOKS_CLIENT_ID ?? '',
    clientSecret: process.env.FRESHBOOKS_CLIENT_SECRET ?? '',
    apiBase: process.env.FRESHBOOKS_API_BASE ?? 'https://api.freshbooks.com',
    authUrl: 'https://auth.freshbooks.com/oauth/authorize',
    tokenUrl: 'https://api.freshbooks.com/auth/oauth/token',
    // Scopes to request — FreshBooks uses space-separated scopes
    scopes: [
      'user:profile:read',
      'user:clients:read',
      'user:bills:read',
      'user:bill_payments:read',
      'user:bill_vendors:read',
      'user:billable_items:read',
      'user:business:read',
      'user:credit_notes:read',
      'user:estimates:read',
      'user:expenses:read',
      'user:invoices:read',
      'user:account:read',
      'user:journal_entries:read',
      'user:notifications:read',
      'user:online_payments:read',
      'user:other_income:read',
      'user:payments:read',
      'user:projects:read',
      'user:reports:read',
      'user:retainers:read',
      'user:taxes:read',
      'user:teams:read',
      'user:time_entries:read',
      'user:time_entries:write',
      'user:uploads:read',
      'user:riskhub:read',
    ].join(' '),
  },
  server: {
    mode: (process.env.MODE ?? 'stdio') as 'stdio' | 'http',
    // Set HTTPS=false when running behind a reverse proxy / ngrok that handles TLS
    https: process.env.HTTPS !== 'false',
    // Default port: 3443 for HTTPS (no sudo needed), 3000 for plain HTTP (behind a proxy)
    get port() {
      return parseInt(process.env.PORT ?? (this.https ? '3443' : '3000'), 10);
    },
    // Public base URL — used to build the OAuth callback URI in HTTP mode
    url: process.env.SERVER_URL ?? 'https://localhost:3443',
  },
};

export function getOAuthCallbackUri(): string {
  return `${config.server.url}/oauth/callback`;
}
