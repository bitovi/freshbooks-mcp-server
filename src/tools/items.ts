import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerItemTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_items',
    'List FreshBooks items (products/services) that can be added to invoices.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25)'),
      search: z.string().optional().describe('Search by item name'),
    },
    async ({ page, per_page, search }) => {
      const result = await getClient().listItems({ page, per_page, search });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_item',
    'Get a specific FreshBooks item (product/service) by its ID.',
    {
      item_id: z.number().int().positive().describe('The FreshBooks item ID'),
    },
    async ({ item_id }) => {
      const item = await getClient().getItem(item_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(item, null, 2) }],
      };
    }
  );
}
