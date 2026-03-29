import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerClientTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_clients',
    'List FreshBooks clients with optional filters. Returns paginated results including client contact info and outstanding balances.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25, max: 100)'),
      search: z.string().optional().describe('Search by client name or organization'),
      email: z.string().email().optional().describe('Filter by exact email address'),
      include_deleted: z.boolean().optional().describe('Include deleted clients (vis_state=1)'),
    },
    async ({ page, per_page, search, email, include_deleted }) => {
      const result = await getClient().listClients({
        page,
        per_page,
        search,
        email,
        vis_state: include_deleted ? 1 : 0,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_client',
    'Get a specific FreshBooks client by their client ID.',
    {
      client_id: z.number().int().positive().describe('The FreshBooks client ID'),
    },
    async ({ client_id }) => {
      const client = await getClient().getClient(client_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(client, null, 2) }],
      };
    }
  );

  server.tool(
    'create_client',
    'Create a new FreshBooks client.',
    {
      fname: z.string().optional().describe('First name'),
      lname: z.string().optional().describe('Last name'),
      email: z.string().email().optional().describe('Email address'),
      organization: z.string().optional().describe('Company / organization name'),
      phone: z.string().optional().describe('Phone number'),
      mobile: z.string().optional().describe('Mobile number'),
      p_street: z.string().optional().describe('Street address'),
      p_city: z.string().optional().describe('City'),
      p_province: z.string().optional().describe('State / province'),
      p_code: z.string().optional().describe('Postal / ZIP code'),
      p_country: z.string().optional().describe('Country'),
      note: z.string().optional().describe('Internal note about the client'),
    },
    async (body) => {
      const client = await getClient().createClient(body);
      return {
        content: [{ type: 'text', text: JSON.stringify(client, null, 2) }],
      };
    }
  );

  server.tool(
    'update_client',
    'Update an existing FreshBooks client.',
    {
      client_id: z.number().int().positive().describe('The FreshBooks client ID to update'),
      fname: z.string().optional(),
      lname: z.string().optional(),
      email: z.string().email().optional(),
      organization: z.string().optional(),
      phone: z.string().optional(),
      mobile: z.string().optional(),
      p_street: z.string().optional(),
      p_city: z.string().optional(),
      p_province: z.string().optional(),
      p_code: z.string().optional(),
      p_country: z.string().optional(),
      note: z.string().optional(),
    },
    async ({ client_id, ...body }) => {
      const client = await getClient().updateClient(client_id, body);
      return {
        content: [{ type: 'text', text: JSON.stringify(client, null, 2) }],
      };
    }
  );

  server.tool(
    'delete_client',
    'Delete (soft-delete) a FreshBooks client. The client is marked as inactive but not permanently removed.',
    {
      client_id: z.number().int().positive().describe('The FreshBooks client ID to delete'),
    },
    async ({ client_id }) => {
      await getClient().deleteClient(client_id);
      return {
        content: [{ type: 'text', text: `Client ${client_id} has been deleted.` }],
      };
    }
  );
}
