import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FreshBooksClient } from './freshbooks/client.js';
import { registerUserTools } from './tools/users.js';
import { registerClientTools } from './tools/clients.js';
import { registerInvoiceTools } from './tools/invoices.js';
import { registerExpenseTools } from './tools/expenses.js';
import { registerPaymentTools } from './tools/payments.js';
import { registerProjectTools } from './tools/projects.js';
import { registerTimeEntryTools } from './tools/time-entries.js';
import { registerItemTools } from './tools/items.js';
import { registerServiceTools } from './tools/services.js';

/**
 * Create and configure a FreshBooks MCP server.
 *
 * @param getClient  Factory that returns a ready-to-use FreshBooksClient.
 *                   Called fresh for each tool invocation so that token
 *                   refresh can happen transparently.
 */
export function createMcpServer(getClient: () => FreshBooksClient): McpServer {
  const server = new McpServer({
    name: 'freshbooks-mcp-server',
    version: '1.0.0',
  });

  registerUserTools(server, getClient);
  registerClientTools(server, getClient);
  registerInvoiceTools(server, getClient);
  registerExpenseTools(server, getClient);
  registerPaymentTools(server, getClient);
  registerProjectTools(server, getClient);
  registerTimeEntryTools(server, getClient);
  registerItemTools(server, getClient);
  registerServiceTools(server, getClient);

  return server;
}
