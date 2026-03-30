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
      'user:profile:write',
      'user:teams:read',
      'user:clients:read',
      'user:clients:write',
      'user:invoices:read',
      'user:invoices:write',
      'user:expenses:read',
      'user:expenses:write',
      'user:payments:read',
      'user:payments:write',
      'user:projects:read',
      'user:projects:write',
      'user:time_entries:read',
      'user:time_entries:write',
      'user:estimates:read',
      'user:estimates:write',
      'user:credit_notes:read',
      'user:credit_notes:write',
      'user:bills:read',
      'user:bills:write',
      'user:bill_payments:read',
      'user:bill_payments:write',
      'user:bill_vendors:read',
      'user:bill_vendors:write',
      'user:billable_items:read',
      'user:billable_items:write',
      'user:other_income:read',
      'user:other_income:write',
      'user:taxes:read',
      'user:taxes:write',
      'user:reports:read',
      'user:retainers:read',
      'user:retainers:write',
      'user:notifications:read',
      'user:online_payments:read',
      'user:online_payments:write',
      'user:journal_entries:read',
      'user:journal_entries:write',
      'user:business:read',
      'user:business:write',
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
