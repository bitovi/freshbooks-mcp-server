# FreshBooks MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for the [FreshBooks API](https://www.freshbooks.com/api). Connect Claude to your FreshBooks account to read and write invoices, clients, expenses, payments, projects, and time entries.

Supports two modes:
- **stdio** — for Claude Desktop and MCP Inspector (no server needed)
- **HTTP + SSE** — for claude.ai custom connectors (requires a public HTTPS URL)

## Tools

| Tool | Description |
|---|---|
| `get_current_user` | Get the authenticated user's profile and account/business IDs |
| `list_clients` | List clients with optional search and filters |
| `get_client` | Get a client by ID |
| `create_client` | Create a new client |
| `update_client` | Update a client |
| `delete_client` | Soft-delete a client |
| `list_invoices` | List invoices filtered by client, status, or date range |
| `get_invoice` | Get an invoice by ID including line items |
| `create_invoice` | Create an invoice with line items |
| `update_invoice` | Update an invoice's status, due date, or notes |
| `send_invoice` | Email an invoice to the client |
| `list_expenses` | List expenses filtered by client, project, or date range |
| `get_expense` | Get an expense by ID |
| `create_expense` | Create an expense |
| `update_expense` | Update an expense |
| `list_payments` | List payments filtered by invoice or date range |
| `get_payment` | Get a payment by ID |
| `create_payment` | Record a payment against an invoice |
| `list_projects` | List projects filtered by client or active status |
| `get_project` | Get a project by ID |
| `create_project` | Create a project |
| `update_project` | Update a project |
| `list_time_entries` | List time entries filtered by project, client, or date range |
| `get_time_entry` | Get a time entry by ID |
| `create_time_entry` | Log a time entry against a project |
| `update_time_entry` | Update a time entry |
| `delete_time_entry` | Delete a time entry |
| `list_items` | List items (products/services) |
| `get_item` | Get an item by ID |

## Prerequisites

- Node.js v20.6 or later
- A FreshBooks account
- A FreshBooks app (free) — create one at [my.freshbooks.com/#/developer](https://my.freshbooks.com/#/developer)

## Setup

```bash
git clone https://github.com/bitovi/freshbooks-mcp-server
cd freshbooks-mcp-server
npm install
npm run build
cp .env.example .env
```

Edit `.env` and set your FreshBooks app credentials:

```
FRESHBOOKS_CLIENT_ID=your_client_id
FRESHBOOKS_CLIENT_SECRET=your_client_secret
```

## Claude Desktop (stdio)

This is the simplest way to use the server. Claude Desktop communicates with it directly over stdio — no HTTP server or public URL required.

### 1. Get a FreshBooks access token

Start the HTTP server to complete the OAuth flow once:

```bash
npm run dev:http
```

In a separate terminal, print the auth URL:

```bash
npm run auth-url
```

Open the printed URL in your browser. After logging in with FreshBooks, the page will display your session token. Copy the **FreshBooks access token** and add it to `.env`:

```
FRESHBOOKS_ACCESS_TOKEN=your_access_token
```

### 2. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "freshbooks": {
      "command": "/path/to/node",
      "args": ["/path/to/freshbooks-mcp-server/dist/index.js"],
      "env": {
        "MODE": "stdio"
      }
    }
  }
}
```

Replace `/path/to/node` with the full path to your Node.js binary (`which node`) and `/path/to/freshbooks-mcp-server` with the absolute path to this repo.

> **nvm users:** Claude Desktop doesn't inherit your shell environment. Use the full path to your node binary, e.g. `/Users/you/.nvm/versions/node/v22.8.0/bin/node`.

Restart Claude Desktop. The FreshBooks tools will appear in the hammer menu in the chat input.

## claude.ai Custom Connector (HTTP + SSE)

Claude.ai custom connectors require a public HTTPS URL. For local testing, the server runs HTTPS directly with a self-signed certificate. For production, see [Deploying to AWS](#deploying-to-aws-ec2--nginx).

### Testing locally

**1. Start the server**

```bash
sudo npm run dev:http
```

> `sudo` is required because the server binds to port 443 by default. Alternatively, add `PORT=3443` to your `.env` and use `SERVER_URL=https://localhost:3443`.

