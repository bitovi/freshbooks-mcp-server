import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerUserTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'get_current_user',
    'Get the authenticated FreshBooks user profile, including their account ID and business ID required for other API calls.',
    {},
    async () => {
      const client = getClient();
      const user = await client.getCurrentUser();
      await client.resolveIdentity();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                account_id: client.accountId,
                business_id: client.businessId,
                businesses: user.business_memberships?.map((m) => ({
                  id: m.business.id,
                  name: m.business.name,
                  account_id: m.business.account_id,
                  role: m.role,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
