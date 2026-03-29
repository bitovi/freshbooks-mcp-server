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
      'user:teams:read',
      'invoices:all:legacy',
      'clients:all:legacy',
      'expenses:all:legacy',
      'payments:all:legacy',
      'projects:all:legacy',
      'time_entries:all:legacy',
      'items:all:legacy',
    ].join(' '),
  },
  server: {
    mode: (process.env.MODE ?? 'stdio') as 'stdio' | 'http',
    // Set HTTPS=false when running behind a reverse proxy / ngrok that handles TLS
    https: process.env.HTTPS !== 'false',
    // Default port: 443 for HTTPS, 3000 for plain HTTP (behind a proxy)
    get port() {
      return parseInt(process.env.PORT ?? (this.https ? '443' : '3000'), 10);
    },
    // Public base URL — used to build the OAuth callback URI in HTTP mode
    url: process.env.SERVER_URL ?? 'https://localhost',
  },
};

export function getOAuthCallbackUri(): string {
  return `${config.server.url}/oauth/callback`;
}