**2. Trust the self-signed certificate**

Open `https://localhost` in your browser. Click **Advanced → Proceed to localhost** to accept the self-signed cert. You only need to do this once per browser session — otherwise the OAuth redirect will be blocked.

**3. Add the callback URI to your FreshBooks app**

In your FreshBooks developer console, add:

```
https://localhost/oauth/callback
```

**4. Get the auth URL**

```bash
npm run auth-url
```

Open the printed URL in your browser, log in with FreshBooks, and you'll see your session token displayed on the page.

**5. Test the SSE endpoint**

```bash
curl -sk https://localhost/sse -H "Authorization: Bearer <session_token>"
```

### Testing with ngrok

If you'd rather avoid `sudo` or want to test with a real certificate:

```bash
# Add to .env:
HTTPS=false
SERVER_URL=https://your-subdomain.ngrok-free.app
```

```bash
npm run dev:http   # Terminal 1
ngrok http 3000    # Terminal 2
```

Add `https://your-subdomain.ngrok-free.app/oauth/callback` to your FreshBooks app, then run `npm run auth-url`.

### Adding to claude.ai

Go to **Settings → Integrations → Add Integration** and enter your SSE URL:

```
https://localhost/sse              # local (with self-signed cert accepted in browser)
https://your-subdomain.ngrok-free.app/sse   # ngrok
https://freshbooks-mcp.yourdomain.com/sse   # production
```

Claude will prompt you to log in with FreshBooks. After authenticating, the tools are available in your conversations.

## Deploying to AWS (EC2 + nginx)

The recommended setup is an EC2 instance running nginx as a reverse proxy, with Let's Encrypt for a free TLS certificate. Sessions are stored on disk so they survive restarts.

### Architecture

```
claude.ai → ALB (or Elastic IP) → nginx (HTTPS/443) → Node.js (HTTP/3000)
```

You can skip the ALB and use nginx + Let's Encrypt directly on EC2 if you don't need auto-scaling.

### 1. Launch an EC2 instance

