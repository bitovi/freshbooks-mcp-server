import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerTimeEntryTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_time_entries',
    'List FreshBooks time entries with optional filters.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25)'),
      project_id: z.number().int().positive().optional().describe('Filter by project ID'),
      client_id: z.number().int().positive().optional().describe('Filter by client ID'),
      identity_id: z.number().int().positive().optional().describe('Filter by team member (identity) ID'),
      started_from: z.string().optional().describe('Filter entries starting on or after this ISO 8601 datetime'),
      started_to: z.string().optional().describe('Filter entries starting on or before this ISO 8601 datetime'),
      billed: z.boolean().optional().describe('Filter by billed status'),
      billable: z.boolean().optional().describe('Filter by billable status'),
      include_team: z.boolean().optional().describe('If true, returns time entries for all team members (requires owner/admin role). Default: false.'),
    },
    async (opts) => {
      const result = await getClient().listTimeEntries(opts);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_time_entry',
    'Get a specific FreshBooks time entry by its ID.',
    {
      time_entry_id: z.number().int().positive().describe('The time entry ID'),
    },
    async ({ time_entry_id }) => {
      const entry = await getClient().getTimeEntry(time_entry_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
      };
    }
  );

  server.tool(
    'create_time_entry',
    'Log a time entry against a FreshBooks project.',
    {
      project_id: z.number().int().positive().describe('The project to log time against'),
      duration: z.number().int().positive().describe('Duration in seconds (e.g. 3600 for 1 hour)'),
      started_at: z.string().describe('Start time as an ISO 8601 datetime string (e.g. "2024-01-15T09:00:00Z")'),
      note: z.string().optional().describe('Description of work done'),
      task_id: z.number().int().positive().optional().describe('Task ID within the project'),
      billable: z.boolean().optional().describe('Whether this time is billable (default: true)'),
      is_logged: z.boolean().optional().describe('Whether the time entry is logged (as opposed to a timer still running)'),
    },
    async ({ project_id, duration, started_at, note, task_id, billable, is_logged }) => {
      const entry = await getClient().createTimeEntry({
        project_id,
        duration,
        started_at,
        note,
        task_id,
        billable,
        is_logged: is_logged ?? true,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
      };
    }
  );

  server.tool(
    'update_time_entry',
    'Update an existing FreshBooks time entry.',
    {
      time_entry_id: z.number().int().positive().describe('The time entry ID to update'),
      duration: z.number().int().positive().optional().describe('New duration in seconds'),
      started_at: z.string().optional().describe('New start time (ISO 8601)'),
      note: z.string().optional().describe('Updated note'),
      task_id: z.number().int().positive().optional(),
      billable: z.boolean().optional(),
    },
    async ({ time_entry_id, ...body }) => {
      const entry = await getClient().updateTimeEntry(time_entry_id, body);
      return {
        content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
      };
    }
  );

  server.tool(
    'delete_time_entry',
    'Delete a FreshBooks time entry.',
    {
      time_entry_id: z.number().int().positive().describe('The time entry ID to delete'),
    },
    async ({ time_entry_id }) => {
      await getClient().deleteTimeEntry(time_entry_id);
      return {
        content: [{ type: 'text', text: `Time entry ${time_entry_id} has been deleted.` }],
      };
    }
  );
}
