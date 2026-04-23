import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerServiceTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_services',
    'List all services defined for the FreshBooks business.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25)'),
    },
    async ({ page, per_page }) => {
      const result = await getClient().listServices({ page, per_page });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_service',
    'Get a specific FreshBooks service by its ID.',
    {
      service_id: z.number().int().positive().describe('The FreshBooks service ID'),
    },
    async ({ service_id }) => {
      const service = await getClient().getService(service_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(service, null, 2) }],
      };
    }
  );

  server.tool(
    'get_service_rate',
    'Get the global billing rate for a specific FreshBooks service.',
    {
      service_id: z.number().int().positive().describe('The FreshBooks service ID'),
    },
    async ({ service_id }) => {
      const rate = await getClient().getServiceRate(service_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(rate, null, 2) }],
      };
    }
  );

  server.tool(
    'list_project_service_rates',
    'List the per-project billing rate overrides for all services on a specific project.',
    {
      project_id: z.number().int().positive().describe('The FreshBooks project ID'),
    },
    async ({ project_id }) => {
      const rates = await getClient().listProjectServiceRates(project_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(rates, null, 2) }],
      };
    }
  );
}