- **AMI:** Amazon Linux 2023 (or Ubuntu 22.04)
- **Instance type:** t3.micro (free tier) or t3.small
- **Security group inbound rules:**
  - SSH (22) — your IP only
  - HTTP (80) — anywhere (needed for Let's Encrypt verification)
  - HTTPS (443) — anywhere
- Attach an **Elastic IP** so your DNS record stays stable across reboots

### 2. Point a domain at the instance

In Route 53 (or any DNS provider), create an **A record** pointing your domain to the Elastic IP:

```
freshbooks-mcp.yourdomain.com  →  <Elastic IP>
```

### 3. Install Node.js 22 and nginx

```bash
# Amazon Linux 2023
sudo dnf install -y nginx git
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# Ubuntu 22.04
sudo apt update && sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
```

Install PM2 globally:

```bash
sudo npm install -g pm2
```

### 4. Deploy the app

```bash
git clone https://github.com/bitovi/freshbooks-mcp-server /srv/freshbooks-mcp
cd /srv/freshbooks-mcp
npm install
npm run build
mkdir -p logs

cp .env.example .env
nano .env   # fill in credentials (see Environment variables below)
```

Minimum `.env` for production:

```
FRESHBOOKS_CLIENT_ID=your_client_id
FRESHBOOKS_CLIENT_SECRET=your_client_secret
MODE=http
HTTPS=false
SERVER_URL=https://freshbooks-mcp.yourdomain.com
```

`PORT` defaults to `3000` when `HTTPS=false`, so no need to set it explicitly.

### 5. Configure nginx

Create `/etc/nginx/conf.d/freshbooks-mcp.conf`:

```nginx
server {
    listen 80;
    server_name freshbooks-mcp.yourdomain.com;
    # Let's Encrypt challenge + redirect everything else to HTTPS
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name freshbooks-mcp.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/freshbooks-mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/freshbooks-mcp.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for SSE — disable buffering so events stream immediately
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        # Keep SSE connections open for up to 24 hours
        proxy_read_timeout 86400s;
        chunked_transfer_encoding on;
    }
}
```

Test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Get a TLS certificate

```bash
sudo dnf install -y python3-certbot-nginx   # Amazon Linux 2023
# or: sudo apt install -y certbot python3-certbot-nginx   # Ubuntu

sudo certbot --nginx -d freshbooks-mcp.yourdomain.com
```

Certbot auto-configures nginx and sets up auto-renewal via a systemd timer.

### 7. Start the server with PM2

```bash
cd /srv/freshbooks-mcp
pm2 start ecosystem.config.cjs
pm2 save              # persist across reboots
pm2 startup           # follow the printed command to enable on boot
```

Useful commands:

```bash
pm2 logs freshbooks-mcp     # tail logs
pm2 reload freshbooks-mcp   # zero-downtime restart after code changes
pm2 status                  # check process health
```

### 8. Update FreshBooks and claude.ai

In your FreshBooks developer console, add the production redirect URI:

```
https://freshbooks-mcp.yourdomain.com/oauth/callback
```

In claude.ai → **Settings → Integrations → Add Integration**, enter:

```
https://freshbooks-mcp.yourdomain.com/sse
```

Claude will walk you through the FreshBooks OAuth flow. After that, all tools are live.

### Updating the server

```bash
cd /srv/freshbooks-mcp
git pull
npm install
npm run build
pm2 reload freshbooks-mcp
```

### Notes

- **Sessions** are stored in `~/.freshbooks-mcp/sessions.json` on the EC2 instance. Since EC2 has a persistent filesystem, sessions survive restarts and deploys.
- **ALB:** If you later add an Application Load Balancer, set its **idle timeout to 3600 seconds** (default 60 will drop long-lived SSE connections). nginx's `proxy_read_timeout` handles this when going direct.
- **Logs** go to `./logs/` in the project directory and are managed by PM2.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `FRESHBOOKS_CLIENT_ID` | Yes | Your FreshBooks app's client ID |
| `FRESHBOOKS_CLIENT_SECRET` | Yes | Your FreshBooks app's client secret |
| `FRESHBOOKS_ACCESS_TOKEN` | For stdio | A valid FreshBooks access token |
| `FRESHBOOKS_REFRESH_TOKEN` | Optional | Refresh token — used to auto-renew the access token |
| `MODE` | No | `stdio` (default) or `http` |
| `PORT` | No | Listen port. Defaults to `443` when `HTTPS=true`, `3000` when `HTTPS=false` |
| `SERVER_URL` | For HTTP mode | Public base URL. Defaults to `https://localhost` |
| `HTTPS` | No | `true` (default) — self-signed cert on the Node process; `false` — plain HTTP behind a proxy |
| `SESSIONS_FILE` | No | Path for persisted sessions (default: `~/.freshbooks-mcp/sessions.json`) |
| `FRESHBOOKS_API_BASE` | No | Override the FreshBooks API base URL (default: `https://api.freshbooks.com`) |

## Project structure

```
src/
  index.ts              Entry point — picks stdio or HTTP based on MODE
  load-env.ts           Minimal .env loader (no dotenv dependency)
  config.ts             Config from environment variables
  mcp-server.ts         Creates the McpServer and registers all tools
  http-server.ts        Express server with SSE transport and OAuth2 proxy
  stdio-server.ts       Stdio transport with token resolution
  freshbooks/
    client.ts           FreshBooks API client
    types.ts            TypeScript types for API responses
  tools/
    users.ts            get_current_user
    clients.ts          Client tools
    invoices.ts         Invoice tools
    expenses.ts         Expense tools
    payments.ts         Payment tools
    projects.ts         Project tools
    time-entries.ts     Time entry tools
    items.ts            Item tools
  scripts/
    auth-url.ts         Prints the FreshBooks OAuth URL for local testing
```
